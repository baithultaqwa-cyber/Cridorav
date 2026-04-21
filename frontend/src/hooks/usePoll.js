import { useEffect, useRef } from 'react'

/**
 * Runs callback every intervalMs. Skips ticks while document is hidden.
 * Refetches when the tab becomes visible again (one immediate run).
 */
export function usePoll(callback, intervalMs, enabled = true) {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return

    const run = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      ref.current()
    }

    const id = setInterval(run, intervalMs)

    const onVis = () => {
      if (!document.hidden) ref.current()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs, enabled])
}
