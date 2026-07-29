import { useReducedMotion } from 'framer-motion'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { pageEnter, pageEnterReduced } from '../lib/sereneMotion'

/**
 * Soft fade/slide on route (or `animKey`) change — enter-only so it plays
 * nicely with React Router (no exit/remount fight).
 */
export default function SerenePage({ children, className = '', animKey }) {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()
  const key = animKey ?? pathname
  const variants = reduce ? pageEnterReduced : pageEnter

  return (
    <motion.div
      key={key}
      className={className}
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
    >
      {children}
    </motion.div>
  )
}
