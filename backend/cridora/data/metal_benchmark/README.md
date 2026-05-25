# Metal benchmark CSVs (gold / silver)

Bundled daily **USD per troy ounce** closes used by ``GET /api/metal-history`` for gold and silver together with **`MetalTickerDailySnapshot`** rows (marginal AED/g from ``/api/spot-prices/``).

## Regenerating (~ annually)

From the **`backend/`** directory:

```bash
python cridora/data/metal_benchmark/build_csvs.py
```

- **Gold** rows are fetched from Yahoo’s public chart endpoint for COMEX **`GC=F`** (last ~2y window trimmed to ~370 calendar days server-side).
- **Silver** merges **your** `Silver_historical_data.csv` (SI=F closes) where present with **Yahoo `SI=F` daily** (~2y, trimmed server-side): archive wins duplicate dates and Yahoo fills open days / extends past the CSV’s last date.

Data is indicative only — same disclaimer as the public API.
