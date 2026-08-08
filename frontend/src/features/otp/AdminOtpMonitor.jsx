import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, Smartphone, Mail } from 'lucide-react'
import { API_AUTH_BASE as API } from '../../config'
import { usePoll } from '../../hooks/usePoll'

const STATUS_META = {
  live: { label: 'Live', color: '#f59e0b' },
  verified: { label: 'Verified', color: '#10b981' },
  expired: { label: 'Expired', color: '#64748b' },
  locked: { label: 'Locked', color: '#ef4444' },
  send_failed: { label: 'Send failed', color: '#ef4444' },
}

const PURPOSE_LABEL = {
  login: 'Login / signup',
  password_reset: 'Password reset',
}

function formatWhen(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function formatLeft(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function AdminOtpMonitor({ authFetch, onLiveCount }) {
  const [status, setStatus] = useState('all')
  const [channel, setChannel] = useState('')
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (status && status !== 'all') params.set('status', status)
      if (channel) params.set('channel', channel)
      if (q.trim()) params.set('q', q.trim())
      params.set('limit', '150')
      const res = await authFetch(`${API}/otp/admin/challenges/?${params}`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.detail || 'Could not load OTPs.')
        return
      }
      setError('')
      setData(d)
      if (typeof onLiveCount === 'function') onLiveCount(Number(d.live_count) || 0)
    } catch {
      setError('Connection issue loading OTPs.')
    } finally {
      setLoading(false)
    }
  }, [authFetch, status, channel, q, onLiveCount])

  useEffect(() => { load() }, [load])
  usePoll(load, 1500, true)

  const counts = data?.counts || {}
  const items = data?.items || []
  const gateway = data?.gateway || {}
  const chips = [
    { id: 'all', label: 'All', n: counts.all },
    { id: 'live', label: 'Live', n: counts.live },
    { id: 'verified', label: 'Verified', n: counts.verified },
    { id: 'expired', label: 'Expired', n: counts.expired },
    { id: 'locked', label: 'Locked', n: counts.locked },
    { id: 'send_failed', label: 'Send failed', n: counts.send_failed },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed max-w-xl">
            Live OTP traffic: Cridora → OTP service → SMS/email API → customer. Codes are never shown.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm"
              style={{
                background: gateway.live ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: gateway.live ? '#10b981' : '#f59e0b',
              }}>
              Gateway {gateway.provider || '—'} · {gateway.live ? 'live' : 'not live'}
            </span>
            <span className="text-[10px] tracking-widest uppercase text-[var(--text-dim)]">
              Auto-refresh 1.5s
            </span>
          </div>
        </div>
        <button type="button" onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-soft)' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Live now', value: counts.live ?? 0, color: '#f59e0b' },
          { label: 'Verified', value: counts.verified ?? 0, color: '#10b981' },
          { label: 'Expired', value: counts.expired ?? 0, color: '#64748b' },
          { label: 'Locked', value: counts.locked ?? 0, color: '#ef4444' },
          { label: 'Send failed', value: counts.send_failed ?? 0, color: '#ef4444' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-4"
            style={{ background: `${c.color}10`, border: `1px solid ${c.color}25` }}>
            <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1">{c.label}</div>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((c) => (
          <button key={c.id} type="button" onClick={() => setStatus(c.id)}
            className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
            style={status === c.id
              ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
            {c.label}{typeof c.n === 'number' ? ` ${c.n}` : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[180px] flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={14} className="text-[var(--text-dim)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search phone or email…"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]" />
        </div>
        <div className="flex gap-2">
          {[
            { id: '', label: 'All channels' },
            { id: 'sms', label: 'SMS' },
            { id: 'email', label: 'Email' },
          ].map((c) => (
            <button key={c.id || 'all-ch'} type="button" onClick={() => setChannel(c.id)}
              className="px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold"
              style={channel === c.id
                ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                {['Status', 'To', 'Channel', 'Purpose', 'Attempts', 'Sent', 'Created', 'Expires'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[var(--text-dim)] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[var(--text-dim)]">
                    No OTP challenges yet.
                  </td>
                </tr>
              )}
              {items.map((row, i) => {
                const meta = STATUS_META[row.status] || { label: row.status, color: '#888' }
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                        style={{ background: `${meta.color}18`, color: meta.color }}>
                        {meta.label}
                        {row.status === 'live' ? ` · ${formatLeft(row.seconds_left)}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs whitespace-nowrap">{row.destination}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] tracking-widest uppercase text-[var(--text-soft)]">
                        {row.channel === 'email' ? <Mail size={11} /> : <Smartphone size={11} />}
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-soft)] text-xs whitespace-nowrap">{PURPOSE_LABEL[row.purpose] || row.purpose}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] text-xs font-mono">{row.attempts}/{row.max_attempts}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {row.sent_ok === false ? <span className="text-red-400">Failed</span>
                        : row.sent_ok === true ? <span className="text-emerald-400">OK</span>
                          : <span className="text-[var(--text-dim)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-dim)] text-xs whitespace-nowrap">{formatWhen(row.created_at)}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] text-xs whitespace-nowrap">{formatWhen(row.expires_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {loading && !data && (
        <p className="text-xs text-[var(--text-dim)] mt-3">Loading OTP traffic…</p>
      )}
    </div>
  )
}
