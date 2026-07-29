import { useEffect, useState } from 'react'

/** Mobile app chrome breakpoint — matches project rule: viewport &lt; 768px. */
export const MOBILE_APP_MQ = '(max-width: 767px)'

/**
 * True when viewport is phone-sized (&lt; 768px).
 * Used to mount bottom tabs / app shell without affecting desktop layouts.
 */
export function useIsMobileApp() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_APP_MQ).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_APP_MQ)
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return isMobile
}

export function isMobileAppViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_APP_MQ).matches
}
