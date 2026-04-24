/**
 * Guest marketplace wishlist: listing ids as shown in the UI (e.g. "live-12" or numeric fallback).
 * Logged-in users sync catalog product ids via the API; only `live-*` ids map to the server.
 */
const GUEST_WISHLIST_KEY = 'cridora_wishlist_listing_ids'

export function readGuestWishlist() {
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY)
    if (raw == null) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function writeGuestWishlist(listingIds) {
  try {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(listingIds))
  } catch {
    // Private mode or quota; ignore
  }
}

export function clearGuestWishlist() {
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY)
  } catch {
    // ignore
  }
}

/** @param {(string|number)[]} listingIds @returns {number[]} */
export function listingIdsToProductIds(listingIds) {
  const out = []
  for (const id of listingIds) {
    if (typeof id === 'string' && id.startsWith('live-')) {
      const n = Number.parseInt(id.slice(5), 10)
      if (Number.isFinite(n)) out.push(n)
    }
  }
  return out
}

/** @param {number[]|unknown} productIds @returns {string[]} */
export function productIdsToLiveListingIds(productIds) {
  if (!Array.isArray(productIds)) return []
  return productIds.map((id) => `live-${Number(id)}`)
}
