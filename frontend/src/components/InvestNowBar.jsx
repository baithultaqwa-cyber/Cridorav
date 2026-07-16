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
 * Below the `md` (768px) breakpoint the label shrinks to just the headline
 * (no icon/subtitle) and the button shrinks too, so both fit side by side
 * without clipping.
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
            style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Coins size={16} className="text-[var(--gold)]" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-[12px] md:text-[15px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
              Start Investing Now
            </p>
            <p className="hidden md:block text-[11px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
              Buy verified physical gold from UAE dealers in minutes.
            </p>
          </div>
        </div>

        <Link
          to="/marketplace"
          className="relative flex-shrink-0"
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
            className="btn-gold relative px-3 md:px-7 py-2 md:py-3 rounded-sm text-[10px] md:text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-1 md:gap-2 group"
          >
            <Sparkles size={12} className="flex-shrink-0" />
            <motion.span
              className="whitespace-nowrap"
              animate={textGlow}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Buy Gold Now
            </motion.span>
            <ArrowRight size={12} className="flex-shrink-0 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </Link>
      </div>
    </div>
  )
}
