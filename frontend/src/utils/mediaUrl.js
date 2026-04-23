import { API_ORIGIN } from '../config'

/**
 * Resolve catalog product image URLs so <img> loads from the API host.
 * Fixes relative /media/... (would otherwise hit the Vite dev server or wrong Railway host)
 * and rewrites absolute URLs that already point at /media/... to API_ORIGIN.
 */
export function catalogImageUrl(url) {
  if (url == null) return null
  const s = String(url).trim()
  if (s === '') return null
  const base = stripTrailingSlash(API_ORIGIN)

  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s)
      if (u.pathname.startsWith('/media/')) {
        return `${base}${u.pathname}${u.search}${u.hash}`
      }
      return s
    }
  } catch {
    return s
  }

  if (s.startsWith('/')) {
    return `${base}${s}`
  }
  return s
}

function stripTrailingSlash(x) {
  return x.replace(/\/$/, '')
}

/** Apply catalogImageUrl to a vendor catalog row from the API. */
export function withResolvedCatalogImage(product) {
  if (!product || typeof product !== 'object') return product
  return { ...product, image_url: catalogImageUrl(product.image_url) }
}
