import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.span / motion.button (JSX member)
import { motion } from 'framer-motion'
import { Coins, Sparkles, ArrowRight } from 'lucide-react'

/**
 * Persistent "Start Investing Now" CTA bar — always `position: fixed` so it
 * shows on every screen size (mobile, tablet, laptop, TV) without needing to
 * scroll to find it, and is rendered outside any `overflow-hidden` ancestor
 * (e.g. the Home hero) so it's never clipped.
 *
 * - `pinned=false`: fixed to the bottom of the viewport — the resting state
 *   used on Home while the hero is still in view.
 * - `pinned=true`: fixed under the navbar (`var(--navbar-h)`, kept in sync by
 *   Navbar.jsx) — used once the Home hero has scrolled past, and by default
 *   on every other public page.
 *
 * Below the `md` (768px) breakpoint the label collapses so the "Buy Gold
 * Now" button always has the full width and its text is never squeezed.
 */
export default function InvestNowBar({ pinned = false, className = '' }) {
  return (
    <div
      className={`invest-now-bar ${pinned ? 'invest-now-bar--pinned' : 'invest-now-bar--bottom'} ${className}`}
    >
      <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* Label — hidden below md so the button always keeps its full width on mobile */}
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <motion.span
            className="flex w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Coins size={16} className="text-[var(--gold)]" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
              Start Investing Now
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
              Buy verified physical gold from UAE dealers in minutes.
            </p>
          </div>
        </div>

        <Link
          to="/marketplace"
          className="relative flex-1 md:flex-initial min-w-0"
          aria-label="Start investing — open the marketplace"
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
            className="btn-gold relative w-full md:w-auto px-4 md:px-7 py-3 rounded-sm text-xs md:text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2 group"
          >
            <Coins size={14} className="md:hidden flex-shrink-0" />
            <Sparkles size={14} className="hidden md:inline flex-shrink-0" />
            <span className="whitespace-nowrap">Buy Gold Now</span>
            <ArrowRight size={14} className="flex-shrink-0 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </Link>
      </div>
    </div>
  )
}
