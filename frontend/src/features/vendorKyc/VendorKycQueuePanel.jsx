import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, RefreshCw, Search, UserCheck, Clock } from 'lucide-react'

const STATUS_COLOR = {
  pending: '#f59e0b',
  verified: '#10b981',
  rejected: '#ef4444',
}

/**
 * Vendor dashboard panel: search customers and approve/reject manual KYC.
 */
export default function VendorKycQueuePanel({ apiBase, authFetch }) {
  const [status, setStatus] = useState('pending')
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [actionBusy, setActionBusy] = useState({})
  const [msg, setMsg] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchBusy, setSearchBusy] = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    const q = new URLSearchParams()
    if (status && status !== 'all') q.set('status', status)
    authFetch(`${apiBase}/vendor/verifications/?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setItems(d?.items || []))
      .catch(() => setItems([]))
      .finally(() => setBusy(false))
  }, [apiBase, authFetch, status])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (searchQ.trim().length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(() => {
      setSearchBusy(true)
      authFetch(`${apiBase}/vendor/customers/search/?q=${encodeURIComponent(searchQ.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setSearchResults(Array.isArray(d) ? d : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchBusy(false))
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ, apiBase, authFetch])

  const decide = async (customerId, action, reason = '') => {
    const key = `${customerId}-${action}`
    if (actionBusy[key]) return
    setActionBusy((s) => ({ ...s, [key]: true }))
    setMsg('')
    try {
      const r = await authFetch(`${apiBase}/vendor/verifications/${customerId}/${action}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        setMsg(action === 'approve' ? 'Customer verified' : 'Customer rejected')
        load()
        setSearchResults((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? { ...c, verification_status: action === 'approve' ? 'verified' : 'rejected' }
              : c,
          ),
        )
      } else {
        setMsg(j.detail || 'Action failed')
      }
    } catch {
      setMsg('Network error')
    } finally {
      setActionBusy((s) => ({ ...s, [key]: false }))
    }
  }

  const startRequest = async (customerId) => {
    const key = `req-${customerId}`
    if (actionBusy[key]) return
    setActionBusy((s) => ({ ...s, [key]: true }))
    try {
      await authFetch(`${apiBase}/vendor/verifications/${customerId}/request/`, { method: 'POST' })
      load()
      setSearchQ('')
      setSearchResults([])
    } finally {
      setActionBusy((s) => ({ ...s, [key]: false }))
    }
  }

  return (
    <div>
      <p className="text-xs text-[var(--text-dim)] mb-4 leading-relaxed max-w-2xl">
        Manually verify customers before they can purchase from you. Checks are done offline
        (in person / phone). Pending requests may take 30 minutes to 24 hours from the customer&apos;s view.
      </p>

      {msg && (
        <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold)' }}>
          {msg}
        </div>
      )}

      {/* Search to add */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-2 flex items-center gap-1.5">
          <Search size={12} /> Find customer by email, phone, or name
        </label>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="e.g. customer@example.com or +971…"
          className="w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)] mb-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--silver-15)', outline: 'none' }}
        />
        {searchBusy && <p className="text-[11px] text-[var(--text-dim)]">Searching…</p>}
        {searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b last:border-0"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</div>
                  <div className="text-[11px] text-[var(--text-dim)]">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                  {c.verification_status && (
                    <span className="text-[9px] tracking-widest uppercase font-bold" style={{ color: STATUS_COLOR[c.verification_status] || 'var(--text-dim)' }}>
                      {c.verification_status}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!c.verification_status && (
                    <button
                      type="button"
                      disabled={actionBusy[`req-${c.id}`]}
                      onClick={() => startRequest(c.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}
                    >
                      Add pending
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionBusy[`${c.id}-approve`]}
                    onClick={() => decide(c.id, 'approve')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                  >
                    <CheckCircle size={11} /> Verify
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy[`${c.id}-reject`]}
                    onClick={() => {
                      const reason = window.prompt('Optional reason for rejection:') || ''
                      decide(c.id, 'reject', reason)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                  >
                    <XCircle size={11} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queue filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['pending', 'verified', 'rejected', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
            style={
              status === s
                ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)' }
            }
          >
            {s}
          </button>
        ))}
        <button type="button" onClick={load} className="ml-auto flex items-center gap-1 text-[10px] tracking-widest uppercase text-[var(--text-dim)] hover:text-[var(--gold)]">
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <UserCheck size={28} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-dim)]">No {status === 'all' ? '' : status} verification records yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((row) => (
            <div key={row.id} className="rounded-2xl p-4 flex items-start justify-between gap-4 flex-wrap"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{row.customer_name}</div>
                <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                  {row.customer_email}{row.customer_phone ? ` · ${row.customer_phone}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] tracking-widest uppercase font-bold flex items-center gap-1"
                    style={{ color: STATUS_COLOR[row.status] || 'var(--text-dim)' }}>
                    {row.status === 'pending' && <Clock size={10} />}
                    {row.status}
                  </span>
                  {row.requested_at && (
                    <span className="text-[10px] text-[var(--text-faint)]">
                      Requested {String(row.requested_at).slice(0, 16).replace('T', ' ')}
                    </span>
                  )}
                </div>
                {row.reason && <p className="text-[11px] text-[var(--text-muted)] mt-1">Note: {row.reason}</p>}
              </div>
              {row.status !== 'verified' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionBusy[`${row.customer_id}-approve`]}
                    onClick={() => decide(row.customer_id, 'approve')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
                  >
                    <CheckCircle size={11} /> Verify
                  </button>
                  {row.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={actionBusy[`${row.customer_id}-reject`]}
                      onClick={() => {
                        const reason = window.prompt('Optional reason for rejection:') || ''
                        decide(row.customer_id, 'reject', reason)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
