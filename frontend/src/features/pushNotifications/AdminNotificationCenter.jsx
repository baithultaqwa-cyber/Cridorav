import { useEffect, useState } from 'react'
import { Send, Loader2, Users, Building2, Shield, Globe, Coins, RefreshCw } from 'lucide-react'
import { API_NOTIFICATIONS } from '../../config'

const AUDIENCES = [
  { value: 'all',      label: 'All users',   icon: Globe },
  { value: 'customer', label: 'Customers',   icon: Users },
  { value: 'vendor',   label: 'Vendors',     icon: Building2 },
  { value: 'admin',    label: 'Admins',      icon: Shield },
]

function StatPill({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl flex-1 min-w-[110px]"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[9px] tracking-[0.2em] uppercase text-[var(--text-dim)]">{label}</span>
      <span className="text-lg font-black text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

/**
 * Admin notification management: send a custom message to a targeted audience, or
 * one-click broadcast the current live gold/silver price. Also surfaces subscriber
 * counts and a short history of recent broadcasts.
 */
export default function AdminNotificationCenter({ authFetch }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)

  const [audience, setAudience] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [includeGuests, setIncludeGuests] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState(null)

  const [priceMetals, setPriceMetals] = useState({ gold: true, silver: true })
  const [priceIncludeGuests, setPriceIncludeGuests] = useState(true)
  const [sendingPrice, setSendingPrice] = useState(false)
  const [priceMsg, setPriceMsg] = useState(null)

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const r = await authFetch(`${API_NOTIFICATIONS}/admin/stats/`)
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setStats(j.stats || null)
        setRecent(j.recent_broadcasts || [])
      }
    } catch {
      /* ignore — panel still usable without stats */
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sendCustom = async () => {
    if (!title.trim() || !body.trim() || sending) return
    setSending(true)
    setSendMsg(null)
    try {
      const r = await authFetch(`${API_NOTIFICATIONS}/admin/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          title: title.trim(),
          body: body.trim(),
          url: url.trim(),
          include_guests: audience === 'all' && includeGuests,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setSendMsg({ ok: true, text: `Sent to ${j.recipients} recipient(s)${j.guests ? ` + ${j.guests} guest(s)` : ''}.` })
        setTitle('')
        setBody('')
        setUrl('')
        loadStats()
      } else {
        setSendMsg({ ok: false, text: j.detail || 'Failed to send.' })
      }
    } catch {
      setSendMsg({ ok: false, text: 'Network error.' })
    } finally {
      setSending(false)
    }
  }

  const sendLivePrice = async () => {
    const metals = Object.entries(priceMetals).filter(([, on]) => on).map(([m]) => m)
    if (!metals.length || sendingPrice) return
    setSendingPrice(true)
    setPriceMsg(null)
    try {
      const r = await authFetch(`${API_NOTIFICATIONS}/admin/send-live-price/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metals, include_guests: priceIncludeGuests }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        const priceStr = Object.entries(j.prices || {})
          .map(([m, p]) => `${m}: AED ${Number(p).toFixed(2)}/g`)
          .join(' · ')
        setPriceMsg({
          ok: true,
          text: `Sent to ${j.sent} customer(s)${j.guests ? ` + ${j.guests} guest(s)` : ''}. ${priceStr}`,
        })
        loadStats()
      } else {
        setPriceMsg({ ok: false, text: j.detail || 'Live price feed unavailable — try again shortly.' })
      }
    } catch {
      setPriceMsg({ ok: false, text: 'Network error.' })
    } finally {
      setSendingPrice(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Subscriber stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs tracking-widest uppercase font-bold text-[var(--text-dim)]">
            Push subscribers
          </h3>
          <button type="button" onClick={loadStats} disabled={loadingStats}
            className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase font-semibold text-[var(--text-dim)] hover:text-[var(--text-soft)] disabled:opacity-40">
            <RefreshCw size={11} className={loadingStats ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        {!stats?.vapid_configured && (
          <p className="text-[11px] mb-3" style={{ color: '#f59e0b' }}>
            VAPID keys are not configured on the server — pushes cannot be sent yet.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <StatPill label="Customers" value={stats?.customers ?? '—'} />
          <StatPill label="Vendors" value={stats?.vendors ?? '—'} />
          <StatPill label="Admins" value={stats?.admins ?? '—'} />
          <StatPill label="Guests (no sign-in)" value={stats?.guests ?? '—'} />
          <StatPill label="Total active" value={stats?.total ?? '—'} />
        </div>
      </div>

      {/* Live price one-click */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Coins size={16} style={{ color: 'var(--gold)' }} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Send live price now</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed">
          One click pushes the current AED/gram price to every customer with alerts enabled — no threshold needed
          (unlike the automatic movement alerts).
        </p>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {['gold', 'silver'].map((m) => (
            <label key={m} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)] capitalize cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(priceMetals[m])}
                onChange={(e) => setPriceMetals((s) => ({ ...s, [m]: e.target.checked }))}
              />
              {m}
            </label>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)] cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={priceIncludeGuests}
              onChange={(e) => setPriceIncludeGuests(e.target.checked)}
            />
            Include non-signed-in subscribers
          </label>
        </div>
        <button
          type="button"
          disabled={sendingPrice || !(priceMetals.gold || priceMetals.silver)}
          onClick={sendLivePrice}
          className="btn-gold text-[11px] disabled:opacity-40 flex items-center gap-2"
        >
          {sendingPrice ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {sendingPrice ? 'Sending…' : 'Send live price'}
        </button>
        {priceMsg && (
          <p className="text-[11px] mt-3" style={{ color: priceMsg.ok ? '#10b981' : '#ef4444' }}>
            {priceMsg.text}
          </p>
        )}
      </div>

      {/* Custom message composer */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Send a custom message</h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudience(a.value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold transition-all"
              style={audience === a.value
                ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}
            >
              <a.icon size={11} />
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Title (e.g. Platform maintenance tonight)"
            className="w-full px-4 py-2.5 rounded-lg text-sm bg-transparent"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Message body…"
            className="w-full px-4 py-2.5 rounded-lg text-sm bg-transparent resize-none"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Optional link when tapped (e.g. /marketplace)"
            className="w-full px-4 py-2.5 rounded-lg text-sm bg-transparent"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
          />
          {audience === 'all' && (
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)] cursor-pointer">
              <input type="checkbox" checked={includeGuests} onChange={(e) => setIncludeGuests(e.target.checked)} />
              Also push to non-signed-in subscribers
            </label>
          )}
        </div>

        <button
          type="button"
          disabled={sending || !title.trim() || !body.trim()}
          onClick={sendCustom}
          className="btn-gold text-[11px] disabled:opacity-40 flex items-center gap-2"
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {sending ? 'Sending…' : 'Send message'}
        </button>
        {sendMsg && (
          <p className="text-[11px] mt-3" style={{ color: sendMsg.ok ? '#10b981' : '#ef4444' }}>
            {sendMsg.text}
          </p>
        )}
      </div>

      {/* Recent broadcasts */}
      <div>
        <h3 className="text-xs tracking-widest uppercase font-bold text-[var(--text-dim)] mb-3">
          Recent broadcasts
        </h3>
        {recent.length === 0 ? (
          <p className="text-xs text-[var(--text-dim)]">No broadcasts sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm flex-shrink-0 mt-0.5"
                  style={{
                    background: r.kind === 'live_price' ? 'rgba(201,168,76,0.15)' : 'rgba(148,163,184,0.15)',
                    color: r.kind === 'live_price' ? 'var(--gold)' : '#94a3b8',
                  }}>
                  {r.kind === 'live_price' ? 'Price' : r.audience}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{r.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{r.body}</p>
                  <p className="text-[10px] text-[var(--text-dim)] mt-1">
                    {r.recipients} recipient(s){r.guests ? ` + ${r.guests} guest(s)` : ''} · {r.sent_by} ·{' '}
                    {r.created_at ? r.created_at.replace('T', ' ').slice(0, 16) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
