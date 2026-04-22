import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Edit2, Save, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE as API } from '../config'

const STATUS_STYLE = {
  not_added: { color: '#555', label: 'Not Added' },
  pending:   { color: '#f59e0b', label: 'Pending Review' },
  verified:  { color: '#10b981', label: 'Verified' },
  rejected:  { color: '#ef4444', label: 'Rejected' },
}

const FIELDS = [
  { key: 'account_name', label: 'Account Name', placeholder: 'Full name as per bank records' },
  { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. Emirates NBD' },
  { key: 'account_number', label: 'Account / IBAN', placeholder: 'AE070331234567890123456' },
  { key: 'ifsc', label: 'SWIFT / IFSC Code', placeholder: 'e.g. EBILAEAD' },
]

const emptyRow = { status: 'not_added', account_name: '', bank_name: '', account_number: '', ifsc: '', updated_at: null }

function normalise(d) {
  if (!d || typeof d !== 'object') return { ...emptyRow }
  return {
    status: d.status && String(d.status) ? d.status : 'not_added',
    account_name: d.account_name != null ? String(d.account_name) : '',
    bank_name: d.bank_name != null ? String(d.bank_name) : '',
    account_number: d.account_number != null ? String(d.account_number) : '',
    ifsc: d.ifsc != null ? String(d.ifsc) : '',
    updated_at: d.updated_at != null ? d.updated_at : null,
  }
}

/**
 * Bank details for customers — data comes only from GET/POST /api/auth/bank-details/
 * (same source as admin), not from the dashboard JSON, so it stays in sync after verify.
 */
export default function CustomerBankPanel({ onAfterChange, syncKey }) {
  const { authFetch, updateKycStatus } = useAuth()
  const [bank, setBank] = useState(emptyRow)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  const load = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const r = await authFetch(`${API}/bank-details/`, { cache: 'no-store' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        setLoadError(err.detail || `Could not load bank details (${r.status})`)
        setBank(emptyRow)
        return
      }
      const d = await r.json()
      setBank(normalise(d))
    } catch (e) {
      setLoadError(e?.message || 'Network error')
      setBank(emptyRow)
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    void load()
  }, [syncKey, load])

  const startEdit = () => {
    setForm({
      account_name: bank.account_name,
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      ifsc: bank.ifsc,
    })
    setMsg({ text: '', type: 'ok' })
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setMsg({ text: '', type: 'ok' })
  }

  const save = async () => {
    if (!form.account_name?.trim() || !form.bank_name?.trim() || !form.account_number?.trim()) {
      setMsg({ text: 'Account name, bank name and account number are required.', type: 'err' })
      return
    }
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await authFetch(`${API}/bank-details/`, {
        method: 'POST',
        body: JSON.stringify({
          account_name: form.account_name.trim(),
          bank_name: form.bank_name.trim(),
          account_number: form.account_number.trim(),
          ifsc: (form.ifsc || '').trim(),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg({ text: d.detail || `Error ${r.status}`, type: 'err' })
        return
      }
      setEditing(false)
      setMsg({ text: 'Bank details saved. Your account is pending re-verification.', type: 'ok' })
      await load()
      if (typeof onAfterChange === 'function') {
        const p = onAfterChange()
        if (p != null && typeof p.then === 'function') {
          try {
            await p
          } catch {
            /* keep bank row; refetch on next open */
          }
        }
      }
      updateKycStatus('pending')
    } catch (e) {
      setMsg({ text: e?.message || 'Cannot reach server.', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  const st = STATUS_STYLE[bank.status] || STATUS_STYLE.not_added
  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,169,173,0.15)',
    color: '#F5F0E8',
    outline: 'none',
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2">
          <CreditCard size={14} className="text-[#C9A84C]" /> Bank details
        </h3>
        <div className="flex items-center gap-3">
          {loading && (
            <RefreshCw size={12} className="animate-spin text-[#C9A84C]" aria-hidden />
          )}
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: st.color }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
            {st.label}
          </div>
          {!editing && !loading && (
            <button
              type="button"
              onClick={startEdit}
              className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}
            >
              <Edit2 size={10} /> {bank.status === 'not_added' ? 'Add' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div
          className="mb-4 px-3 py-2.5 rounded-xl text-xs text-red-400 flex items-center justify-between gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={12} /> {loadError}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#C9A84C' }}
          >
            Retry
          </button>
        </div>
      )}

      {msg.text && (
        <div
          className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{
            background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          {msg.text}
        </div>
      )}

      {loading && !editing && loadError == null && (
        <p className="text-xs text-[#666]">Loading bank details…</p>
      )}

      {!editing && !loading && loadError == null && (
        <div className="flex flex-col gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="text-[10px] tracking-widest uppercase text-[#444] mb-1">{label}</div>
              <div className="text-sm font-semibold text-[#F5F0E8]">
                {bank[key] ? <span className="break-all">{bank[key]}</span> : <span className="text-[#333] font-normal">—</span>}
              </div>
            </div>
          ))}
          {bank.status === 'not_added' && (
            <p className="text-[11px] text-[#666] mt-1">
              Required before you can place a buy order or a sell-back. We verify your details for compliance and payouts.
            </p>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-4">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
              <input
                type="text"
                value={form[key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              />
            </div>
          ))}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl mt-1"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-400/80">
              Saving new bank details will suspend your trading access until Cridora admin re-verifies your account.
            </p>
          </div>
          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs tracking-widest uppercase font-semibold disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? 'Saving…' : 'Save & submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
