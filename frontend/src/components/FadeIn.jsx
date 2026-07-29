import { useReducedMotion } from 'framer-motion'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div (JSX member)
import { motion } from 'framer-motion'
import { SERENE_EASE } from '../lib/sereneMotion'

const OFFSETS = {
  up: { y: 12, x: 0 },
  down: { y: -10, x: 0 },
  left: { y: 0, x: 12 },
  right: { y: 0, x: -12 },
}

/**
 * Scroll-reveal for marketing / long pages.
 * Soft travel, once-only whileInView. Honors prefers-reduced-motion.
 */
export default function FadeIn({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.55,
}) {
  const reduceMotion = useReducedMotion()
  const offset = OFFSETS[direction] || OFFSETS.up

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.14, margin: '0px 0px -6% 0px' }}
      transition={{
        duration,
        delay,
        ease: SERENE_EASE,
      }}
    >
      {children}
    </motion.div>
  )
}
