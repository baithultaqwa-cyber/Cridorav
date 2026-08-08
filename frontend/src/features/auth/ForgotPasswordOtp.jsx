import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { API_AUTH_BASE } from '../../config'
import { isEmail, isOtpCode, isUaeMobile, passwordIssues } from '../../lib/formValidation'

export default function ForgotPasswordOtp({ onClose }) {
  const [channel, setChannel] = useState('sms')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState('contact')
  const [resetToken, setResetToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resendIn, setResendIn] = useState(0)
  const [debugCode, setDebugCode] = useState('')

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const send = async () => {
    setMsg(null)
    if (channel === 'sms' && !isUaeMobile(phone)) {
      setMsg({ type: 'error', text: 'Enter a valid UAE mobile number.' })
      return
    }
    if (channel === 'email' && !isEmail(email)) {
      setMsg({ type: 'error', text: 'Enter a valid email address.' })
      return
    }
    setLoading(true)
    try {
      const body = channel === 'sms' ? { channel: 'sms', phone } : { channel: 'email', email }
      const res = await fetch(`${API_AUTH_BASE}/otp/reset/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ type: 'error', text: d.detail || 'Could not send a code.' })
        return
      }
      setDebugCode(d.debug_code || '')
      setResendIn(Number(d.resend_after) || 60)
      setStep('code')
      setMsg({ type: 'ok', text: d.detail || 'If that contact is on file, a code is on its way.' })
    } catch {
      setMsg({ type: 'error', text: 'Connection issue — please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setMsg(null)
    if (!isOtpCode(code)) {
      setMsg({ type: 'error', text: 'Enter the 6-digit code.' })
      return
    }
    setLoading(true)
    try {
      const body = channel === 'sms'
        ? { channel: 'sms', phone, code }
        : { channel: 'email', email, code }
      const res = await fetch(`${API_AUTH_BASE}/otp/reset/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ type: 'error', text: d.detail || 'That code did not match.' })
        return
      }
      setResetToken(d.reset_token)
      setStep('password')
      setMsg(null)
    } catch {
      setMsg({ type: 'error', text: 'Connection issue — please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const confirmReset = async () => {
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Passwords do not match yet.' })
      return
    }
    const issues = passwordIssues(password, { email })
    if (issues.length) {
      setMsg({ type: 'error', text: issues[0] })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch(`${API_AUTH_BASE}/otp/reset/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_token: resetToken, new_password: password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ type: 'error', text: d.detail || 'Could not update password.' })
        return
      }
      setMsg({ type: 'ok', text: d.detail || 'Password updated. You can sign in now.' })
      setStep('done')
    } catch {
      setMsg({ type: 'error', text: 'Connection issue — please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const field = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(232,195,74,0.15)',
    outline: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="rounded-2xl p-6 w-full max-w-sm relative"
        style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(232,195,74,0.15)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-soft)]">✕</button>
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-[var(--gold)]" />
          <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">Reset password</h3>
        </div>
        <p className="text-xs text-[var(--text-dim)] mb-5 leading-relaxed">
          We will send a one-time code by SMS or email (Zoho). No links to copy.
        </p>

        {step === 'contact' && (
          <>
            <div className="flex gap-2 mb-4">
              {['sms', 'email'].map((c) => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  className="flex-1 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                  style={channel === c
                    ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
                  {c === 'sms' ? 'SMS OTP' : 'Email OTP'}
                </button>
              ))}
            </div>
            {channel === 'sms' ? (
              <input type="tel" placeholder="05X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-4" style={field} />
            ) : (
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-4" style={field} />
            )}
            <button type="button" disabled={loading} onClick={send} className="btn-gold w-full disabled:opacity-50">
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-3 text-center tracking-[0.35em] font-bold"
              style={field} />
            {debugCode ? <p className="text-[11px] text-[var(--text-dim)] mb-2">Dev code: {debugCode}</p> : null}
            <button type="button" disabled={loading || code.length !== 6} onClick={verify} className="btn-gold w-full disabled:opacity-50 mb-2">
              {loading ? 'Checking…' : 'Verify code'}
            </button>
            <button type="button" disabled={resendIn > 0 || loading} onClick={send} className="text-[11px] text-[var(--gold)] w-full disabled:opacity-40">
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </>
        )}

        {step === 'password' && (
          <>
            <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-3" style={field} />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-4" style={field} />
            <button type="button" disabled={loading} onClick={confirmReset} className="btn-gold w-full disabled:opacity-50">
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </>
        )}

        {step === 'done' && (
          <button type="button" onClick={onClose} className="btn-gold w-full">Back to sign in</button>
        )}

        {msg && (
          <div className={`mt-4 px-3 py-3 rounded-xl text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
            style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }` }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}
