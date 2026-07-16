import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.span / motion.button (JSX member)
import { motion } from 'framer-motion'
import { Coins, Sparkles, ArrowRight } from 'lucide-react'

/**
 * Persistent "Start Investing Now" CTA bar.
 *
 * - `pinned=false` (docked): normal flow element — used at the bottom of the
 *   Home hero before the user has scrolled past it.
 * - `pinned=true`: fixed under the navbar (`var(--navbar-h)`, kept in sync by
 *   Navbar.jsx) — used once the docked bar scrolls to the top on Home, and by
 *   default on every other public page.
 *
 * Both variants render at the same `var(--invest-bar-h)` height so spacers
 * placed alongside a pinned instance never cause layout shift.
 */
export default function InvestNowBar({ pinned = false, className = '' }) {
  return (
    <div
      className={`invest-now-bar ${pinned ? 'invest-now-bar--pinned' : 'invest-now-bar--docked'} ${className}`}
    >
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <motion.span
            className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Coins size={16} className="text-[var(--gold)]" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[13px] sm:text-[15px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
              Start Investing Now
            </p>
            <p className="hidden sm:block text-[11px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
              Buy verified physical gold from UAE dealers in minutes.
            </p>
          </div>
        </div>

        <Link to="/marketplace" className="relative flex-shrink-0" aria-label="Start investing — open the marketplace">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-sm pointer-events-none"
            style={{ background: 'rgba(212,168,42,0.4)' }}
            animate={{ scale: [1, 1.22, 1], opacity: [0.55, 0, 0.55] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.96 }}
            className="btn-gold relative px-4 sm:px-7 py-2.5 sm:py-3 rounded-sm text-[11px] sm:text-sm tracking-widest uppercase font-bold flex items-center gap-1.5 sm:gap-2 group"
          >
            <Sparkles size={13} className="hidden sm:inline" />
            <span className="whitespace-nowrap">Buy Gold Now</span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
          </motion.button>
        </Link>
      </div>
    </div>
  )
}
