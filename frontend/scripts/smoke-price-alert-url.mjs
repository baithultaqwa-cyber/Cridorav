/**
 * Smoke assertions for price-alert deep-link helpers (no test runner required).
 * Run: node scripts/smoke-price-alert-url.mjs
 */
import {
  PRICE_COMPARE_PATH,
  buildPriceAlertCompareUrl,
  resolveNotificationNavUrl,
} from '../src/lib/priceAlertCompareUrl.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const up = buildPriceAlertCompareUrl({
  metal: 'gold',
  old_price: 400,
  new_price: 412.5,
  pct: 3.125,
})
assert(up.startsWith(`${PRICE_COMPARE_PATH}?`), 'path')
assert(up.includes('source=price-alert'), 'source')
assert(up.includes('metal=gold'), 'metal')
assert(up.includes('purity=24K'), 'purity')
assert(up.includes('direction=up'), 'direction')
assert(up.includes('previous=400'), 'previous')
assert(up.includes('current=412.5'), 'current')

const legacy = resolveNotificationNavUrl({
  category: 'price_alert',
  url: '/marketplace',
  data: { metal: 'silver', old_price: 5.2, new_price: 5.0, pct: -3.8 },
})
assert(legacy.includes('metal=silver'), 'legacy remap metal')
assert(legacy.includes('direction=down'), 'legacy remap direction')
assert(!legacy.startsWith('/marketplace'), 'legacy not marketplace')

const keep = resolveNotificationNavUrl({
  category: 'order_status',
  url: '/dashboard/customer?section=orders',
  data: {},
})
assert(keep === '/dashboard/customer?section=orders', 'non-price unchanged')

console.log('smoke-price-alert-url: ok')
