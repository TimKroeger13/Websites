"""SQLite persistence layer.

Two tables:
- seen_listings: every expose ID we ever touched, with a status flag.
  status in ('ok', 'rejected', 'error') -- 'rejected' = no exact coords.
  This lets us skip listings we've already evaluated on subsequent runs.
- apartments: only listings with exact coordinates (status='ok').
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path("/app/data/immo.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS seen_listings (
    expose_id   TEXT PRIMARY KEY,
    status      TEXT NOT NULL,           -- 'ok' | 'rejected' | 'error'
    reason      TEXT,                    -- why rejected, or last error message
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS apartments (
    expose_id        TEXT PRIMARY KEY,
    lat              REAL NOT NULL,
    lon              REAL NOT NULL,
    heizkosten_eur   REAL,               -- parsed numeric value if available
    heizkosten_raw   TEXT,               -- raw string for fallback display
    title            TEXT,
    address          TEXT,
    kaltmiete_eur    REAL,
    wohnflaeche_qm   REAL,
    zimmer           REAL,
    category         TEXT,               -- 'wohnung-mieten' etc.
    url              TEXT,
    scraped_at       TEXT NOT NULL,
    FOREIGN KEY(expose_id) REFERENCES seen_listings(expose_id)
);

CREATE INDEX IF NOT EXISTS idx_apartments_category   ON apartments(category);
CREATE INDEX IF NOT EXISTS idx_apartments_scraped_at ON apartments(scraped_at);
"""

_lock = threading.Lock()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(_SCHEMA)


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    # SQLite + threads: serialize all writes through a lock.
    with _lock:
        conn = sqlite3.connect(DB_PATH, isolation_level=None, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
        finally:
            conn.close()


def is_seen(expose_id: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM seen_listings WHERE expose_id = ?", (expose_id,)
        ).fetchone()
        return row is not None


def get_unseen(expose_ids: list[str]) -> list[str]:
    """Return the subset of expose_ids we have NOT seen before."""
    if not expose_ids:
        return []
    with _connect() as conn:
        placeholders = ",".join("?" * len(expose_ids))
        rows = conn.execute(
            f"SELECT expose_id FROM seen_listings WHERE expose_id IN ({placeholders})",
            expose_ids,
        ).fetchall()
        seen = {r["expose_id"] for r in rows}
        return [eid for eid in expose_ids if eid not in seen]


def mark_seen(expose_id: str, status: str, reason: str | None = None) -> None:
    now = datetime.utcnow().isoformat(timespec="seconds")
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO seen_listings (expose_id, status, reason, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(expose_id) DO UPDATE SET
                status    = excluded.status,
                reason    = excluded.reason,
                last_seen = excluded.last_seen
            """,
            (expose_id, status, reason, now, now),
        )


def upsert_apartment(data: dict[str, Any]) -> None:
    now = datetime.utcnow().isoformat(timespec="seconds")
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO apartments (
                expose_id, lat, lon, heizkosten_eur, heizkosten_raw,
                title, address, kaltmiete_eur, wohnflaeche_qm, zimmer,
                category, url, scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(expose_id) DO UPDATE SET
                lat            = excluded.lat,
                lon            = excluded.lon,
                heizkosten_eur = excluded.heizkosten_eur,
                heizkosten_raw = excluded.heizkosten_raw,
                title          = excluded.title,
                address        = excluded.address,
                kaltmiete_eur  = excluded.kaltmiete_eur,
                wohnflaeche_qm = excluded.wohnflaeche_qm,
                zimmer         = excluded.zimmer,
                category       = excluded.category,
                url            = excluded.url,
                scraped_at     = excluded.scraped_at
            """,
            (
                data["expose_id"],
                data["lat"],
                data["lon"],
                data.get("heizkosten_eur"),
                data.get("heizkosten_raw"),
                data.get("title"),
                data.get("address"),
                data.get("kaltmiete_eur"),
                data.get("wohnflaeche_qm"),
                data.get("zimmer"),
                data.get("category"),
                data.get("url"),
                now,
            ),
        )


def list_apartments() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM apartments ORDER BY scraped_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def stats() -> dict[str, Any]:
    with _connect() as conn:
        total_seen = conn.execute("SELECT COUNT(*) c FROM seen_listings").fetchone()["c"]
        total_ok = conn.execute(
            "SELECT COUNT(*) c FROM seen_listings WHERE status='ok'"
        ).fetchone()["c"]
        total_rejected = conn.execute(
            "SELECT COUNT(*) c FROM seen_listings WHERE status='rejected'"
        ).fetchone()["c"]
        total_error = conn.execute(
            "SELECT COUNT(*) c FROM seen_listings WHERE status='error'"
        ).fetchone()["c"]
        last_row = conn.execute(
            "SELECT MAX(scraped_at) AS last FROM apartments"
        ).fetchone()
        return {
            "total_seen": total_seen,
            "with_exact_coords": total_ok,
            "rejected": total_rejected,
            "errors": total_error,
            "last_scrape": last_row["last"],
        }
