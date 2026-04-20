import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE } from '../config'

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
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState(null)

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotLoading(true); setForgotMsg(null)
    try {
      const res = await fetch(`${API_AUTH_BASE}/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const d = await res.json()
      setForgotMsg({ type: res.ok ? 'ok' : 'error', text: d.detail || 'Request submitted.' })
    } catch {
      setForgotMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setForgotLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      navigate(DASHBOARD_ROUTES[user.user_type] || '/')
    } catch (err) {
      const msg = err?.email?.[0] || err?.password?.[0] || err?.non_field_errors?.[0] || 'Invalid email or password.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputBase = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.15)',
    color: '#F5F0E8',
    outline: 'none',
    width: '100%',
    borderRadius: '12px',
    padding: '14px 44px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(184,115,51,0.06) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}>

          <div className="flex justify-center mb-10">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full gradient-gold opacity-90" />
                <div className="absolute inset-[2px] rounded-full flex items-center justify-center" style={{ background: '#080808' }}>
                  <span className="text-[11px] font-black tracking-widest gradient-gold-text">C</span>
                </div>
              </div>
              <span className="text-xl font-bold tracking-[0.15em] gradient-gold-text uppercase">Cridora</span>
            </Link>
          </div>

          <div className="rounded-2xl p-8 md:p-10"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)', backdropFilter: 'blur(12px)' }}>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-[#F5F0E8] mb-2">Welcome Back</h1>
              <p className="text-sm text-[#666]">Sign in to access your dashboard</p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 rounded-lg text-sm text-red-400 text-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                  <input required type="email" placeholder="you@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputBase}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.15)' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] tracking-[0.2em] uppercase text-[#555]">Password</label>
                  <button type="button" onClick={() => { setForgotOpen(true); setForgotMsg(null); setForgotEmail('') }}
                    className="text-[11px] text-[#C9A84C] hover:text-[#E8C96A] transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                  <input required type={showPass ? 'text' : 'password'} placeholder="Your password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    style={{ ...inputBase, paddingRight: '44px' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.4)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(201,168,76,0.15)' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading}
                className="btn-gold w-full py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2.5 mt-2 disabled:opacity-60">
                {loading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full" />
                ) : (<>Sign In <ArrowRight size={15} /></>)}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.1)' }} />
              <span className="text-[11px] text-[#444] tracking-widest uppercase">new to cridora?</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(201,168,76,0.1)' }} />
            </div>

            <Link to="/signup">
              <button className="btn-outline-gold w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide">
                Create Account
              </button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield size={12} className="text-[#444]" />
            <p className="text-[11px] text-[#444] tracking-wide">Secured with bank-grade encryption · UAE regulated</p>
          </div>
        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-sm relative"
            style={{ background: '#0F0F0F', border: '1px solid rgba(201,168,76,0.15)' }}>
            <button onClick={() => setForgotOpen(false)}
              className="absolute top-4 right-4 text-[#555] hover:text-[#888] transition-colors">
              ✕
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Lock size={14} className="text-[#C9A84C]" />
              <h3 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Forgot Password</h3>
            </div>
            <p className="text-xs text-[#555] mb-5 leading-relaxed">
              Enter your registered email. An admin will set a temporary password for you.
            </p>
            {forgotMsg ? (
              <div className={`flex items-center gap-2 px-3 py-3 rounded-xl text-xs mb-4 ${forgotMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ background: forgotMsg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${forgotMsg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                {forgotMsg.text}
              </div>
            ) : null}
            {!forgotMsg?.type === 'ok' && (
              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Email Address</label>
                  <input required type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.15)', outline: 'none' }} />
                </div>
                <button type="submit" disabled={forgotLoading}
                  className="btn-gold py-3 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50">
                  {forgotLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </main>
  )
}
