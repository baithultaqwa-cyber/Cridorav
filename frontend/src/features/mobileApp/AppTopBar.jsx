import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import CridoraLogo from '../../components/CridoraLogo'
import NotificationBell from '../pushNotifications/NotificationBell'
import { sereneTap, SERENE_EASE } from '../../lib/sereneMotion'

/**
 * Compact sticky top bar for the mobile app shell.
 */
export default function AppTopBar({
  title = 'Cridora',
  showBack = false,
  onBack,
  backTo,
  showLogo = false,
  authFetch,
  showBell = false,
  rightSlot = null,
}) {
  const reduce = useReducedMotion()

  return (
    <header className="mobile-app-topbar md:hidden">
      <div className="mobile-app-topbar__inner">
        <div className="flex items-center min-w-[44px] shrink-0">
          {showBack ? (
            backTo ? (
              <motion.div whileTap={reduce ? undefined : sereneTap}>
                <Link
                  to={backTo}
                  aria-label="Back"
                  className="mobile-chrome-btn -ms-1 text-[var(--text-soft)]"
                >
                  <ChevronLeft size={20} />
                </Link>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                aria-label="Back"
                onClick={onBack}
                whileTap={reduce ? undefined : sereneTap}
                className="mobile-chrome-btn -ms-1 text-[var(--text-soft)]"
              >
                <ChevronLeft size={20} />
              </motion.button>
            )
          ) : showLogo ? (
            <Link to="/" className="flex items-center -ms-1" aria-label="Cridora home">
              <CridoraLogo size="sm" />
            </Link>
          ) : (
            <span className="w-11" aria-hidden />
          )}
        </div>

        <div className="flex-1 min-w-0 px-2 relative h-5 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.h1
              key={title}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: SERENE_EASE }}
              className="absolute inset-x-2 text-center text-[13px] font-semibold text-[var(--text-primary)] tracking-[0.08em] truncate"
            >
              {title}
            </motion.h1>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-end gap-1 min-w-[44px] shrink-0">
          {rightSlot}
          {showBell && authFetch && <NotificationBell authFetch={authFetch} />}
        </div>
      </div>
    </header>
  )
}
