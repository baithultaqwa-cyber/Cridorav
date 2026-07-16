import { useState } from 'react'
import { Link } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div / motion.button (JSX member)
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const inputBase = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(201,168,76,0.15)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  borderRadius: '12px',
  padding: '14px 44px',
  fontSize: '14px',
  transition: 'border-color 0.2s',
}

/**
 * Inline login prompt used when a guest tries to buy without leaving the
 * current page (e.g. from the Marketplace "Buy Now" gate). On success,
 * calls `onSuccess(user)` so the caller can resume whatever the guest
 * was trying to do.
 */
export default function LoginPromptModal({ open, onClose, onSuccess, message }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      setForm({ email: '', password: '' })
      onSuccess?.(user)
    } catch (err) {
      const msg = err?.email?.[0] || err?.password?.[0] || err?.non_field_errors?.[0] || 'Invalid email or password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
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
            className="rounded-2xl p-6 sm:p-8 w-full max-w-sm relative"
            style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(201,168,76,0.15)' }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-soft)] transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-1">
              <LogIn size={15} className="text-[var(--gold)]" />
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">Sign In to Continue</h3>
            </div>
            <p className="text-xs text-[var(--text-dim)] mb-5 leading-relaxed">
              {message || 'Sign in to buy this listing. New to Cridora? You can create an account in seconds.'}
            </p>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg text-xs text-red-400 text-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputBase}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.15)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input
                    required
                    type={showPass ? 'text' : 'password'}
                    placeholder="Your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{ ...inputBase, paddingRight: '44px' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.15)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-soft)] transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-3.5 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2.5 mt-1 disabled:opacity-60"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full"
                  />
                ) : (
                  <>Sign In <ArrowRight size={15} /></>
                )}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.1)' }} />
              <span className="text-[11px] text-[var(--text-faint)] tracking-widest uppercase">new to cridora?</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.1)' }} />
            </div>

            <Link to="/signup" onClick={onClose}>
              <button className="btn-outline-gold w-full py-3 rounded-xl text-sm font-semibold tracking-wide">
                Create Account
              </button>
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
