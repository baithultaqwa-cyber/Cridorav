/**
 * Optional soft haptic for micro-feedback on capable devices.
 * No-ops when reduced motion is preferred or vibrate is unavailable.
 */
export function microHaptic(ms = 8) {
  if (typeof window === 'undefined') return
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* ignore */
  }
}
