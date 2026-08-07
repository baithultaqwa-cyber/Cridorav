/**
 * Durable rate ledger client — last known spot + competitor comparisons
 * from Postgres via `/api/rate-ledger/*`. Used when live feed/matrix is down
 * or market is closed so UI keeps showing the last recorded rates.
 */

import {
  API_RATE_LEDGER_LATEST,
  API_MARKET_MATRIX,
} from '../config'
import { writeSpotPriceCache, getTickerSpotData } from './spotPriceCache'

const MATRIX_KEY = 'cridora_market_matrix_v1'
export const MATRIX_UPDATED_EVENT = 'cridora:market-matrix-updated'

export function readMatrixCache() {
  try {
    const raw = localStorage.getItem(MATRIX_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || typeof parsed.savedAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function writeMatrixCache(data) {
  if (!data || typeof data !== 'object') return
  try {
    localStorage.setItem(MATRIX_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(MATRIX_UPDATED_EVENT, { detail: { data } }))
    } catch {
      /* ignore */
    }
  }
}

/**
 * Pull latest durable ledger into local caches (spot + comparison).
 * Safe to call often; no-ops when API fails.
 */
export async function hydrateFromRateLedger() {
  try {
    const res = await fetch(API_RATE_LEDGER_LATEST, { cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    if (body?.spot?.gold) {
      writeSpotPriceCache(body.spot)
    }
    if (body?.comparison?.rows) {
      writeMatrixCache(body.comparison)
    }
    return body
  } catch {
    return null
  }
}

/**
 * Fetch live matrix; on failure return last local / ledger comparison.
 */
export async function fetchMarketMatrixWithFallback() {
  try {
    const res = await fetch(API_MARKET_MATRIX, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data?.rows) writeMatrixCache(data)
      return data
    }
  } catch {
    /* fall through */
  }
  const local = readMatrixCache()?.data
  if (local?.rows?.length) return local
  const ledger = await hydrateFromRateLedger()
  return ledger?.comparison || local || null
}

/** Ensure spot cache has something before first paint consumers run. */
export async function ensureSpotFromLedgerIfEmpty() {
  if (getTickerSpotData()?.gold) return getTickerSpotData()
  const body = await hydrateFromRateLedger()
  return body?.spot || null
}
