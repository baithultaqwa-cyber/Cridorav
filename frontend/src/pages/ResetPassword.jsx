import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react'
import { API_AUTH_BASE } from '../config'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [uid, setUid] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setUid((searchParams.get('uid') || '').trim())
    setToken((searchParams.get('token') || '').trim())
  }, [searchParams])

  const inputBase = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.15)',
    color: '#F5F0E8',
    outline: 'none',
    width: '100%',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '14px',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!uid || !token) {
      setMsg({ type: 'err', text: 'This page needs a valid reset link from your email. Request a new reset from the sign-in page.' })
      return
    }
    if (newPassword !== confirm) {
      setMsg({ type: 'err', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setMsg({ type: 'err', text: 'Password must be at least 8 characters.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_AUTH_BASE}/password-reset/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: newPassword }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'ok', text: d.detail || 'Password updated.' })
        setTimeout(() => navigate('/signin', { replace: true }), 1800)
      } else {
        setMsg({ type: 'err', text: d.detail || 'Could not reset password. The link may have expired; request a new one.' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-[#F5F0E8] mb-2">Set a new password</h1>
            <p className="text-sm text-[#666]">Use at least 8 characters</p>
          </div>
          <div className="rounded-2xl p-8"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)' }}>

            {msg && (
              <div
                className={`mb-5 flex items-center gap-2 px-3 py-3 rounded-xl text-sm ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
                style={{
                  background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}
              >
                {msg.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">New password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ ...inputBase, paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555]">
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Confirm new password</label>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  style={inputBase}
                />
              </div>
              <button type="submit" disabled={loading}
                className="btn-gold w-full py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-50">
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#080808] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Update password <ArrowRight size={15} /></>
                )}
              </button>
            </form>
            <p className="text-center text-[11px] text-[#555] mt-6">
              <Link to="/signin" className="text-[#C9A84C] hover:underline">Back to sign in</Link>
            </p>
          </div>
        </motion.div>
        <p className="text-center text-[10px] text-[#333] mt-6 flex items-center justify-center gap-1">
          <Lock size={10} /> If you do not have a link, use “Forgot password” on the sign-in page.
        </p>
      </div>
    </main>
  )
}
