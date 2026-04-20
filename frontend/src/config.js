const origin = (import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:8000').replace(/\/$/, '')

export const API_AUTH_BASE = `${origin}/api/auth`
export const API_SPOT_PRICES = `${origin}/api/spot-prices`

/** Until a real PSP is integrated: unset or `true` → show simulated payment copy. Set `false` when live. */
export const USE_SIMULATED_PAYMENT =
  import.meta.env.VITE_SIMULATED_PAYMENT == null ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === 'true' ||
  import.meta.env.VITE_SIMULATED_PAYMENT === '1'
