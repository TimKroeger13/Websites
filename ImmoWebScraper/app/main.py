"""FastAPI app: REST endpoints + static index.html."""
from __future__ import annotations

import csv
import io
import logging
from pathlib import Path

from . import scraper
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from . import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="ImmoScout24 Berlin Scraper", version="1.0.0")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/apartments")
def api_apartments() -> JSONResponse:
    return JSONResponse(db.list_apartments())


@app.get("/api/stats")
def api_stats() -> JSONResponse:
    return JSONResponse(db.stats())


@app.get("/api/status")
def api_status() -> JSONResponse:
    return JSONResponse(scraper.get_status())


@app.post("/api/scrape/start")
def api_scrape_start() -> JSONResponse:
    started = scraper.start_scrape()
    if not started:
        raise HTTPException(status_code=409, detail="scrape already running")
    return JSONResponse({"started": True})


@app.post("/api/scrape/stop")
def api_scrape_stop() -> JSONResponse:
    stopped = scraper.request_stop()
    if not stopped:
        raise HTTPException(status_code=409, detail="no scrape running")
    return JSONResponse({"stopping": True})


@app.get("/api/apartments.csv")
def api_apartments_csv() -> StreamingResponse:
    rows = db.list_apartments()
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buf.write("expose_id,lat,lon,heizkosten_eur\n")
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="apartments.csv"'},
    )
