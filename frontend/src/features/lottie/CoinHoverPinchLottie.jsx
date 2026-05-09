import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'

const LOTTIE_SRC = '/wired-flat-290-coin-hover-pinch.json'

/**
 * Brand-tuned wired-flat coin Lottie (see scripts/patch_lottie_coin.py).
 */
export default function CoinHoverPinchLottie({
  className = '',
  loop = true,
  ariaHidden = true,
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop,
      autoplay: true,
      path: LOTTIE_SRC,
    })
    return () => {
      anim.destroy()
    }
  }, [loop])

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden={ariaHidden}
    />
  )
}
