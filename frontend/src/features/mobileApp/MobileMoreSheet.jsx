// eslint-disable-next-line no-unused-vars -- motion JSX members
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { sheetSpring, staggerContainer, staggerItem, sereneTap, SERENE_EASE } from '../../lib/sereneMotion'

/**
 * Bottom sheet listing overflow destinations (More tab).
 */
export default function MobileMoreSheet({
  open,
  onClose,
  items = [],
  accent = 'var(--gold)',
  onSelect,
}) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[55] bg-black/70 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: SERENE_EASE }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="fixed inset-x-0 bottom-0 z-[56] md:hidden rounded-t-2xl overflow-hidden"
            style={{
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--nav-border)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              maxHeight: '78dvh',
            }}
            initial={reduce ? { opacity: 1 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? { duration: 0.15 } : sheetSpring}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2 relative">
              <div
                className="mx-auto w-10 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-2"
                style={{ background: 'var(--text-faint)' }}
                aria-hidden
              />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-wide pt-2">
                More
              </h2>
              <motion.button
                type="button"
                aria-label="Close"
                onClick={onClose}
                whileTap={reduce ? undefined : sereneTap}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-soft)] -mr-2"
              >
                <X size={18} />
              </motion.button>
            </div>
            <motion.nav
              className="overflow-y-auto px-2 pb-3"
              style={{ maxHeight: 'calc(78dvh - 3.5rem)' }}
              variants={reduce ? undefined : staggerContainer}
              initial={reduce ? undefined : 'initial'}
              animate={reduce ? undefined : 'animate'}
            >
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    variants={reduce ? undefined : staggerItem}
                    whileTap={reduce ? undefined : sereneTap}
                    onClick={() => onSelect?.(item)}
                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl mb-0.5 text-left min-h-[48px]"
                    style={{ borderLeft: '2px solid transparent' }}
                  >
                    {Icon && (
                      <Icon size={18} className="flex-shrink-0" style={{ color: accent }} />
                    )}
                    <span className="text-sm flex-1 text-[var(--text-soft)]">{item.label}</span>
                    {item.badge > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </motion.nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
