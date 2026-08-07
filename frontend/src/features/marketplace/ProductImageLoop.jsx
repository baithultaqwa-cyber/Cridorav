import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { catalogImageUrl } from '../../utils/mediaUrl'

/**
 * Product image gallery: first image by default; slides through gallery while hovered.
 * Pass `playing` to drive from a parent (e.g. whole product card hover).
 */
export default function ProductImageLoop({
  images = [],
  alt = '',
  className = '',
  imgClassName = 'w-full h-full object-cover',
  intervalMs = 1400,
  priority = false,
  fallback = null,
  showDots = true,
  /** When set, parent controls play state (card hover). Otherwise uses own hover. */
  playing: playingProp,
}) {
  const urls = (Array.isArray(images) ? images : [])
    .map((u) => catalogImageUrl(u) || u)
    .filter(Boolean)
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState({})
  const [localHover, setLocalHover] = useState(false)

  const hovering = playingProp !== undefined ? Boolean(playingProp) : localHover
  const canSlide = urls.length >= 2
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  const sliding = canSlide && hovering && !reduceMotion

  useEffect(() => {
    setIdx(0)
    setFailed({})
  }, [urls.join('|')])

  useEffect(() => {
    if (!sliding) {
      setIdx(0)
      return undefined
    }
    const ms = Math.max(900, intervalMs)
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % urls.length)
    }, ms)
    return () => clearInterval(t)
  }, [sliding, urls.length, intervalMs])

  const active = urls[Math.min(idx, Math.max(urls.length - 1, 0))]
  const showFailed = !active || failed[active]

  if (showFailed) {
    return fallback || (
      <div className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0A0A0A] ${className}`}>
        <Package size={28} className="text-[#444]" />
      </div>
    )
  }

  const showDotBar = showDots && canSlide && (playingProp !== undefined ? hovering : true)

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => playingProp === undefined && setLocalHover(true)}
      onMouseLeave={() => playingProp === undefined && setLocalHover(false)}
    >
      <div
        className="absolute inset-0 flex h-full will-change-transform"
        style={{
          width: `${urls.length * 100}%`,
          transform: `translateX(-${(idx / urls.length) * 100}%)`,
          transition: sliding
            ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'none',
        }}
      >
        {urls.map((src, i) => (
          <div
            key={src + i}
            className="relative h-full shrink-0"
            style={{ width: `${100 / urls.length}%` }}
          >
            <img
              src={src}
              alt={i === idx ? alt : ''}
              onError={() => setFailed((f) => ({ ...f, [src]: true }))}
              className={`${imgClassName} absolute inset-0`}
              loading={priority && i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority && i === 0 ? 'high' : 'auto'}
              aria-hidden={i !== idx}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {showDotBar && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 pointer-events-none">
          {urls.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className="w-1.5 h-1.5 rounded-full transition-opacity"
              style={{
                background: i === idx ? 'var(--gold)' : 'rgba(255,255,255,0.35)',
                opacity: i === idx ? 1 : 0.7,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
