/**
 * Shared spot-price cache — written by SpotPriceTicker (sole live fetch),
 * read by every other surface so Cridora rates match the on-page ticker.
 *
 * Shape: localStorage `cridora_spot_prices_v1` → `{ savedAt, data }`
 */

import { useCallback, useEffect, useState } from 'react'

const CACHE_KEY = 'cridora_spot_prices_v1'

/** Dispatched (same tab) whenever the ticker writes a fresh payload. */
export const SPOT_TICKER_UPDATED_EVENT = 'cridora:spot-ticker-updated'

/** Informational — ticker owns freshness; consumers should not network-fetch. */
export const SPOT_FRESH_MS = 20 * 1000

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

/**
 * Persist ticker payload and notify same-tab subscribers.
 * Only SpotPriceTicker should call this after a live `/api/spot-prices` response.
 */
export function writeSpotPriceCache(data) {
  if (!data || typeof data !== 'object') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* quota exceeded / private mode */
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(SPOT_TICKER_UPDATED_EVENT, { detail: { data } }))
    } catch {
      /* ignore */
    }
  }
}

/** Latest ticker payload object, or null. */
export function getTickerSpotData() {
  return readEntry()?.data ?? null
}

/**
 * React hook: always mirrors the on-page ticker cache (no network fetch).
 * @returns {{ data: object|null, savedAt: number|null, refreshFromCache: () => void }}
 */
export function useTickerSpotPrices() {
  const [entry, setEntry] = useState(() => readEntry())

  const refreshFromCache = useCallback(() => {
    setEntry(readEntry())
  }, [])

  useEffect(() => {
    const onTicker = (ev) => {
      const data = ev?.detail?.data
      if (data && typeof data === 'object') {
        setEntry({ savedAt: Date.now(), data })
        return
      }
      setEntry(readEntry())
    }
    const onStorage = (ev) => {
      if (ev.key === CACHE_KEY) setEntry(readEntry())
    }
    window.addEventListener(SPOT_TICKER_UPDATED_EVENT, onTicker)
    window.addEventListener('storage', onStorage)
    // Re-read once on mount in case ticker wrote between first paint and subscribe.
    setEntry(readEntry())
    return () => {
      window.removeEventListener(SPOT_TICKER_UPDATED_EVENT, onTicker)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return {
    data: entry?.data ?? null,
    savedAt: entry?.savedAt ?? null,
    refreshFromCache,
  }
}
