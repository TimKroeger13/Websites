"""ImmobilienScout24 scraper.

Design notes
============
- Rate limit: one request every MIN_REQUEST_INTERVAL seconds (default 10s).
- We iterate over configured search categories, page by page, collecting
  expose IDs. Unseen IDs are fetched and parsed.
- For each detail page we try multiple extraction strategies in order
  (JSON-LD -> inline JS JSON -> HTML regex). The first one that yields
  valid exact coordinates wins.
- "Exact" coordinates means: the listing did NOT set the
  `addressApproximated` flag. If that flag is missing or true, the
  listing is marked 'rejected' so we never look at it again.
- Block detection: if we get a 403, 429, or a page that looks like a
  Cloudflare interstitial, we back off exponentially (60s, 120s, 240s,
  capped at 30min) and keep retrying. The state object reports this.

Selectors / patterns are clustered near the top of the file. When
ImmoScout changes their HTML you adjust them here.
"""
from __future__ import annotations

import json
import logging
import random
import re
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable

import httpx
from selectolax.parser import HTMLParser

from . import db

log = logging.getLogger("scraper")

# ---------------------------------------------------------------------------
# Configuration -- adjust here if ImmoScout24 changes their layout
# ---------------------------------------------------------------------------

BASE = "https://www.immobilienscout24.de"

# All Berlin categories. Empty value disables the category.
CATEGORIES: dict[str, str] = {
    "wohnung-mieten": f"{BASE}/Suche/de/berlin/berlin/wohnung-mieten",
    "wohnung-kaufen": f"{BASE}/Suche/de/berlin/berlin/wohnung-kaufen",
    "haus-mieten":    f"{BASE}/Suche/de/berlin/berlin/haus-mieten",
    "haus-kaufen":    f"{BASE}/Suche/de/berlin/berlin/haus-kaufen",
    "wg-zimmer":      f"{BASE}/Suche/de/berlin/berlin/wg-zimmer",
}

MIN_REQUEST_INTERVAL = 10.0           # seconds between any two outbound requests
MAX_PAGES_PER_CATEGORY = 50           # hard ceiling; Berlin rarely exceeds this
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}

# Regex pool. Multiple alternatives -- first match wins.
RE_EXPOSE_ID         = re.compile(r"/expose/(\d{6,})")
RE_INLINE_LATLON     = re.compile(r'"(?:latitude|lat)"\s*:\s*(-?\d+\.\d+).{0,40}"(?:longitude|lng|lon)"\s*:\s*(-?\d+\.\d+)')
RE_APPROXIMATED      = re.compile(r'"addressApproximated"\s*:\s*(true|false)')
RE_HEIZKOSTEN_LABEL  = re.compile(r"Heizkosten", re.IGNORECASE)
RE_EURO_AMOUNT       = re.compile(r"([\d.]+(?:,\d+)?)\s*€")
RE_QM_AMOUNT         = re.compile(r"([\d.]+(?:,\d+)?)\s*m[²2]")
RE_ROOMS             = re.compile(r"([\d.,]+)\s*Zi(?:mmer)?", re.IGNORECASE)
RE_CLOUDFLARE_HINT   = re.compile(r"(cf-browser-verification|Just a moment|cf-chl)", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Scraper state (singleton, thread-safe)
# ---------------------------------------------------------------------------


@dataclass
class ScrapeStatus:
    running: bool = False
    started_at: str | None = None
    finished_at: str | None = None
    current_category: str | None = None
    current_page: int = 0
    ids_discovered: int = 0
    ids_new: int = 0
    apartments_added: int = 0
    rejected: int = 0
    errors: int = 0
    last_request_at: str | None = None
    block_backoff_until: str | None = None
    last_error: str | None = None
    log_tail: list[str] = field(default_factory=list)

    def snapshot(self) -> dict[str, Any]:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


_state = ScrapeStatus()
_state_lock = threading.Lock()
_worker: threading.Thread | None = None
_stop_event = threading.Event()


def get_status() -> dict[str, Any]:
    with _state_lock:
        return _state.snapshot()


def is_running() -> bool:
    with _state_lock:
        return _state.running


def _log(msg: str) -> None:
    log.info(msg)
    with _state_lock:
        _state.log_tail.append(f"{datetime.utcnow().isoformat(timespec='seconds')}  {msg}")
        # Keep the tail bounded
        if len(_state.log_tail) > 200:
            _state.log_tail = _state.log_tail[-200:]


# ---------------------------------------------------------------------------
# HTTP layer with rate-limiting and block-detection
# ---------------------------------------------------------------------------


class RateLimitedClient:
    def __init__(self, min_interval: float = MIN_REQUEST_INTERVAL) -> None:
        self.min_interval = min_interval
        self._last_call: float = 0.0
        self._client = httpx.Client(
            headers=REQUEST_HEADERS,
            follow_redirects=True,
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        self._backoff = 60.0  # current backoff window in seconds

    def close(self) -> None:
        self._client.close()

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_call
        wait = self.min_interval - elapsed
        if wait > 0:
            # Add tiny jitter so we don't look perfectly periodic
            time.sleep(wait + random.uniform(0.0, 0.5))

    def fetch(self, url: str) -> str:
        """Fetch a URL with throttling + block detection + backoff retry."""
        while not _stop_event.is_set():
            self._throttle()
            self._last_call = time.monotonic()
            with _state_lock:
                _state.last_request_at = datetime.utcnow().isoformat(timespec="seconds")
            try:
                resp = self._client.get(url)
            except httpx.HTTPError as e:
                _log(f"HTTP error on {url}: {e!r}")
                self._sleep_backoff(f"network error: {e}")
                continue

            if resp.status_code == 200 and not _looks_blocked(resp.text):
                # success: reset backoff
                self._backoff = 60.0
                return resp.text

            if resp.status_code in (403, 429) or _looks_blocked(resp.text):
                _log(f"Blocked on {url} (status={resp.status_code}). Backing off.")
                self._sleep_backoff(f"blocked ({resp.status_code})")
                continue

            _log(f"Unexpected status {resp.status_code} on {url}")
            self._sleep_backoff(f"status {resp.status_code}")

        return ""  # stop requested

    def _sleep_backoff(self, reason: str) -> None:
        delay = min(self._backoff, 1800.0)
        until = time.time() + delay
        with _state_lock:
            _state.block_backoff_until = datetime.utcfromtimestamp(until).isoformat(timespec="seconds")
            _state.last_error = reason
        # Sleep in 1-second chunks so a stop request is responsive
        end = time.monotonic() + delay
        while time.monotonic() < end and not _stop_event.is_set():
            time.sleep(1.0)
        with _state_lock:
            _state.block_backoff_until = None
        self._backoff = min(self._backoff * 2, 1800.0)


def _looks_blocked(html: str) -> bool:
    if not html:
        return True
    # Heuristic for Cloudflare / generic interstitials
    if len(html) < 2000 and RE_CLOUDFLARE_HINT.search(html):
        return True
    if "captcha" in html.lower() and "immobilienscout" not in html.lower()[:5000]:
        return True
    return False


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _extract_expose_ids(html: str) -> list[str]:
    ids = RE_EXPOSE_ID.findall(html)
    # Preserve order, dedupe
    seen: set[str] = set()
    result: list[str] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            result.append(i)
    return result


def _parse_euro(text: str | None) -> float | None:
    if not text:
        return None
    m = RE_EURO_AMOUNT.search(text)
    if not m:
        return None
    raw = m.group(1).replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _parse_number(text: str | None, pattern: re.Pattern[str]) -> float | None:
    if not text:
        return None
    m = pattern.search(text)
    if not m:
        return None
    raw = m.group(1).replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return None


def _extract_coords(html: str) -> tuple[float, float, bool] | None:
    """Return (lat, lon, is_approximate) or None if no coords found at all."""
    # Strategy 1: JSON-LD
    tree = HTMLParser(html)
    for script in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text() or "{}")
        except json.JSONDecodeError:
            continue
        # JSON-LD can be a list or a single object
        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            geo = item.get("geo") if isinstance(item, dict) else None
            if isinstance(geo, dict):
                lat = geo.get("latitude")
                lon = geo.get("longitude")
                if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                    approx = _is_approximate(html)
                    return float(lat), float(lon), approx

    # Strategy 2: inline JSON regex
    m = RE_INLINE_LATLON.search(html)
    if m:
        try:
            lat = float(m.group(1))
            lon = float(m.group(2))
            return lat, lon, _is_approximate(html)
        except ValueError:
            pass
    return None


def _is_approximate(html: str) -> bool:
    """True if ImmoScout marks the listing as approximate-only."""
    m = RE_APPROXIMATED.search(html)
    if m:
        return m.group(1) == "true"
    # Fallback heuristic: if the page mentions only a zip-level pin
    # ("Ungefähre Lage", "ca. Standort") treat as approximate.
    if "Ungefähre Lage" in html or "ungefähre Position" in html.lower():
        return True
    # Default: assume exact when we have hard lat/lon and no marker.
    return False


def _extract_heizkosten(html: str) -> tuple[float | None, str | None]:
    """Return (numeric_eur, raw_text) for the Heizkosten value."""
    tree = HTMLParser(html)
    # Pattern A: a labeled <dl>/<dt>/<dd>
    for dl in tree.css("dl"):
        dts = dl.css("dt")
        dds = dl.css("dd")
        for dt, dd in zip(dts, dds):
            if RE_HEIZKOSTEN_LABEL.search(dt.text() or ""):
                raw = (dd.text() or "").strip()
                return _parse_euro(raw), raw
    # Pattern B: any element labeled Heizkosten near a euro amount
    body_text = tree.body.text(separator="\n") if tree.body else ""
    for line in body_text.splitlines():
        if RE_HEIZKOSTEN_LABEL.search(line):
            value = _parse_euro(line)
            if value is not None:
                return value, line.strip()
    return None, None


def _extract_meta(html: str) -> dict[str, Any]:
    """Pull title, address, Kaltmiete, Wohnfläche, Zimmer from JSON-LD/inline."""
    tree = HTMLParser(html)
    title = None
    address = None
    for script in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text() or "{}")
        except json.JSONDecodeError:
            continue
        candidates = data if isinstance(data, list) else [data]
        for item in candidates:
            if not isinstance(item, dict):
                continue
            title = title or item.get("name")
            addr = item.get("address")
            if isinstance(addr, dict):
                parts = [
                    addr.get("streetAddress"),
                    addr.get("postalCode"),
                    addr.get("addressLocality"),
                ]
                address = ", ".join(p for p in parts if p) or address

    kaltmiete = None
    wohnflaeche = None
    zimmer = None

    # Pattern A: <dl><dt>label</dt><dd>value</dd>
    for dl in tree.css("dl"):
        for dt, dd in zip(dl.css("dt"), dl.css("dd")):
            label = (dt.text() or "").lower()
            value = (dd.text() or "").strip()
            if "kaltmiete" in label and kaltmiete is None:
                kaltmiete = _parse_euro(value)
            elif "wohnfläche" in label and wohnflaeche is None:
                wohnflaeche = _parse_number(value, RE_QM_AMOUNT)
            elif "zimmer" in label and zimmer is None:
                zimmer = _parse_number(value, RE_ROOMS) or _parse_number(value, re.compile(r"([\d.,]+)"))

    # Pattern B: fall back to scanning body text line-by-line
    if kaltmiete is None or wohnflaeche is None or zimmer is None:
        body_text = tree.body.text(separator="\n") if tree.body else ""
        for line in body_text.splitlines():
            ll = line.lower()
            if "kaltmiete" in ll and kaltmiete is None:
                kaltmiete = _parse_euro(line)
            elif "wohnfläche" in ll and wohnflaeche is None:
                wohnflaeche = _parse_number(line, RE_QM_AMOUNT)
            elif "zimmer" in ll and zimmer is None:
                zimmer = _parse_number(line, RE_ROOMS)
    return {
        "title": title,
        "address": address,
        "kaltmiete_eur": kaltmiete,
        "wohnflaeche_qm": wohnflaeche,
        "zimmer": zimmer,
    }


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------


def _process_expose(client: RateLimitedClient, expose_id: str, category: str) -> None:
    url = f"{BASE}/expose/{expose_id}"
    html = client.fetch(url)
    if not html:
        db.mark_seen(expose_id, "error", "fetch failed or stop requested")
        with _state_lock:
            _state.errors += 1
        return

    coords = _extract_coords(html)
    if coords is None:
        db.mark_seen(expose_id, "rejected", "no coordinates found")
        with _state_lock:
            _state.rejected += 1
        return

    lat, lon, approximate = coords
    if approximate:
        db.mark_seen(expose_id, "rejected", "addressApproximated=true")
        with _state_lock:
            _state.rejected += 1
        return

    heizkosten_eur, heizkosten_raw = _extract_heizkosten(html)
    meta = _extract_meta(html)

    db.upsert_apartment({
        "expose_id": expose_id,
        "lat": lat,
        "lon": lon,
        "heizkosten_eur": heizkosten_eur,
        "heizkosten_raw": heizkosten_raw,
        "title": meta["title"],
        "address": meta["address"],
        "kaltmiete_eur": meta["kaltmiete_eur"],
        "wohnflaeche_qm": meta["wohnflaeche_qm"],
        "zimmer": meta["zimmer"],
        "category": category,
        "url": url,
    })
    db.mark_seen(expose_id, "ok")
    with _state_lock:
        _state.apartments_added += 1
    _log(f"  + {expose_id} ({category}) lat={lat:.5f} lon={lon:.5f} heiz={heizkosten_eur}")


def _iter_search_pages(client: RateLimitedClient, category: str, base_url: str) -> Iterable[list[str]]:
    for page in range(1, MAX_PAGES_PER_CATEGORY + 1):
        if _stop_event.is_set():
            return
        url = f"{base_url}?pagenumber={page}"
        with _state_lock:
            _state.current_page = page
        _log(f"Search page {category} #{page}: {url}")
        html = client.fetch(url)
        if not html:
            return
        ids = _extract_expose_ids(html)
        if not ids:
            _log(f"No expose IDs on page {page} -- stopping category {category}")
            return
        with _state_lock:
            _state.ids_discovered += len(ids)
        yield ids


def _run_scrape() -> None:
    with _state_lock:
        _state.running = True
        _state.started_at = datetime.utcnow().isoformat(timespec="seconds")
        _state.finished_at = None
        _state.current_category = None
        _state.current_page = 0
        _state.ids_discovered = 0
        _state.ids_new = 0
        _state.apartments_added = 0
        _state.rejected = 0
        _state.errors = 0
        _state.last_error = None
        _state.log_tail = []

    db.init_db()
    _log(f"Scrape started. Interval={MIN_REQUEST_INTERVAL}s, "
         f"categories={list(CATEGORIES.keys())}")
    client = RateLimitedClient(MIN_REQUEST_INTERVAL)
    try:
        for category, base_url in CATEGORIES.items():
            if _stop_event.is_set():
                break
            with _state_lock:
                _state.current_category = category

            for page_ids in _iter_search_pages(client, category, base_url):
                new_ids = db.get_unseen(page_ids)
                with _state_lock:
                    _state.ids_new += len(new_ids)
                _log(f"  page yielded {len(page_ids)} ids, {len(new_ids)} new")
                for expose_id in new_ids:
                    if _stop_event.is_set():
                        break
                    try:
                        _process_expose(client, expose_id, category)
                    except Exception as e:  # noqa: BLE001
                        log.exception("expose %s failed", expose_id)
                        db.mark_seen(expose_id, "error", str(e)[:200])
                        with _state_lock:
                            _state.errors += 1
                            _state.last_error = str(e)[:200]
    finally:
        client.close()
        with _state_lock:
            _state.running = False
            _state.finished_at = datetime.utcnow().isoformat(timespec="seconds")
            _state.current_category = None
        _log("Scrape finished.")


def start_scrape() -> bool:
    """Kick off a scrape in a daemon thread. Returns False if already running."""
    global _worker
    if is_running():
        return False
    _stop_event.clear()
    _worker = threading.Thread(target=_run_scrape, name="immo-scraper", daemon=True)
    _worker.start()
    return True


def request_stop() -> bool:
    if not is_running():
        return False
    _stop_event.set()
    _log("Stop requested.")
    return True
