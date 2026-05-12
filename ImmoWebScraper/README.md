# immo//scraper

A self-hosted scraper for ImmobilienScout24 Berlin listings that records the
exact GPS coordinates and the Heizkosten (heating costs) of every apartment
whose location is published precisely (not just approximated to a
neighborhood). Comes with a small web dashboard and CSV export.

---

## ⚠️ Read this first

ImmobilienScout24's Terms of Service prohibit automated access. They use
Cloudflare and other bot-protection layers. Running this scraper carries real
risk:

- **Your IP may be blocked** (temporarily or permanently).
- **You may receive an Abmahnung** (cease-and-desist letter) under German
  database/copyright law (§ 87b UrhG, § 4 UWG).
- **Selectors may break at any time** — IS24 changes their HTML/JSON layout
  regularly. When the scraper stops finding listings, see
  [Updating selectors](#updating-selectors-when-the-scraper-breaks).

Use this for personal research only. Don't republish or commercially exploit
the data. If you don't accept that risk, stop here.

Two further realities to set expectations:

- Only a fraction of listings on IS24 publish **exact** coordinates
  (`addressApproximated=false`). Expect 30–60% of fetched expose pages to be
  rejected on coordinate grounds alone. This is by design — the scraper
  filters as you asked.
- Berlin has thousands of active listings across the five categories. At the
  required 10-second rate limit, a full first run takes **many hours** (e.g.
  4,000 new IDs ≈ 11h). Subsequent runs only process new listings and are
  much faster.

---

## What it does

1. Iterates Berlin search results for the five categories (rent/buy
   apartments, rent/buy houses, WG-Zimmer).
2. Extracts expose IDs from each search-result page.
3. Checks each ID against a local SQLite database. Already-seen IDs are
   skipped.
4. For every new ID, fetches the expose detail page and tries to extract:
   - exact `lat`/`lon` from JSON-LD or inline JSON
   - the `addressApproximated` flag
   - Heizkosten (numeric + raw label)
   - title, address, Kaltmiete, Wohnfläche, Zimmer
5. Listings without exact coordinates are written to the `seen_listings`
   table with status `rejected` so they're never re-fetched.
6. Listings with exact coordinates are written to the `apartments` table.
7. Throttles to one outbound request every 10 seconds. On 403/429/Cloudflare
   interstitials, it backs off exponentially (60s → 30min cap) and retries.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Docker container (immo-scraper)                     │
│                                                      │
│   FastAPI  ──► /              static index.html      │
│           ──► /api/apartments                        │
│           ──► /api/apartments.csv                    │
│           ──► /api/stats                             │
│           ──► /api/status                            │
│           ──► /api/scrape/start  (POST)              │
│           ──► /api/scrape/stop   (POST)              │
│                                                      │
│   Background thread (the actual scraper)             │
│      └── RateLimitedClient (httpx, 10s interval)     │
│      └── selectolax HTML parsing                     │
│                                                      │
│   SQLite at /app/data/immo.db  (mounted volume)      │
└──────────────────────────────────────────────────────┘
```

Files:

```
.
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── README.md
└── app/
    ├── __init__.py
    ├── main.py          FastAPI app
    ├── scraper.py       Scraping logic (all selectors live here)
    ├── db.py            SQLite layer
    └── static/
        └── index.html   Dashboard (HTML + inline CSS + vanilla JS)
```

---

## Quick start with Docker

Prerequisites: Docker 20.10+ and Docker Compose v2.

```bash
git clone <this repo> immo-scraper
cd immo-scraper

# Build & launch
docker compose up -d --build

# Verify
docker compose logs -f immo-scraper
```

Open <http://localhost:8080>. Click **▶ Start Scrape**. Watch the stats and
live log tail update.

To stop the container:

```bash
docker compose down
```

The SQLite database lives in `./data/immo.db` on the host. It survives
container rebuilds.

---

## Quick start without Docker (development)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# The DB path is hardcoded to /app/data/immo.db. For local dev, symlink:
sudo mkdir -p /app/data
sudo chown $USER /app/data

uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Open <http://localhost:8080>.

---

## Using the dashboard

- **▶ Start Scrape** — kicks off a scrape in the background. The button
  disables while a run is active.
- **■ Stop** — requests a graceful stop. The current request finishes first.
- **Filter** input — case-insensitive substring match against `expose_id`,
  `title`, and `address`.
- **Kategorie** dropdown — show only one of the five categories.
- **Column headers** — click to sort ascending / descending.
- **⬇ CSV** — downloads the current `apartments` table (full table, not the
  filtered view).
- **⟳ Refresh** — force re-fetch of all three endpoints.
- **▼ Live Log Tail** — last 200 log lines from the scraper thread.

Stats update every 3 seconds. Table data refreshes every 15 seconds.

---

## Direct API access

| Method | Path                       | Returns                                  |
|--------|----------------------------|------------------------------------------|
| GET    | `/api/apartments`          | JSON list of all stored apartments       |
| GET    | `/api/apartments.csv`      | CSV download of `apartments` table       |
| GET    | `/api/stats`               | Counts (seen, ok, rejected, errors)      |
| GET    | `/api/status`              | Scrape state (running, page, log tail…)  |
| POST   | `/api/scrape/start`        | Starts a scrape (409 if already running) |
| POST   | `/api/scrape/stop`         | Stops the running scrape                 |

Example:

```bash
curl -X POST http://localhost:8080/api/scrape/start
curl http://localhost:8080/api/stats
curl http://localhost:8080/api/apartments.csv -o apartments.csv
```

---

## Database schema

Two SQLite tables in `/app/data/immo.db`:

**`seen_listings`** — every expose ID we have ever evaluated.

| column      | type | notes                                    |
|-------------|------|------------------------------------------|
| expose_id   | TEXT | primary key                              |
| status      | TEXT | `ok` \| `rejected` \| `error`            |
| reason      | TEXT | e.g. "addressApproximated=true"          |
| first_seen  | TEXT | ISO timestamp                            |
| last_seen   | TEXT | ISO timestamp                            |

**`apartments`** — listings with exact coordinates only.

| column         | type | notes                                  |
|----------------|------|----------------------------------------|
| expose_id      | TEXT | primary key, FK to seen_listings       |
| lat, lon       | REAL | exact GPS coordinates                  |
| heizkosten_eur | REAL | numeric value if parseable             |
| heizkosten_raw | TEXT | raw page text for fallback display     |
| title          | TEXT | listing title                          |
| address        | TEXT | "street, ZIP, city" if available       |
| kaltmiete_eur  | REAL | cold rent in EUR                       |
| wohnflaeche_qm | REAL | living area in m²                      |
| zimmer         | REAL | rooms                                  |
| category       | TEXT | one of the five search categories      |
| url            | TEXT | full expose URL                        |
| scraped_at     | TEXT | ISO timestamp of last fetch            |

To reset everything:

```bash
docker compose down
rm -rf data/immo.db
docker compose up -d
```

To inspect manually:

```bash
sqlite3 data/immo.db
sqlite> .tables
sqlite> SELECT category, COUNT(*) FROM apartments GROUP BY category;
sqlite> SELECT status, COUNT(*) FROM seen_listings GROUP BY status;
```

---

## Updating selectors when the scraper breaks

If you see lots of `no coordinates found` rejections, or zero IDs discovered
on the first page, IS24 most likely changed something. Open
`app/scraper.py`. The patterns you'll need to adjust live near the top:

- `RE_EXPOSE_ID` — pattern for extracting expose IDs from search-result
  HTML. Currently matches `/expose/<digits>`.
- `RE_INLINE_LATLON` — fallback regex for inline JSON coordinates.
- `RE_APPROXIMATED` — flag that marks listings as approximate-only.
- `RE_HEIZKOSTEN_LABEL` — label text used in the `<dl>/<dt>/<dd>` cost
  block.
- `_extract_coords()` — strategies are tried in order. Add or reorder as
  needed.

**Debugging workflow:**

1. `docker compose exec immo-scraper python` opens a shell inside the
   container.
2. Use `httpx` with the same headers to fetch a known expose URL.
3. Save the HTML to `/tmp/foo.html` and inspect locally.
4. Adjust the regex / parser. `docker compose up -d --build` to redeploy.

---

## Troubleshooting

**"Blocked — backing off" doesn't recover.**
You've been rate-limited harder than the exponential backoff handles.
Options:

1. Stop the scrape (`■ Stop`), wait a few hours, restart.
2. Route the container through a residential proxy (set `HTTPS_PROXY` and
   `HTTP_PROXY` env vars in `docker-compose.yml`).
3. Increase `MIN_REQUEST_INTERVAL` in `app/scraper.py` (e.g. to 20s).

**Zero IDs discovered.**
Probably a layout change. See [Updating selectors](#updating-selectors-when-the-scraper-breaks).
A quick sanity check:

```bash
docker compose exec immo-scraper python -c "
import httpx, re
r = httpx.get('https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-mieten',
              headers={'User-Agent':'Mozilla/5.0'})
print('status', r.status_code, 'ids', len(re.findall(r'/expose/(\d+)', r.text)))
"
```

**Container won't start.**
Check `docker compose logs immo-scraper`. The most common cause is a
read-only `./data` directory on the host. `chmod u+w data/`.

**Coordinates are present but everything is rejected.**
The `addressApproximated` heuristic may be over-eager. Inspect the raw
HTML of an expose page you know is exact, find the field IS24 actually
uses, and update `_is_approximate()` in `app/scraper.py`.

---

## License & responsibility

This code is provided as-is. You are responsible for how you use it,
including compliance with German law, IS24's Terms of Service, and the
GDPR if you process the resulting data. The author makes no warranty.
