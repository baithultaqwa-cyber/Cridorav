function stripTrailingSlash(s) {
  return (s || '').replace(/\/$/, '')
}

/**
 * Railway: frontend like `myapp-frontend-production.up.railway.app` often pairs with
 * `myapp-production.up.railway.app` for the API. Used when VITE_API_ORIGIN was missing at build.
 */
function inferRailwaySiblingApiHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return null
  const m = hostname.match(/^([a-z0-9-]+)-frontend-(production)\.up\.railway\.app$/i)
  if (!m) return null
  return `https://${m[1]}-${m[2]}.up.railway.app`
}

/**
 * API base URL: runtime override → Vite env → Railway sibling name → local dev default.
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
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    const inferred = inferRailwaySiblingApiHostname(window.location.hostname)
    if (inferred) return inferred
  }
  return 'http://127.0.0.1:8000'
}

export const API_ORIGIN = resolveApiOrigin()

export const API_AUTH_BASE = `${API_ORIGIN}/api/auth`
export const API_SPOT_PRICES = `${API_ORIGIN}/api/spot-prices`

/** True when production bundle still targets localhost (for clearer UI copy). */
export function apiOriginLooksLikeDevDefault() {
  if (!import.meta.env.PROD) return false
  if (/\.up\.railway\.app$/i.test(API_ORIGIN)) return false
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(API_ORIGIN)
}

/** Until a real PSP is integrated: unset or `true` → show simulated payment copy. Set `false` when live. */
export const USE_SIMULATED_PAYMENT =
  import.meta.env.VITE_SIMULATED_PAYMENT == null ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === 'true' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '1'
