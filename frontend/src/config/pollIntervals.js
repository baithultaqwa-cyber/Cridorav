/**
 * Central HTTP polling intervals (ms). Tuned for ~1000 concurrent users: faster UX
 * where it matters, lighter polling when idle. Server caches (e.g. spot prices) still
 * cap freshness — see backend CACHE_TTL for metals APIs.
 */

/** Payment + sell-status pages until terminal state */
export const ORDER_FLOW_POLL_MS = 400

/** Vendor Live Sales Desk — pending buy orders + sell-backs */
export const VENDOR_DESK_POLL_MS = 400

/** Customer dashboard: portfolio / settings / no in-flight buy */
export const CUSTOMER_DASH_POLL_IDLE_MS = 1200

/** Customer dashboard: KYC still pending — faster until verified/rejected */
export const CUSTOMER_DASH_POLL_KYC_PENDING_MS = 700

/** Customer dashboard: Orders tab OR awaiting vendor / payment */
export const CUSTOMER_DASH_POLL_ACTIVE_MS = 400

/** Admin dashboard (low concurrency — a few staff) */
export const ADMIN_DASH_POLL_MS = 700

/** Vendor dashboard — stats, catalog, pricing (not the desk strip) */
export const VENDOR_DASH_POLL_MS = 1000

/** Homepage spot ticker (backend caches ~30s; client can poll a bit faster for cache bust) */
export const SPOT_TICKER_POLL_MS = 5000

/** Dubai retail strip (server caches ~2min) */
export const RETAIL_STRIP_POLL_MS = 30_000

/** Marketplace listing + quote metadata */
export const MARKETPLACE_POLL_MS = 2000

export function customerHasInFlightBuyOrder(orders) {
  if (!Array.isArray(orders)) return false
  return orders.some(
    (o) =>
      o.type === 'BUY' &&
      (o.raw_status === 'pending_vendor' || o.raw_status === 'vendor_accepted'),
  )
}
