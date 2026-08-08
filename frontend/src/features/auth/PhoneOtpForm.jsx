import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { API_AUTH_BASE } from '../../config'
import { isOtpCode, isUaeMobile } from '../../lib/formValidation'

const inputStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(232,195,74,0.15)',
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  borderRadius: '12px',
  padding: '14px 44px',
  fontSize: '14px',
}

export default function PhoneOtpForm({ onVerified, submitLabel = 'Continue' }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [debugCode, setDebugCode] = useState('')

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const sendCode = async () => {
    setError('')
    setInfo('')
    if (!isUaeMobile(phone)) {
      setError('Enter a valid UAE mobile number (e.g. 05X XXX XXXX).')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_AUTH_BASE}/otp/phone/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.detail || 'Could not send a code just now.')
        if (d.resend_after) setResendIn(Number(d.resend_after) || 60)
        return
      }
      setStep('code')
      setResendIn(Number(d.resend_after) || 60)
      setDebugCode(d.debug_code || '')
      setInfo('We sent a 6-digit code to your mobile.')
    } catch {
      setError('Connection issue — please try again.')
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setError('')
    if (!isOtpCode(code)) {
      setError('Enter the 6-digit code.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_AUTH_BASE}/otp/phone/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.detail || 'That code did not match.')
        return
      }
      onVerified?.(d)
    } catch {
      setError('Connection issue — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg text-sm text-red-400 text-center"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}
      {info && !error && (
        <div className="p-3 rounded-lg text-sm text-[var(--text-soft)] text-center"
          style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {info}
          {debugCode ? <span className="block mt-1 text-[11px] text-[var(--text-dim)]">Dev code: {debugCode}</span> : null}
        </div>
      )}

      {step === 'phone' ? (
        <>
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Mobile number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-1.5">UAE numbers only. We will text a one-time code.</p>
          </div>
          <button type="button" disabled={loading || !phone.trim()} onClick={sendCode}
            className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Sending…' : submitLabel}
          </button>
        </>
      ) : (
        <>
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-dim)] mb-1.5 block">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputStyle, padding: '14px 16px', letterSpacing: '0.35em', textAlign: 'center', fontWeight: 700 }}
            />
            <p className="text-[11px] text-[var(--text-dim)] mt-1.5">Sent to {phone}</p>
          </div>
          <button type="button" disabled={loading || code.length !== 6} onClick={verify}
            className="btn-gold w-full disabled:opacity-60">
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <div className="flex items-center justify-between text-[11px]">
            <button type="button" className="text-[var(--text-dim)] hover:text-[var(--gold)]" onClick={() => { setStep('phone'); setCode(''); setInfo('') }}>
              Change number
            </button>
            <button type="button" disabled={resendIn > 0 || loading} onClick={sendCode}
              className="text-[var(--gold)] disabled:opacity-40">
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
