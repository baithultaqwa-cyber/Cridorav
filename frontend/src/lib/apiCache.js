/**
 * Tiny localStorage-backed cache for public/read-only API payloads.
 *
 * Lets pages hydrate instantly from the last-known value (no blank/loading
 * flash on repeat visits) and skip a network round-trip entirely when the
 * cached value is still "fresh" per the caller's own threshold.
 */

const PREFIX = 'cridora_cache_v1:'

function readEntry(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.savedAt !== 'number' || parsed.data === undefined || parsed.data === null) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Read a cached value regardless of age (for instant hydration). Returns null if missing. */
export function readCache(key) {
  return readEntry(key)?.data ?? null
}

/** Age of the cached value in ms, or Infinity if missing/unreadable. */
export function cacheAge(key) {
  const entry = readEntry(key)
  return entry ? Date.now() - entry.savedAt : Infinity
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* quota exceeded / private mode — safe to ignore, we just skip caching */
  }
}
