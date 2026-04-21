function stripTrailingSlash(s) {
  return (s || '').replace(/\/$/, '')
}

function isLocalhostOrigin(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test((url || '').trim())
}

/**
 * Railway: `myapp-frontend-production.up.railway.app` → `https://myapp-production.up.railway.app`
 * (replace the first `-frontend-` in the subdomain with `-`).
 */
function inferRailwaySiblingApiHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return null
  if (!/\.up\.railway\.app$/i.test(hostname)) return null
  const sub = hostname.replace(/\.up\.railway\.app$/i, '')
  if (!sub.includes('-frontend-')) return null
  const apiSub = sub.replace('-frontend-', '-')
  if (apiSub === sub) return null
  return `https://${apiSub}.up.railway.app`
}

/**
 * API base URL: runtime override → Vite env (ignored if localhost in prod) → Railway inference → dev default.
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
    const v = stripTrailingSlash(String(vite))
    // Wrong: VITE baked as localhost from template while site is on Railway → ignore in prod
    if (!(import.meta.env.PROD && isLocalhostOrigin(v))) {
      return v
    }
  }
  if (typeof window !== 'undefined') {
    const inferred = inferRailwaySiblingApiHostname(window.location.hostname)
    if (inferred) return inferred
  }
  return 'http://127.0.0.1:8000'
}

export const API_ORIGIN = resolveApiOrigin()

export const API_AUTH_BASE = `${API_ORIGIN}/api/auth`
export const API_SPOT_PRICES = `${API_ORIGIN}/api/spot-prices`
export const API_DUBAI_RETAIL_RATES = `${API_ORIGIN}/api/dubai-retail-rates`

/** Until a real PSP is integrated: unset or `true` → show simulated payment copy. Set `false` when live. */
export const USE_SIMULATED_PAYMENT =
  import.meta.env.VITE_SIMULATED_PAYMENT == null ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === 'true' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '1'
