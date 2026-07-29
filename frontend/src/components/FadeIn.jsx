import { useReducedMotion } from 'framer-motion'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div (JSX member)
import { motion } from 'framer-motion'

const OFFSETS = {
  up: { y: 18, x: 0 },
  down: { y: -14, x: 0 },
  left: { y: 0, x: 18 },
  right: { y: 0, x: -18 },
}

/**
 * Scroll-reveal for marketing sections.
 * Uses a short travel + once-only whileInView so fast scrolling never leaves
 * blank regions. Honors prefers-reduced-motion.
 */
export default function FadeIn({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  duration = 0.5,
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
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -8% 0px' }}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
