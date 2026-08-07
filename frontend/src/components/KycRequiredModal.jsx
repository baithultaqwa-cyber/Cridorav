import { useNavigate } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div / motion.button (JSX member)
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, ArrowRight } from 'lucide-react'

/**
 * Shown when a logged-in customer without completed KYC (i.e.
 * `compliance.trading_allowed !== true`) tries to buy. Deep-links to the
 * existing "Account & KYC" section of the customer dashboard rather than
 * building a new upload flow.
 */
export default function KycRequiredModal({ open, onClose, pendingItems = [] }) {
  const navigate = useNavigate()

  const handleGoToKyc = () => {
    onClose?.()
    navigate('/dashboard/customer?section=account')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-6 sm:p-8 w-full max-w-sm relative text-center"
            style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-soft)] transition-colors"
            >
              ✕
            </button>

            <motion.div
              className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.4)' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
            >
              <ShieldCheck size={24} style={{ color: '#f59e0b' }} />
            </motion.div>

            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">One Last Step: Verify Your Identity</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
              Quick identity check before you buy — your ID and bank details, verified once.
              This protects every buyer on Cridora, including you.
            </p>

            {pendingItems.length > 0 && (
              <ul className="text-left text-xs text-[var(--text-dim)] mb-5 rounded-xl p-3 flex flex-col gap-1.5"
                style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                {pendingItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[#f59e0b] mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGoToKyc}
              className="btn-gold w-full flex items-center justify-center gap-2.5"
            >
              Verify Now — Takes 5 Minutes <ArrowRight size={15} />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
