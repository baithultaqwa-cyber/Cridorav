import { useCallback, useEffect, useState } from 'react'
import { Banknote, RefreshCw } from 'lucide-react'
import { API_AUTH_BASE as API } from '../../config'

/**
 * Ops queue for Manual Aani collections / payouts (maker-checker).
 */
export default function AdminManualAaniQueue({ authFetch }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [evidenceById, setEvidenceById] = useState({})

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await authFetch(`${API}/payments/admin/queue/`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.detail || 'Could not load payment queue.')
        return
      }
      setPending(Array.isArray(d.pending) ? d.pending : [])
    } catch {
      setError('Network error loading payment queue.')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    void load()
  }, [load])

  const initiate = async (id) => {
    setBusyId(id)
    setError('')
    try {
      const r = await authFetch(`${API}/payments/admin/${id}/initiate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setError(d.detail || 'Initiate failed.')
      else await load()
    } catch {
      setError('Network error on initiate.')
    } finally {
      setBusyId(null)
    }
  }

  const confirm = async (id) => {
    setBusyId(id)
    setError('')
    try {
      const r = await authFetch(`${API}/payments/admin/${id}/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidence: (evidenceById[id] || '').trim(),
          allow_same_operator: false,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setError(d.detail || 'Confirm failed (maker-checker?).')
      else await load()
    } catch {
      setError('Network error on confirm.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.12)' }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Banknote size={16} className="text-[var(--gold)]" />
          <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">Manual Aani queue</h2>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void load() }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold)' }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-dim)] mb-4 leading-relaxed">
        Initiate generates the Aani request; a different admin must confirm with evidence (maker-checker).
      </p>
      {error && (
        <div className="mb-3 text-xs text-red-400 rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-xs text-[var(--text-faint)]">Loading…</div>
      ) : pending.length === 0 ? (
        <div className="text-xs text-[var(--text-faint)]">No pending Manual Aani transactions.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((t) => (
            <div
              key={t.id}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-soft)]">
                <span>#{t.id}</span>
                <span className="font-semibold text-[var(--text-primary)]">{t.fee_type}</span>
                <span>AED {Number(t.amount).toFixed(2)}</span>
                {t.order_ref && <span>Order {t.order_ref}</span>}
                {t.customer_proxy && <span>Aani: {t.customer_proxy}</span>}
              </div>
              <input
                type="text"
                placeholder="Evidence ref / screenshot note"
                value={evidenceById[t.id] || ''}
                onChange={(e) => setEvidenceById((p) => ({ ...p, [t.id]: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-xs bg-transparent border border-white/10 text-[var(--text-primary)]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => initiate(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                  style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}
                >
                  Initiate
                </button>
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => confirm(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
