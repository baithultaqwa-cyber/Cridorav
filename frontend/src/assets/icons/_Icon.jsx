import { forwardRef, useImperativeHandle } from 'react'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useAnimation, useReducedMotion } from 'framer-motion'
import { SERENE_EASE } from '../../lib/sereneMotion'

function preferHover() {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * Local Lucide-style SVG renderer (assets in this folder, no CDN).
 */
const CridoraIcon = forwardRef(function CridoraIcon(
  {
    size = 24,
    strokeWidth = 2,
    color,
    className,
    style,
    animateOnHover,
    fill,
    children,
    ...rest
  },
  ref,
) {
  const reduce = useReducedMotion()
  const controls = useAnimation()
  useImperativeHandle(ref, () => ({
    startAnimation: () => {
      if (!reduce) controls.start('pop')
    },
    stopAnimation: () => controls.start('idle'),
  }))

  const hoverOn = animateOnHover ?? preferHover()
  // Stroke via CSS — not SVG attrs — so Framer Motion does not snapshot
  // currentColor on first paint (that left tab icons stuck on the first accent).
  const strokeColor = color || 'currentColor'

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill || 'none'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        color: color || undefined,
        stroke: strokeColor,
        strokeWidth,
        ...style,
      }}
      variants={{
        idle: { scale: 1 },
        pop: {
          scale: [1, 1.08, 1],
          transition: { duration: 0.34, ease: SERENE_EASE },
        },
      }}
      initial="idle"
      animate={controls}
      whileHover={reduce || !hoverOn ? undefined : 'pop'}
      {...rest}
    >
      {children}
    </motion.svg>
  )
})

export default CridoraIcon
