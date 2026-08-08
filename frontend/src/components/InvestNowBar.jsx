import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.span / motion.button (JSX member)
import { motion } from 'framer-motion'
import { Coins, Sparkles, ArrowRight } from 'lucide-react'

const textGlow = {
  textShadow: [
    '0 0 0px rgba(255,244,214,0)',
    '0 0 10px rgba(255,244,214,0.9), 0 0 18px rgba(255,205,90,0.7)',
    '0 0 0px rgba(255,244,214,0)',
  ],
}

/**
 * "Gold Prices Move Daily" CTA — fixed under the navbar on non-home pages,
 * and on Home only after the hero has scrolled away (hero already has Buy).
 *
 * - `pinned=true`: under `var(--navbar-h)` (Navbar keeps that var in sync).
 * - `pinned=false`: legacy bottom dock (unused on Home now).
 */
export default function InvestNowBar({ pinned = false, className = '' }) {
  return (
    <div
      className={`invest-now-bar ${pinned ? 'invest-now-bar--pinned' : 'invest-now-bar--bottom'} ${className}`}
    >
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 md:gap-3">
        {/* Label — condensed on mobile (headline only), full on tablet/desktop/TV */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <motion.span
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(232,195,74,0.12)', border: '1px solid rgba(232,195,74,0.3)' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Coins size={16} className="text-[var(--gold)]" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[12px] md:text-[15px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
              Gold Prices Move Daily
            </p>
            <p className="hidden md:block text-[11px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
              Buy verified physical gold from licensed UAE dealers — at UAE&apos;s lowest rates, in minutes.
            </p>
          </div>
        </div>

        <Link
          to="/marketplace"
          className="relative flex-shrink-0"
          aria-label="Lock in today's gold rate — open the marketplace"
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-sm pointer-events-none"
            style={{ background: 'rgba(212,168,42,0.4)' }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="btn-gold relative flex items-center justify-center gap-1 md:gap-2 group"
          >
            <Sparkles size={12} className="flex-shrink-0" />
            <motion.span
              className="whitespace-nowrap"
              animate={textGlow}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Lock In Today&apos;s Rate
            </motion.span>
            <ArrowRight size={12} className="flex-shrink-0 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </Link>
      </div>
    </div>
  )
}
