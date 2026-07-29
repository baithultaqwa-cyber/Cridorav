// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useReducedMotion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { SERENE_EASE } from '../lib/sereneMotion'
import { microHaptic } from '../lib/microHaptic'

/**
 * Wishlist heart with pop + soft ring when favorited.
 */
export default function HeartToggle({
  active,
  onToggle,
  size = 14,
  className = '',
  style,
  'aria-label': ariaLabel = 'Wishlist',
}) {
  const reduce = useReducedMotion()

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation?.()
        if (!active) microHaptic(12)
        onToggle?.()
      }}
      whileTap={reduce ? undefined : { scale: 0.82 }}
      animate={
        reduce
          ? undefined
          : active
            ? { scale: [1, 1.22, 1] }
            : { scale: 1 }
      }
      transition={{ duration: 0.32, ease: SERENE_EASE }}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={style}
    >
      {!reduce && active && (
        <motion.span
          key="ring"
          className="absolute inset-0 rounded-full pointer-events-none"
          initial={{ scale: 0.6, opacity: 0.55 }}
          animate={{ scale: 1.85, opacity: 0 }}
          transition={{ duration: 0.45, ease: SERENE_EASE }}
          style={{ border: '1.5px solid rgba(239,68,68,0.55)' }}
        />
      )}
      <Heart
        size={size}
        className="relative z-[1]"
        style={{
          color: active ? '#EF4444' : '#888',
          fill: active ? '#EF4444' : 'none',
          transition: 'color 0.2s ease, fill 0.2s ease',
        }}
      />
    </motion.button>
  )
}
