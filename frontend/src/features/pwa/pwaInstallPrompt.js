/**
 * Capture beforeinstallprompt as early as possible (must preventDefault).
 * Shared across footer help + mobile one-click CTA.
 */
let deferredPrompt = null
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(deferredPrompt)
    } catch {
      /* ignore */
    }
  })
}

export function initPwaInstallCapture() {
  if (typeof window === 'undefined') return
  if (window.__cridoraPwaInstallCapture) return
  window.__cridoraPwaInstallCapture = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null
  notify()
}

export function subscribeDeferredInstallPrompt(fn) {
  listeners.add(fn)
  fn(deferredPrompt)
  return () => listeners.delete(fn)
}

/**
 * Show native install prompt if available.
 * Returns { ok, outcome: 'accepted'|'dismissed'|null, reason }
 */
export async function promptPwaInstall() {
  const deferred = deferredPrompt
  if (!deferred) {
    return { ok: false, outcome: null, reason: 'no_prompt' }
  }
  try {
    await deferred.prompt()
    const choice = await deferred.userChoice
    deferredPrompt = null
    notify()
    return {
      ok: choice?.outcome === 'accepted',
      outcome: choice?.outcome || null,
      reason: null,
    }
  } catch {
    deferredPrompt = null
    notify()
    return { ok: false, outcome: null, reason: 'prompt_failed' }
  }
}
