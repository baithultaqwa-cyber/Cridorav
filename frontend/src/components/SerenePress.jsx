import { useReducedMotion } from 'framer-motion'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion } from 'framer-motion'
import { sereneHover, sereneTap } from '../lib/sereneMotion'

/**
 * Calm press / hover feedback for interactive surfaces.
 * Renders as motion.button by default; set `as="div"` for wrapping links.
 */
export default function SerenePress({
  children,
  className = '',
  style,
  as = 'button',
  type = 'button',
  hover = true,
  disabled = false,
  onClick,
  ...rest
}) {
  const reduce = useReducedMotion()
  const Comp = as === 'div' ? motion.div : motion.button

  if (reduce) {
    if (as === 'div') {
      return (
        <div className={className} style={style} onClick={onClick} {...rest}>
          {children}
        </div>
      )
    }
    return (
      <button type={type} className={className} style={style} disabled={disabled} onClick={onClick} {...rest}>
        {children}
      </button>
    )
  }

  const props = {
    className,
    style,
    onClick,
    whileTap: disabled ? undefined : sereneTap,
    whileHover: hover && !disabled ? sereneHover : undefined,
    ...rest,
  }

  if (as === 'div') {
    return <Comp {...props}>{children}</Comp>
  }

  return (
    <Comp type={type} disabled={disabled} {...props}>
      {children}
    </Comp>
  )
}
