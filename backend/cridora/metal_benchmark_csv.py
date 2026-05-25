"""Bundled daily USD benchmarks (marketing history). Paths live under ``cridora/data/metal_benchmark/``."""

from __future__ import annotations

import csv
from pathlib import Path

BENCHMARK_SUBDIR = Path(__file__).resolve().parent / "data" / "metal_benchmark"

GOLD_CSV_NAME = "gold_gc_f_daily.csv"
SILVER_CSV_NAME = "silver_si_f_daily.csv"


def _parse_iso_from_si_f(ts: str) -> str | None:
    s = (ts or "").strip().strip('"')
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return None


def load_gold_daily_usd_closes():
    """Return sorted [(YYYY-MM-DD, close_usd_per_troy_oz), ...] from bundled COMEX-active proxy CSV."""
    path = BENCHMARK_SUBDIR / GOLD_CSV_NAME
    if not path.is_file():
        return []
    out = []
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ds = (row.get("date") or row.get("Date") or "").strip()
            if len(ds) < 10:
                continue
            ds = ds[:10]
            raw = row.get("close_usd_per_troy_oz") or row.get("Close") or row.get("close")
            try:
                px = float(raw)
            except (TypeError, ValueError):
                continue
            if px > 0:
                out.append((ds, px))
    out.sort(key=lambda x: x[0])
    return out


def load_silver_daily_usd_closes():
    """Sorted [(YYYY-MM-DD, close_usd_per_troy_oz), ...] — SI=F futures style export."""
    path = BENCHMARK_SUBDIR / SILVER_CSV_NAME
    if not path.is_file():
        return []
    out = []
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            return []
        for row in reader:
            ds = _parse_iso_from_si_f(row.get("Date") or "")
            if not ds:
                continue
            raw = row.get("Close") or row.get("close") or ""
            try:
                px = float(str(raw).strip().strip('"'))
            except (TypeError, ValueError):
                continue
            if px > 0:
                out.append((ds, px))
    out.sort(key=lambda x: x[0])
    return out


def benchmark_rows_between(metal: str, start_iso: str, end_iso: str):
    """Rows in [start_iso, end_iso] inclusive (calendar string compare suffices for ISO dates)."""
    pairs = (
        load_silver_daily_usd_closes() if metal == "silver" else load_gold_daily_usd_closes()
    )
    return [(ds, px) for ds, px in pairs if start_iso <= ds <= end_iso]
