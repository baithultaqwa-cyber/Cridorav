import { useState } from 'react'
import { API_AUTH_BASE } from '../../config'

export default function SetPasswordPrompt({ authFetch, onDone, onSkip }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match yet.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(`${API_AUTH_BASE}/otp/set-password/`, {
        method: 'POST',
        body: JSON.stringify({ new_password: password }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.detail || 'Could not save password.')
        return
      }
      onDone?.()
    } catch {
      setError('Connection issue — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 mt-4"
      style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Add a password (optional)</h3>
      <p className="text-xs text-[var(--text-dim)] mb-4">
        You can always sign in with SMS. A password is handy if you prefer email later.
      </p>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,195,74,0.15)', outline: 'none' }} />
      <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,195,74,0.15)', outline: 'none' }} />
      <div className="flex gap-2">
        <button type="button" disabled={loading} onClick={save} className="btn-gold flex-1 disabled:opacity-50">
          {loading ? 'Saving…' : 'Save password'}
        </button>
        <button type="button" onClick={onSkip} className="flex-1 rounded-xl text-xs text-[var(--text-dim)]"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
