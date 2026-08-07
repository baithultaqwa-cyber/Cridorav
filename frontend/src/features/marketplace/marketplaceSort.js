/** Marketplace listing sort keys + comparators. */

export const MARKETPLACE_SORT_OPTIONS = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'wishlist-first', label: 'Wishlist first' },
  { value: 'price-asc', label: 'Total price: Low → High' },
  { value: 'price-desc', label: 'Total price: High → Low' },
  { value: 'rate-asc', label: 'AED / g: Low → High' },
  { value: 'rate-desc', label: 'AED / g: High → Low' },
  { value: 'buyback-desc', label: 'Sell-back / g: High → Low' },
  { value: 'buyback-asc', label: 'Sell-back / g: Low → High' },
  { value: 'packing-asc', label: 'Packaging: Low → High' },
  { value: 'packing-desc', label: 'Packaging: High → Low' },
  { value: 'grams-asc', label: 'Weight (g): Low → High' },
  { value: 'grams-desc', label: 'Weight (g): High → Low' },
  { value: 'purity-desc', label: 'Purity: High → Low' },
  { value: 'purity-asc', label: 'Purity: Low → High' },
]

const SORT_KEYS = new Set(MARKETPLACE_SORT_OPTIONS.map((o) => o.value))

/** Normalize `?sort=` from URL (supports legacy `price`). */
export function parseMarketplaceSort(raw) {
  const s = String(raw || '').toLowerCase().trim()
  if (s === 'price') return 'price-asc'
  return SORT_KEYS.has(s) ? s : 'default'
}

/**
 * Map purity labels to a comparable fineness score (≈ parts per thousand).
 * 24K → 999.9, 22K → 916.6, "999" → 999, bare numbers as millesimal.
 */
export function purityScore(purity) {
  if (purity == null || purity === '') return 0
  const p = String(purity).trim().toUpperCase()
  const karat = p.match(/^(\d+(?:\.\d+)?)\s*K/)
  if (karat) {
    const k = parseFloat(karat[1])
    if (Number.isFinite(k) && k > 0) return Math.round((k / 24) * 999.9 * 10) / 10
  }
  const milli = p.match(/^(\d+(?:\.\d+)?)/)
  if (milli) {
    const n = parseFloat(milli[1])
    if (Number.isFinite(n)) {
      if (n > 0 && n <= 1) return Math.round(n * 1000 * 10) / 10
      return n
    }
  }
  return 0
}

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function totalPrice(item) {
  return num(item.ratePerGram) * num(item.totalGrams)
}

/**
 * Compare two marketplace listings for the active sort key.
 * @returns {number} sort comparator result
 */
export function compareMarketplaceListings(a, b, sort, wishlistIds = []) {
  switch (sort) {
    case 'wishlist-first': {
      const aW = wishlistIds.includes(a.id) ? 1 : 0
      const bW = wishlistIds.includes(b.id) ? 1 : 0
      return bW - aW
    }
    case 'price-asc':
      return totalPrice(a) - totalPrice(b)
    case 'price-desc':
      return totalPrice(b) - totalPrice(a)
    case 'rate-asc':
      return num(a.ratePerGram) - num(b.ratePerGram)
    case 'rate-desc':
      return num(b.ratePerGram) - num(a.ratePerGram)
    case 'buyback-desc':
      return num(b.buybackPerGram) - num(a.buybackPerGram)
    case 'buyback-asc':
      return num(a.buybackPerGram) - num(b.buybackPerGram)
    case 'packing-asc':
      return num(a.packagingFee) - num(b.packagingFee)
    case 'packing-desc':
      return num(b.packagingFee) - num(a.packagingFee)
    case 'grams-asc':
      return num(a.totalGrams) - num(b.totalGrams)
    case 'grams-desc':
      return num(b.totalGrams) - num(a.totalGrams)
    case 'purity-desc':
      return purityScore(b.purity) - purityScore(a.purity)
    case 'purity-asc':
      return purityScore(a.purity) - purityScore(b.purity)
    default:
      return 0
  }
}
