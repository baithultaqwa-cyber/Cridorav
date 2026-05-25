"""
Regenerate bundled gold/silver daily USD closes (marketing history).

Uses Yahoo Finance public chart JSON (GC=F / SI=F) plus your SI=F CSV export where available.
CSV closes win on overlapping dates.

Usage from ``backend/``:

    python cridora/data/metal_benchmark/build_csvs.py

Edit ``SILVER_ARCHIVE_CSV`` if your export moves.
"""

from __future__ import annotations

import csv
import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SILVER_ARCHIVE_CSV = Path(r"C:\Users\Lagari A\Desktop\archive\Silver_historical_data.csv")


def _yahoo_daily_pairs(symbol: str, range_spec: str) -> list[tuple[str, float]]:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={range_spec}&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; Cridora/1.0)"})
    with urllib.request.urlopen(req, timeout=45) as res:
        blob = json.loads(res.read())
    chart_res = blob.get("chart", {}).get("result")
    if not chart_res:
        return []
    r0 = chart_res[0]
    ts = r0["timestamp"]
    closes = r0["indicators"]["quote"][0]["close"]
    out = []
    for t, px in zip(ts, closes):
        if px is None:
            continue
        d = datetime.fromtimestamp(int(t), tz=timezone.utc).date().isoformat()
        px_f = float(px)
        if px_f > 0:
            out.append((d, px_f))
    out.sort(key=lambda x: x[0])
    return out


def main():
    backend_dir = Path(__file__).resolve().parents[3]
    out_dir = Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)

    cutoff = date.today() - timedelta(days=370)
    cutoff_s = cutoff.isoformat()

    gold_pairs = _yahoo_daily_pairs("GC=F", "2y")
    gold_rows = [(d, px) for d, px in gold_pairs if d >= cutoff_s]

    gpath = out_dir / "gold_gc_f_daily.csv"
    with gpath.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "close_usd_per_troy_oz"])
        w.writerows(gold_rows)
    print("wrote", gpath.relative_to(backend_dir.parent), len(gold_rows), "rows")

    merged: dict[str, float] = {}
    for d, px in _yahoo_daily_pairs("SI=F", "2y"):
        if d >= cutoff_s:
            merged[d] = px

    if SILVER_ARCHIVE_CSV.is_file():
        with SILVER_ARCHIVE_CSV.open(encoding="utf-8", newline="") as fh:
            rdr = csv.DictReader(fh)
            for row in rdr:
                rawd = (row.get("Date") or "").strip().strip('"')
                if len(rawd) < 10:
                    continue
                ds = rawd[:10]
                if ds < cutoff_s:
                    continue
                try:
                    c = float(str(row.get("Close", "")).strip().strip('"'))
                except ValueError:
                    continue
                if c > 0:
                    merged[ds] = c

    silver_rows = sorted(merged.items(), key=lambda x: x[0])
    spath = out_dir / "silver_si_f_daily.csv"
    with spath.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Date", "Close", "ticker", "name"])
        for ds, px in silver_rows:
            w.writerow([ds, px, "SI=F", "Silver Futures (SI=F)"])
    print("wrote", spath.relative_to(backend_dir.parent), len(silver_rows), "rows")


if __name__ == "__main__":
    main()
