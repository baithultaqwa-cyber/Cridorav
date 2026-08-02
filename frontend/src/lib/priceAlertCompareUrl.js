/**
 * Canonical deep link for price-movement notifications → UAE comparison tool.
 * Also remaps legacy alerts that still point at /marketplace.
 */

export const PRICE_COMPARE_PATH = '/tools/uae-digital-gold-comparison'

function defaultPurity(metal) {
  return String(metal || '').toLowerCase() === 'silver' ? '999' : '24K'
}

function fmtNum(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return String(Number(n.toFixed(4)))
}

/**
 * @param {{ metal?: string, old_price?: number, new_price?: number, pct?: number, direction?: string, purity?: string, prices?: Record<string, number>, manual?: boolean }} [data]
 */
export function buildPriceAlertCompareUrl(data = {}) {
  const params = new URLSearchParams()
  params.set('source', 'price-alert')

  let metal = String(data.metal || '').toLowerCase()
  if (!metal && data.prices && typeof data.prices === 'object') {
    metal = data.prices.gold != null ? 'gold' : Object.keys(data.prices)[0] || ''
  }
  if (metal === 'gold' || metal === 'silver') {
    params.set('metal', metal)
    params.set('purity', data.purity || defaultPurity(metal))
  }

  let current = data.new_price
  if (current == null && data.prices && metal && data.prices[metal] != null) {
    current = data.prices[metal]
  }
  const previous = data.old_price
  const curStr = fmtNum(current)
  const prevStr = fmtNum(previous)
  if (prevStr != null) params.set('previous', prevStr)
  if (curStr != null) params.set('current', curStr)

  let direction = data.direction
  if (!direction && previous != null && current != null) {
    direction = Number(current) >= Number(previous) ? 'up' : 'down'
  }
  if (direction === 'up' || direction === 'down') params.set('direction', direction)

  const pctStr = fmtNum(data.pct)
  if (pctStr != null) params.set('pct', pctStr)
  if (data.manual) params.set('manual', '1')

  const qs = params.toString()
  return qs ? `${PRICE_COMPARE_PATH}?${qs}` : PRICE_COMPARE_PATH
}

function isMarketplaceUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]
    return path === '/marketplace' || path === '/marketplace/'
  } catch {
    return url === '/marketplace' || url.startsWith('/marketplace?')
  }
}

/**
 * Resolve navigation target for a notification / push payload.
 * Remaps legacy price_alert → /marketplace to the comparison tool.
 */
export function resolveNotificationNavUrl(n) {
  if (!n) return '/'
  const category = n.category || ''
  const data = n.data || {}
  const url = n.url || ''
  if (category === 'price_alert' && (isMarketplaceUrl(url) || !url)) {
    return buildPriceAlertCompareUrl(data)
  }
  return url || '/'
}
