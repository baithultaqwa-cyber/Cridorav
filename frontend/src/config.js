const origin = (import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:8000').replace(/\/$/, '')

export const API_AUTH_BASE = `${origin}/api/auth`
export const API_SPOT_PRICES = `${origin}/api/spot-prices`
