import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- `motion` is used as motion.div (JSX member)
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import SeoHead from '../components/SeoHead'
import { useAuth } from '../context/AuthContext'
import CridoraLogo from '../components/CridoraLogo'
import ForgotPasswordOtp from '../features/auth/ForgotPasswordOtp'
import { isEmail } from '../lib/formValidation'

const DASHBOARD_ROUTES = {
  admin: '/dashboard/admin',
  vendor: '/dashboard/vendor',
  customer: '/dashboard/customer',
}

export default function SignIn() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const goDash = (user) => navigate(DASHBOARD_ROUTES[user.user_type] || '/')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isEmail(form.email)) {
      setError('Enter a valid email address.')
      return
    }
    if (!form.password || form.password.length < 8) {
      setError('Enter your password.')
      return
    }
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      goDash(user)
    } catch (err) {
      const msg = err?.non_field_errors?.[0] || err?.email?.[0] || err?.password?.[0] || "That email or password doesn't match our records. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputBase = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(232,195,74,0.15)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    borderRadius: '12px',
    padding: '14px 44px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
  }

  return (
    <>
      <SeoHead
        noindex
        title="Sign In"
        description="Private Cridora sign-in area for verified customers and vendors; not indexed by search engines."
        path="/signin"
      />
      <main className="min-h-[100dvh] flex items-center justify-center px-4 py-6 md:py-16 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(232,195,74,0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(184,115,51,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}>

          <div className="flex justify-center mb-6">
            <Link to="/" className="auth-brand-mark" aria-label="Cridora home">
              <CridoraLogo size="auth" />
            </Link>
          </div>

          <div className="rounded-2xl p-8 md:p-10"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,195,74,0.12)', backdropFilter: 'blur(12px)' }}>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-[var(--text-primary)] mb-2">Welcome back</h1>
              <p className="text-sm text-[var(--text-muted)]">Sign in with your email and password</p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg text-sm text-red-400 text-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input required type="email" autoComplete="email" placeholder="you@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputBase} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)]">Password</label>
                  <button type="button" onClick={() => setForgotOpen(true)}
                    className="text-[11px] text-[var(--gold)] hover:text-[var(--gold-light)] transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input required type={showPass ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{ ...inputBase, paddingRight: '44px' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-soft)] transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                className="btn-gold w-full flex items-center justify-center gap-2.5 mt-2 disabled:opacity-60">
                {loading ? 'Signing in…' : <>Sign In <ArrowRight size={15} /></>}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(232,195,74,0.1)' }} />
              <span className="text-[11px] text-[var(--text-faint)] tracking-widest uppercase">new to Cridora?</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(232,195,74,0.1)' }} />
            </div>

            <Link to="/signup">
              <button type="button" className="btn-outline-gold w-full">Create Account</button>
            </Link>
          </div>
        </motion.div>
      </div>

      {forgotOpen && <ForgotPasswordOtp onClose={() => setForgotOpen(false)} />}
    </main>
    </>
  )
}
