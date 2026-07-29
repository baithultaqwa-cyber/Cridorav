/**
 * Sell-back / Redemptions segment control for the vendor Queues tab (mobile + tablet).
 */
import { motion, useReducedMotion } from 'framer-motion'
import { sereneTap, SERENE_EASE } from '../../lib/sereneMotion'

export default function QueuesSegment({ active, onChange, sellbackCount = 0, redemptionsCount = 0 }) {
  const reduce = useReducedMotion()
  const items = [
    { key: 'sellback', label: 'Sell-back', count: sellbackCount },
    { key: 'redemptions', label: 'Redemptions', count: redemptionsCount },
  ]
  return (
    <div
      className="md:hidden flex p-1 rounded-xl mb-4 gap-1 relative"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}
      role="tablist"
      aria-label="Queues"
    >
      {items.map((item) => {
        const on = active === item.key
        return (
          <motion.button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(item.key)}
            whileTap={reduce ? undefined : sereneTap}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] tracking-widest uppercase font-bold min-h-[44px] z-[1]"
            style={
              on
                ? {
                    color: 'var(--silver)',
                  }
                : { color: 'var(--text-dim)' }
            }
          >
            {on && !reduce && (
              <motion.span
                layoutId="queues-seg-pill"
                className="absolute inset-0 rounded-lg -z-10"
                style={{
                  background: 'color-mix(in srgb, var(--silver) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--silver) 30%, transparent)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            )}
            {on && reduce && (
              <span
                className="absolute inset-0 rounded-lg -z-10"
                style={{
                  background: 'color-mix(in srgb, var(--silver) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--silver) 30%, transparent)',
                }}
              />
            )}
            <motion.span
              animate={reduce ? undefined : { opacity: on ? 1 : 0.75 }}
              transition={{ duration: 0.25, ease: SERENE_EASE }}
            >
              {item.label}
            </motion.span>
            {item.count > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
              >
                {item.count}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
