/**
 * Shared client cache for the public platform buy/sell fee % (`/api/auth/platform-fees/`).
 *
 * Backed by the generic `apiCache` localStorage layer so any page (the comparison
 * tool, the homepage teaser, etc.) can read the same cached value instantly instead
 * of each firing its own request.
 */

import { API_AUTH_BASE } from '../config'
import { cacheAge, readCache, writeCache } from './apiCache'

export const PLATFORM_FEE_CACHE_KEY = 'platform_fees_v1'

/** Fee % changes rarely — a recent cached value is good enough, skip refetching within this window. */
export const PLATFORM_FEE_FRESH_MS = 5 * 60 * 1000

export function readCachedPlatformFees() {
  return readCache(PLATFORM_FEE_CACHE_KEY)
}

export function platformFeeCacheAge() {
  return cacheAge(PLATFORM_FEE_CACHE_KEY)
}

export async function fetchPlatformFees() {
  const res = await fetch(`${API_AUTH_BASE}/platform-fees/`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  writeCache(PLATFORM_FEE_CACHE_KEY, data)
  return data
}
