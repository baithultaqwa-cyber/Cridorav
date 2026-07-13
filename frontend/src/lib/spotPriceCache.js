/**
 * Read-side helper for the shared spot-price localStorage cache.
 *
 * Uses the exact same storage key/shape that `SpotPriceTicker` already
 * writes (`cridora_spot_prices_v1` → `{ savedAt, data }`), so any page can
 * hydrate instantly from whatever the ticker last fetched instead of firing
 * its own duplicate request on every mount. This file intentionally does not
 * modify `SpotPriceTicker.jsx` — it only reads/writes the same cache slot.
 */

const CACHE_KEY = 'cridora_spot_prices_v1'

function readEntry() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || typeof parsed.savedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/** @returns {{ data: object, savedAt: number } | null} */
export function readSpotPriceCache() {
  return readEntry()
}

/** Age of the cached spot payload in ms, or Infinity if missing/unreadable. */
export function spotPriceCacheAge() {
  const entry = readEntry()
  return entry ? Date.now() - entry.savedAt : Infinity
}

export function writeSpotPriceCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* quota exceeded / private mode */
  }
}
