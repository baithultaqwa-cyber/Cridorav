function stripTrailingSlash(s) {
  return (s || '').replace(/\/$/, '')
}

/**
 * API base URL: build-time `VITE_API_ORIGIN`, or runtime `window.__CRIDORA_API_ORIGIN__` (set in index.html before the app loads), else local dev default.
 */
function resolveApiOrigin() {
  if (typeof window !== 'undefined') {
    const w = window.__CRIDORA_API_ORIGIN__
    if (w != null && String(w).trim() !== '') {
      return stripTrailingSlash(String(w))
    }
  }
  const vite = import.meta.env.VITE_API_ORIGIN
  if (vite != null && String(vite).trim() !== '') {
    return stripTrailingSlash(String(vite))
  }
  return 'http://127.0.0.1:8000'
}

export const API_ORIGIN = resolveApiOrigin()

export const API_AUTH_BASE = `${API_ORIGIN}/api/auth`
export const API_SPOT_PRICES = `${API_ORIGIN}/api/spot-prices`

/** True when production bundle still targets localhost (for clearer UI copy). */
export function apiOriginLooksLikeDevDefault() {
  if (!import.meta.env.PROD) return false
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(API_ORIGIN)
}

/** Until a real PSP is integrated: unset or `true` → show simulated payment copy. Set `false` when live. */
export const USE_SIMULATED_PAYMENT =
  import.meta.env.VITE_SIMULATED_PAYMENT == null ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === 'true' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '1'
