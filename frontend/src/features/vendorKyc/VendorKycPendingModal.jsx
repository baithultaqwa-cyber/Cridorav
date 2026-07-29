import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ShieldAlert, ArrowRight } from 'lucide-react'

/**
 * Shown when orders/place returns VENDOR_KYC_PENDING or VENDOR_KYC_REJECTED.
 */
export default function VendorKycPendingModal({
  open,
  onClose,
  code = 'VENDOR_KYC_PENDING',
  detail = '',
  vendorName = 'This dealer',
}) {
  const navigate = useNavigate()
  const isRejected = code === 'VENDOR_KYC_REJECTED'

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
            style={{
              background: 'var(--bg-secondary)',
              border: isRejected
                ? '1px solid rgba(239,68,68,0.25)'
                : '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-soft)] transition-colors"
            >
              ✕
            </button>

            <div
              className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
              style={{
                background: isRejected ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                border: isRejected
                  ? '2px solid rgba(239,68,68,0.4)'
                  : '2px solid rgba(245,158,11,0.4)',
              }}
            >
              {isRejected
                ? <ShieldAlert size={24} style={{ color: '#ef4444' }} />
                : <Clock size={24} style={{ color: '#f59e0b' }} />}
            </div>

            <div
              className="inline-flex items-center gap-1.5 text-[9px] tracking-widest uppercase font-bold px-2.5 py-1 rounded-full mb-3"
              style={{
                background: isRejected ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                color: isRejected ? '#ef4444' : '#f59e0b',
              }}
            >
              {isRejected ? 'Verification declined' : 'Verification pending'}
            </div>

            <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">
              {isRejected ? 'This Dealer Didn\u2019t Pass Verification' : 'This Dealer Is Still Being Verified'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
              {detail || (
                isRejected
                  ? `We only list verified dealers — ${vendorName} didn't meet our standards. You can still buy from other verified dealers.`
                  : `${vendorName} is completing our verification — this usually takes 30 minutes to 24 hours. We only list verified dealers, for your protection.`
              )}
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onClose?.()
                navigate('/marketplace')
              }}
              className="btn-gold w-full py-3.5 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2.5"
            >
              See Other Verified Dealers <ArrowRight size={15} />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
