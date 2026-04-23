/** Fired when metal/listing prices or public spot display may have changed (vendor, admin, or same user elsewhere). */
export const PRICES_REFRESH_EVENT = 'cridora:prices-refresh'

const BC_NAME = 'cridora-prices-v1'

function getBroadcastChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(BC_NAME)
  } catch {
    return null
  }
}

/**
 * Notify all open tabs/windows to refetch prices immediately (no full page reload).
 * @param {Record<string, unknown>} [detail]
 */
export function broadcastPricesRefresh(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(PRICES_REFRESH_EVENT, { detail }))
  const ch = getBroadcastChannel()
  if (ch) {
    try {
      ch.postMessage({ type: 'refresh', ...detail })
    } catch {
      /* ignore */
    }
    ch.close()
  }
}

/**
 * @param {(detail: Record<string, unknown>) => void} handler
 * @returns {() => void}
 */
export function subscribePricesRefresh(handler) {
  if (typeof window === 'undefined') return () => {}

  const onWin = (ev) => {
    handler(ev.detail && typeof ev.detail === 'object' ? ev.detail : {})
  }
  window.addEventListener(PRICES_REFRESH_EVENT, onWin)

  let bc = null
  const onBc = (ev) => {
    handler(ev.data && typeof ev.data === 'object' ? ev.data : {})
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(BC_NAME)
      bc.onmessage = onBc
    }
  } catch {
    /* ignore */
  }

  return () => {
    window.removeEventListener(PRICES_REFRESH_EVENT, onWin)
    try {
      bc?.close()
    } catch {
      /* ignore */
    }
  }
}
