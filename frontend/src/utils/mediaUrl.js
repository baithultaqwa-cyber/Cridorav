import { API_ORIGIN } from '../config'

/**
 * When the site is served over https, `http://` media URLs (e.g. from an API
 * that still echoes http) are blocked as mixed content — upgrade to https.
 */
function forceHttpsForMediaInProd(absoluteUrl) {
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return absoluteUrl
  }
  if (window.location?.protocol !== 'https:') {
    return absoluteUrl
  }
  if (absoluteUrl.startsWith('http://') && absoluteUrl.includes('/media/')) {
    return `https://${absoluteUrl.slice('http://'.length)}`
  }
  return absoluteUrl
}

/**
 * Resolve catalog product image URLs so <img> loads from the API host.
 * Fixes relative /media/... (would otherwise hit the Vite dev server or wrong Railway host)
 * and rewrites absolute URLs that already point at /media/... to API_ORIGIN.
 * Also handles protocol-relative // URLs and https upgrades for /media/ in production.
 */
export function catalogImageUrl(url) {
  if (url == null) return null
  let s = String(url).trim()
  if (s === '') return null

  if (s.startsWith('//')) {
    s = `https:${s}`
  }

  const base = stripTrailingSlash(API_ORIGIN)

  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s)
      if (u.pathname.startsWith('/media/')) {
        s = `${base}${u.pathname}${u.search}${u.hash}`
        return forceHttpsForMediaInProd(s)
      }
      return forceHttpsForMediaInProd(s)
    }
  } catch {
    if (s.startsWith('/')) {
      return forceHttpsForMediaInProd(`${base}${s}`)
    }
    return s
  }

  if (s.startsWith('/')) {
    return forceHttpsForMediaInProd(`${base}${s}`)
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
