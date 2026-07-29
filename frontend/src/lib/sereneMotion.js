/**
 * Shared calm motion tokens for Cridora (site-wide).
 * Soft travel, short durations, opacity-first — serene, not flashy.
 * All consumers must honor prefers-reduced-motion via useReducedMotion().
 */

export const SERENE_EASE = [0.22, 1, 0.36, 1]

export const sereneTransition = {
  duration: 0.48,
  ease: SERENE_EASE,
}

export const sereneQuick = {
  duration: 0.28,
  ease: SERENE_EASE,
}

export const sereneTap = {
  scale: 0.97,
  transition: { duration: 0.12, ease: SERENE_EASE },
}

/** Gentler press for bottom tab bar — avoids fighting layoutId springs */
export const sereneTabTap = {
  scale: 0.988,
  transition: { duration: 0.22, ease: SERENE_EASE },
}

export const sereneHover = {
  scale: 1.015,
  transition: { duration: 0.28, ease: SERENE_EASE },
}

/** Soft page / section enter */
export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: sereneTransition,
}

export const pageEnterReduced = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
  transition: { duration: 0 },
}

/** Scroll-reveal defaults (marketing + cards) */
export const revealOffset = { y: 12, x: 0 }

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.04,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: sereneQuick,
  },
}

export const sheetSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 34,
  mass: 0.9,
}

export const tabIndicatorSpring = {
  type: 'spring',
  stiffness: 280,
  damping: 34,
  mass: 0.85,
}
