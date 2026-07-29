import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Instant scroll-to-top on route change (no jarring smooth scroll mid-SPA).
 * Softens the edge with a brief fade on document.documentElement when motion is OK.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const prev = useRef(pathname)

  useEffect(() => {
    const changed = prev.current !== pathname
    prev.current = pathname
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

    if (!changed) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const root = document.documentElement
    root.classList.add('serene-route-flash')
    const t = window.setTimeout(() => root.classList.remove('serene-route-flash'), 420)
    return () => {
      window.clearTimeout(t)
      root.classList.remove('serene-route-flash')
    }
  }, [pathname])

  return null
}
