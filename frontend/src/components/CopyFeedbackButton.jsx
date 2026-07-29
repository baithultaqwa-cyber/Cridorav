import { useEffect, useState } from 'react'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { sereneTap, SERENE_EASE } from '../lib/sereneMotion'
import { microHaptic } from '../lib/microHaptic'

/**
 * Copy-to-clipboard microinteraction: press → success check pop.
 */
export default function CopyFeedbackButton({
  value,
  idleLabel = 'Copy',
  doneLabel = 'Copied',
  className = '',
  style,
  onCopied,
}) {
  const [done, setDone] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!done) return undefined
    const t = window.setTimeout(() => setDone(false), 1600)
    return () => window.clearTimeout(t)
  }, [done])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''))
      setDone(true)
      microHaptic(10)
      onCopied?.()
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.button
      type="button"
      onClick={copy}
      whileTap={reduce ? undefined : sereneTap}
      className={`inline-flex items-center justify-center gap-1.5 ${className}`}
      style={style}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span
            key="done"
            className="inline-flex items-center gap-1.5 text-emerald-400"
            initial={reduce ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22, ease: SERENE_EASE }}
          >
            <Check size={12} strokeWidth={2.5} />
            {doneLabel}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            className="inline-flex items-center gap-1.5"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18, ease: SERENE_EASE }}
          >
            <Copy size={11} />
            {idleLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
