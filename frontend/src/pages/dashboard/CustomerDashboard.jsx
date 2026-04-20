import { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, BarChart2, ShoppingBag, RefreshCw,
  Clock, Shield, ChevronDown, Filter, Wallet, Coins,
  CheckCircle, X, User, FileText, AlertTriangle, CreditCard,
  Package, Bell, Settings, ChevronRight, Info, Upload, ExternalLink,
  XCircle, RotateCcw, Edit2, Save
} from 'lucide-react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { API_AUTH_BASE as API } from '../../config'

const NAV = [
  { sectionKey: 'portfolio', icon: BarChart2, label: 'My Portfolio' },
  { href: '/marketplace', icon: ShoppingBag, label: 'Marketplace', external: true },
  { sectionKey: 'orders', icon: Clock, label: 'Orders & History' },
  { sectionKey: 'account', icon: User, label: 'Account & KYC' },
  { sectionKey: 'settings', icon: Settings, label: 'Settings' },
]

const METAL_COLOR = {
  gold:     { text: '#C9A84C', bg: 'rgba(201,168,76,0.08)',   border: 'rgba(201,168,76,0.2)' },
  silver:   { text: '#A8A9AD', bg: 'rgba(168,169,173,0.08)', border: 'rgba(168,169,173,0.2)' },
  platinum: { text: '#B87333', bg: 'rgba(184,115,51,0.08)',   border: 'rgba(184,115,51,0.2)' },
}

const STATUS_STYLE = {
  Completed:           { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  Processing:          { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  Pending:             { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  Cancelled:           { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  Failed:              { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  'Awaiting Vendor':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'Pending Payment':   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  Rejected:            { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  Expired:             { color: '#555', bg: 'rgba(255,255,255,0.04)' },
}

const KYC_STYLE = {
  verified: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Verified' },
  pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Pending Review' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'Rejected' },
}
const KYC_FALLBACK = { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Pending Review' }

function StatCard({ label, value, sub, trend, color = '#C9A84C', icon: Icon }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="rounded-2xl p-5 flex flex-col gap-3 h-full"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-[#F5F0E8]">{value}</div>
      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-[11px] text-[#555]">{sub}</span>}
      </div>
    </motion.div>
  )
}

const API_BASE_SELL = API

function ChangePasswordSection() {
  const { authFetch } = useAuth()
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm_password) {
      setMsg({ type: 'error', text: 'New passwords do not match.' }); return
    }
    if (form.new_password.length < 8) {
      setMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return
    }
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch(`${API}/change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: form.old_password, new_password: form.new_password }),
      })
      const d = await res.json()
      if (res.ok) {
        setMsg({ type: 'ok', text: 'Password changed successfully.' })
        setForm({ old_password: '', new_password: '', confirm_password: '' })
      } else {
        setMsg({ type: 'error', text: d.detail || 'Failed to change password.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8] mb-6">Settings</h2>
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
          <Settings size={13} className="text-[#C9A84C]" /> Change Password
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { key: 'old_password',     label: 'Current Password' },
            { key: 'new_password',     label: 'New Password' },
            { key: 'confirm_password', label: 'Confirm New Password' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
              <input type="password" value={form[key]} onChange={(e) => update(key, e.target.value)} required
                className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
            </div>
          ))}
          {msg && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {msg.text}
            </div>
          )}
          <button type="submit" disabled={saving}
            className="btn-gold py-3 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50">
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SellModal({ row, sellSharePct = 5, onClose, onCreated }) {
  const { authFetch } = useAuth()
  const navigate = useNavigate()
  const maxGrams = row.grams
  const [qtyStr, setQtyStr] = useState(String(row.grams))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const qty           = Math.min(maxGrams, Math.max(0.0001, parseFloat(qtyStr) || 0))
  const purchaseCost  = qty * row.purchase_rate
  const gross         = qty * row.current_buyback
  const profit        = gross - purchaseCost
  const shareAed      = profit > 0 ? (profit * sellSharePct / 100) : 0
  const netPayout     = gross - shareAed

  const fmt = (n) => Number(n).toFixed(2)
  const fmtR = (n) => Number(n).toFixed(4)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await authFetch(`${API_BASE_SELL}/sell-orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buy_order_id: row.order_id, qty_grams: qty }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Failed to place sell order.'); return }
      onClose()
      navigate(`/sell-status/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl p-6 w-full max-w-md overflow-y-auto"
        style={{ background: '#0D0D0D', border: '1px solid rgba(201,168,76,0.2)', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-[#F5F0E8]">Sell Request</h3>
            <p className="text-[11px] text-[#555] mt-0.5">{row.product_name} · {row.purity} · {row.vendor}</p>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-[#888]"><X size={16} /></button>
        </div>

        {/* Qty input */}
        <div className="mb-5">
          <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">
            Quantity to sell (grams) — max {maxGrams}g
          </label>
          <input
            type="number" min={0.0001} step={0.0001} max={maxGrams}
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            onBlur={() => setQtyStr(String(Math.min(maxGrams, Math.max(0.0001, parseFloat(qtyStr) || 0))))}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-[#F5F0E8]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', outline: 'none' }}
          />
        </div>

        {/* Breakdown */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-4 py-2 text-[10px] tracking-widest uppercase text-[#444] font-semibold"
            style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            Payout Breakdown
          </div>
          <div className="flex flex-col divide-y" style={{ background: 'rgba(0,0,0,0.3)', '--tw-divide-opacity': 1 }}>
            {[
              ['Purchase rate (metal)',  `AED ${fmtR(row.purchase_rate)}/g`,  '#888'],
              ['Buyback rate (live)',    `AED ${fmtR(row.current_buyback)}/g`, '#C9A84C'],
              ['Qty',                   `${qty.toFixed(4)} g`,                '#888'],
              ['Purchase cost',         `AED ${fmt(purchaseCost)}`,           '#888'],
              ['Gross buyback payout',  `AED ${fmt(gross)}`,                  '#F5F0E8'],
              [
                profit >= 0
                  ? `Profit`
                  : `Loss`,
                `${profit >= 0 ? '+' : ''}AED ${fmt(profit)}`,
                profit >= 0 ? '#10b981' : '#ef4444',
              ],
              [
                `Cridora share (${sellSharePct}% of profit)`,
                profit > 0 ? `- AED ${fmt(shareAed)}` : 'AED 0.00',
                '#f59e0b',
              ],
            ].map(([label, val, color]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-[#555]">{label}</span>
                <span className="text-xs font-semibold" style={{ color }}>{val}</span>
              </div>
            ))}
            {/* Net payout highlighted */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: 'rgba(201,168,76,0.05)' }}>
              <span className="text-sm font-bold text-[#F5F0E8]">Net Payout</span>
              <span className="text-sm font-black" style={{ color: '#C9A84C' }}>AED {fmt(netPayout)}</span>
            </div>
          </div>
        </div>

        {profit > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg mb-4"
            style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <Info size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-400/80">
              Cridora deducts {sellSharePct}% only on your profit of AED {fmt(profit)}.
              No deduction on losses.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg mb-4"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <AlertTriangle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={submitting || qty <= 0}
          className="btn-gold w-full py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-40">
          {submitting ? 'Submitting…' : 'Confirm Sell Request'}
        </button>
        <p className="text-center text-[10px] text-[#444] mt-3">
          Vendor acceptance required before payout is processed
        </p>
      </motion.div>
    </motion.div>
  )
}

function LotDetailRow({ row }) {
  const [open, setOpen] = useState(false)
  const d = row.lot_detail
  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer hover:bg-[rgba(201,168,76,0.03)] transition-colors"
        style={{ borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.03)' }}>
        <td className="px-4 py-3 text-[#C9A84C] font-mono text-xs flex items-center gap-1.5">
          {row.id}
          <ChevronDown size={11} className={`text-[#444] transition-transform ${open ? 'rotate-180' : ''}`} />
        </td>
        <td className="px-4 py-3 text-[#888] text-xs whitespace-nowrap">{row.date}</td>
        <td className="px-4 py-3">
          <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
            style={row.type === 'BUY'
              ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
              : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {row.type}
          </span>
        </td>
        <td className="px-4 py-3 text-[#F5F0E8] whitespace-nowrap text-sm">{row.product}</td>
        <td className="px-4 py-3 text-[#888] whitespace-nowrap text-xs">{row.vendor}</td>
        <td className="px-4 py-3 text-[#F5F0E8] text-sm">{Math.abs(row.qty_grams)}</td>
        <td className="px-4 py-3 text-[#888] text-xs">AED {row.buy_price_per_gram}</td>
        <td className="px-4 py-3 text-[#F5F0E8] font-semibold text-sm">AED {row.current_value_aed?.toLocaleString()}</td>
        <td className="px-4 py-3">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-emerald-400">{row.status}</span>
        </td>
      </tr>
      {open && d && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <td colSpan={9} className="px-6 pb-4 pt-2">
            <div className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3"
              style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
              {[
                ['Lot ID', row.id],
                ['Quote ID', d.quote_id],
                ['Vendor', row.vendor],
                ['Original Qty', `${d.original_qty}g`],
                ['Remaining Qty', `${d.remaining_qty}g`],
                ['Buy Date', row.date],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] tracking-widest uppercase text-[#555] mb-0.5">{k}</div>
                  <div className="text-sm font-semibold text-[#F5F0E8]">{v}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const BANK_STATUS_STYLE = {
  not_added: { color: '#555',    label: 'Not Added' },
  pending:   { color: '#f59e0b', label: 'Pending Review' },
  verified:  { color: '#10b981', label: 'Verified' },
}

const BANK_FIELDS = [
  { key: 'account_name',   label: 'Account Name',      placeholder: 'Full name as per bank records' },
  { key: 'bank_name',      label: 'Bank Name',          placeholder: 'e.g. Emirates NBD' },
  { key: 'account_number', label: 'Account / IBAN',     placeholder: 'AE070331234567890123456' },
  { key: 'ifsc',           label: 'SWIFT / IFSC Code',  placeholder: 'e.g. EBILAEAD' },
]

function BankDetailsForm({ initialBank, onSaved }) {
  const { getToken, updateKycStatus } = useAuth()
  const [bank, setBank] = useState(initialBank)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  useEffect(() => { setBank(initialBank) }, [initialBank])

  const startEdit = () => {
    setForm({
      account_name:   bank.account_name   || '',
      bank_name:      bank.bank_name      || '',
      account_number: bank.account_number || '',
      ifsc:           bank.ifsc           || '',
    })
    setMsg({ text: '', type: 'ok' })
    setEditing(true)
  }

  const cancel = () => { setEditing(false); setMsg({ text: '', type: 'ok' }) }

  const save = async () => {
    if (!form.account_name || !form.bank_name || !form.account_number) {
      setMsg({ text: 'Account name, bank name and account number are required.', type: 'err' })
      return
    }
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await fetch(`${API}/bank-details/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      let d = {}
      try { d = await r.json() } catch {}
      if (r.ok) {
        setBank(d)
        setEditing(false)
        updateKycStatus('pending')
        onSaved?.(d)
        setMsg({ text: 'Bank details saved. Your account is pending re-verification.', type: 'ok' })
      } else {
        setMsg({ text: d.detail || `Server error (${r.status}). Ensure the backend migration has been applied.`, type: 'err' })
      }
    } catch {
      setMsg({ text: 'Cannot reach server. Check your connection.', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  const st = BANK_STATUS_STYLE[bank?.status || 'not_added']
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
          <CreditCard size={14} className="text-[#C9A84C]" /> Bank Details
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: st.color }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
            {st.label}
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
              <Edit2 size={10} /> {bank?.status === 'not_added' ? 'Add' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {msg.text && (
        <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          {msg.text}
        </div>
      )}

      {!editing ? (
        <div className="flex flex-col gap-4">
          {BANK_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <div className="text-[10px] tracking-widest uppercase text-[#444] mb-1">{label}</div>
              <div className="text-sm font-semibold text-[#F5F0E8]">
                {bank?.[key] || <span className="text-[#333] font-normal">—</span>}
              </div>
            </div>
          ))}
          {bank?.status === 'not_added' && (
            <p className="text-[11px] text-[#444] mt-1">
              Add your bank details to enable sell-back payouts.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {BANK_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
              <input
                type="text"
                value={form[key] || ''}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              />
            </div>
          ))}

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mt-1"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-400/80">
              Saving new bank details will suspend your trading access until Cridora admin re-verifies your account.
            </p>
          </div>

          <div className="flex gap-3 mt-1">
            <button onClick={cancel} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs tracking-widest uppercase font-semibold disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? 'Saving…' : 'Save & Submit'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


const EDITABLE_PROFILE_FIELDS = [
  { key: 'first_name', label: 'First Name', placeholder: 'First name' },
  { key: 'last_name',  label: 'Last Name',  placeholder: 'Last name' },
  { key: 'phone',      label: 'Phone',      placeholder: '+971 50 000 0000' },
  { key: 'country',    label: 'Country',    placeholder: 'UAE' },
]

function ProfileForm({ profile }) {
  const { getToken, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  const startEdit = () => {
    setForm({
      first_name: profile.first_name || '',
      last_name:  profile.last_name  || '',
      phone:      profile.phone      || '',
      country:    profile.country    || '',
    })
    setMsg({ text: '', type: 'ok' })
    setEditing(true)
  }

  const cancel = () => { setEditing(false); setMsg({ text: '', type: 'ok' }) }

  const save = async () => {
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await fetch(`${API}/profile/update/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      })
      let d = {}
      try { d = await r.json() } catch {}
      if (r.ok) {
        await refreshUser()
        setEditing(false)
        setMsg({ text: 'Profile updated.', type: 'ok' })
      } else {
        setMsg({ text: d.detail || `Error ${r.status}`, type: 'err' })
      }
    } catch {
      setMsg({ text: 'Cannot reach server. Check your connection.', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,169,173,0.15)',
    color: '#F5F0E8',
    outline: 'none',
  }

  const READ_ROWS = [
    { label: 'Full Name', value: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '—' },
    { label: 'Email',     value: profile.email   || '—' },
    { label: 'Phone',     value: profile.phone   || '—' },
    { label: 'Country',   value: profile.country || '—' },
  ]

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2">
          <User size={14} className="text-[#C9A84C]" /> Personal Information
        </h3>
        {!editing && (
          <button onClick={startEdit}
            className="flex items-center gap-1 text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
            <Edit2 size={10} /> Edit
          </button>
        )}
      </div>

      {msg.text && (
        <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          {msg.text}
        </div>
      )}

      {!editing ? (
        <div className="flex flex-col gap-4">
          {READ_ROWS.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] tracking-widest uppercase text-[#444] mb-1">{label}</div>
              <div className="text-sm font-semibold text-[#F5F0E8]">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {EDITABLE_PROFILE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
              <input
                type="text"
                value={form[key] || ''}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={inputStyle}
              />
            </div>
          ))}
          <div className="flex gap-3 mt-1">
            <button onClick={cancel} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs tracking-widest uppercase font-semibold disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C' }}>
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


const REQUIRED_CUSTOMER_DOCS = [
  { doc_type: 'passport', label: 'Passport / National ID', hint: 'Colour scan of bio-data page, valid for 6+ months' },
  { doc_type: 'proof_of_address', label: 'Proof of Address', hint: 'Bank statement or utility bill dated within 3 months' },
  { doc_type: 'selfie', label: 'Selfie with ID', hint: 'Clear photo of you holding your ID document' },
]

const DOC_STATUS_STYLE = {
  not_uploaded: { color: '#555', label: 'Not Uploaded', icon: Upload },
  pending:      { color: '#f59e0b', label: 'Under Review', icon: Clock },
  verified:     { color: '#10b981', label: 'Verified', icon: CheckCircle },
  rejected:     { color: '#ef4444', label: 'Rejected', icon: XCircle },
}

function KYCDocumentUploader({ kyc }) {
  const { getToken, refreshUser, updateKycStatus, user } = useAuth()
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState({})
  const [msg, setMsg] = useState('')
  const fileInputRefs = useRef({})

  const loadDocs = async () => {
    const token = getToken()
    if (!token) return
    const res = await fetch(`${API}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setDocs(await res.json())
  }

  useEffect(() => { loadDocs() }, [])

  const getDoc = (dt) => docs.find((d) => d.doc_type === dt)

  const handleUpload = async (doc_type, file) => {
    if (!file) return
    setUploading((p) => ({ ...p, [doc_type]: true }))
    setMsg('')
    const token = getToken()
    const form = new FormData()
    form.append('doc_type', doc_type)
    form.append('file', file)
    try {
      const res = await fetch(`${API}/documents/upload/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (res.ok) {
        await loadDocs()
        setMsg('Document uploaded successfully.')
        await refreshUser()
      } else {
        const d = await res.json()
        setMsg(d.detail || 'Upload failed.')
      }
    } catch {
      setMsg('Network error.')
    } finally {
      setUploading((p) => ({ ...p, [doc_type]: false }))
    }
  }

  const kycStyle = KYC_STYLE[kyc.status] || KYC_FALLBACK
  const kycColor = kycStyle.color

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      {/* Status header */}
      <div className="rounded-2xl p-6"
        style={{ background: kycStyle.bg, border: `1px solid ${kycStyle.border}` }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${kycColor}20` }}>
              <Shield size={22} style={{ color: kycColor }} />
            </div>
            <div>
              <div className="text-[10px] tracking-widest uppercase text-[#555] mb-1">KYC Status</div>
              <div className="text-xl font-black" style={{ color: kycColor }}>
                {kycStyle.label}
              </div>
              {kyc.verified_at && <div className="text-[11px] text-[#555] mt-0.5">Verified on {kyc.verified_at}</div>}
            </div>
          </div>
          {kyc.status === 'verified' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-widest uppercase"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
              <CheckCircle size={13} /> Fully Verified
            </div>
          )}
        </div>
        {msg && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
            {msg}
          </div>
        )}
      </div>

      {/* Document slots */}
      {kyc.status !== 'verified' && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2 mb-5">
            <FileText size={14} className="text-[#C9A84C]" /> Required Documents
          </h3>
          <div className="flex flex-col gap-3">
            {REQUIRED_CUSTOMER_DOCS.map(({ doc_type, label, hint }) => {
              const doc = getDoc(doc_type)
              const st = DOC_STATUS_STYLE[doc?.status || 'not_uploaded']
              const StatusIcon = st.icon
              const isUploading = uploading[doc_type]
              return (
                <div key={doc_type} className="rounded-xl p-4 flex flex-col gap-2"
                  style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${doc?.status === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.04)'}` }}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${st.color}15` }}>
                        <StatusIcon size={14} style={{ color: st.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#F5F0E8]">{label}</div>
                        <div className="text-[10px] text-[#555] mt-0.5">{hint}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                        style={{ background: `${st.color}15`, color: st.color }}>
                        {st.label}
                      </span>
                      {doc?.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                          style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                          <ExternalLink size={10} /> View
                        </a>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[doc_type] = el }}
                        onChange={(e) => handleUpload(doc_type, e.target.files[0])}
                      />
                      <button
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[doc_type]?.click()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold disabled:opacity-40"
                        style={doc?.status === 'rejected'
                          ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }
                          : { background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                        {isUploading ? '…' : doc ? <><RotateCcw size={10} /> Reupload</> : <><Upload size={10} /> Upload</>}
                      </button>
                    </div>
                  </div>
                  {doc?.status === 'rejected' && doc.rejection_reason && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                      <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                      <span><span className="font-bold">Reason:</span> {doc.rejection_reason}</span>
                    </div>
                  )}
                  {doc?.uploaded_at && (
                    <div className="text-[10px] text-[#444]">
                      {doc.original_filename} · Uploaded {doc.uploaded_at}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-[#444] mt-4">
            Accepted formats: PDF, JPG, PNG · Max 10 MB per file. Documents are reviewed within 1–2 business days.
          </p>
        </div>
      )}

      {/* Verified: show doc summary */}
      {kyc.status === 'verified' && docs.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2 mb-5">
            <FileText size={14} className="text-[#C9A84C]" /> Verified Documents
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {docs.map((doc) => (
              <div key={doc.doc_type} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="flex items-center gap-2.5">
                  <FileText size={13} className="text-[#555]" />
                  <div>
                    <div className="text-xs font-semibold text-[#F5F0E8]">{KYC_STYLE[doc.status] ? doc.label : doc.label}</div>
                    <div className="text-[10px] text-[#555]">{doc.uploaded_at?.slice(0, 10)}</div>
                  </div>
                </div>
                <CheckCircle size={13} className="text-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerDashboard() {
  const { authFetch, user, updateKycStatus, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState(searchParams.get('section') || 'portfolio')
  const navigate = useNavigate()
  const [sellTarget, setSellTarget] = useState(null)
  const [metalFilter, setMetalFilter] = useState('all')
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [ordersFilter, setOrdersFilter] = useState('all')
  const [bankData, setBankData] = useState(null)

  useEffect(() => {
    refreshUser()
    authFetch(`${API}/dashboard/customer/`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authFetch])

  const navWithBadge = NAV.map((n) => n)

  if (loading) return (
    <DashboardLayout navItems={NAV} title="My Portfolio" activeSection={section} onSectionChange={setSection}>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: '#C9A84C' }} />
      </div>
    </DashboardLayout>
  )

  const p = data?.portfolio || {}
  const holdings = data?.holdings || []
  const ledger = data?.ledger || []
  const orders = data?.orders || []
  const kyc = data?.kyc || {}
  const profile = data?.profile || {}
  const bank = data?.bank || {}

  const filteredHoldings = holdings.filter((h) => metalFilter === 'all' || h.metal === metalFilter)
  const filteredLedger = ledgerFilter === 'all' ? ledger : ledger.filter((l) => l.type === ledgerFilter)
  const filteredOrders = ordersFilter === 'all' ? orders : orders.filter((o) => o.type === ordersFilter)

  const SECTION_TITLES = {
    portfolio: 'My Portfolio',
    orders: 'Orders & History',
    account: 'Account & KYC',
  }

  const TABS = navWithBadge.filter((n) => n.sectionKey)

  return (
    <DashboardLayout navItems={navWithBadge} title={SECTION_TITLES[section] || 'Dashboard'}
      activeSection={section} onSectionChange={setSection}>

      {/* KYC pending banner */}
      {user?.kyc_status === 'pending' && (
        <div className="mb-6 px-5 py-4 rounded-2xl flex items-start gap-4"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <span className="text-base">⏳</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#f59e0b] mb-0.5">KYC Verification Pending</p>
            <p className="text-xs text-[#888]">
              Your identity is being reviewed by our compliance team. Full trading access will be enabled once verified, typically within 1–2 business days.
            </p>
          </div>
        </div>
      )}
      {user?.kyc_status === 'rejected' && (
        <div className="mb-6 px-5 py-4 rounded-2xl flex items-start gap-4"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(239,68,68,0.15)' }}>
            <span className="text-base">❌</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-400 mb-0.5">KYC Verification Rejected</p>
            <p className="text-xs text-[#888]">
              Your KYC was not approved. Please contact support at <span className="text-[#C9A84C]">support@cridora.com</span> to re-submit your documents.
            </p>
          </div>
        </div>
      )}

      {/* Desktop section tabs */}
      <div className="hidden lg:flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button key={t.sectionKey} onClick={() => setSection(t.sectionKey)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs tracking-widest uppercase font-semibold transition-all"
            style={section === t.sectionKey
              ? { background: 'rgba(184,115,51,0.15)', border: '1px solid rgba(184,115,51,0.4)', color: '#DA8A67' }
              : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
        <Link to="/marketplace"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs tracking-widest uppercase font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
          <ShoppingBag size={13} />
          Marketplace
        </Link>
      </div>

      {/* ─── PORTFOLIO ──────────────────────────────────── */}
      {section === 'portfolio' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <div className="xl:col-span-2">
              <StatCard label="Market value (holdings)" value={`AED ${(p.total_value_aed ?? 0).toLocaleString()}`}
                sub="Vendor live metal rates · unrealized P&L vs cost basis" trend={p.unrealized_pnl_pct} color="#C9A84C" icon={Wallet} />
              <p className="text-[10px] text-[#555] mt-2 leading-relaxed px-1">
                Sell-back cash estimate:{' '}
                <span className="text-emerald-400/90 font-semibold">
                  AED {(p.total_buyback_value_aed ?? 0).toLocaleString()}
                </span>
                {' '}if you sold at today’s vendor buyback (Cridora share only on profit).
              </p>
            </div>
            <div className="xl:col-span-2">
              <StatCard label="Total Invested" value={`AED ${(p.total_invested_aed ?? 0).toLocaleString()}`}
                sub="Cost basis" color="#A8A9AD" icon={BarChart2} />
            </div>
            <div className="xl:col-span-2">
              <StatCard
                label="Unrealized P&L"
                value={`${(p.unrealized_pnl_aed ?? 0) >= 0 ? '+' : ''}AED ${(p.unrealized_pnl_aed ?? 0).toLocaleString()}`}
                sub={`Realized: +AED ${(p.realized_pnl_aed ?? 0).toLocaleString()}`}
                trend={p.unrealized_pnl_pct ?? 0}
                color={(p.unrealized_pnl_aed ?? 0) >= 0 ? '#10b981' : '#ef4444'} icon={TrendingUp} />
            </div>
            <StatCard label="Gold Holdings" value={`${p.gold_grams ?? 0}g`} sub="XAU" color="#C9A84C" icon={Coins} />
            <StatCard label="Silver Holdings" value={`${p.silver_grams ?? 0}g`} sub="XAG" color="#A8A9AD" icon={Coins} />
            <StatCard label="Other Metals" value={`${p.other_grams ?? 0}g`} sub="XPT/XPD" color="#B87333" icon={Coins} />
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { icon: Shield, text: 'Backed by vendor inventory', color: '#C9A84C' },
              { icon: CheckCircle, text: 'Sell-back guaranteed by vendor', color: '#10b981' },
              { icon: Clock, text: 'Payout after vendor confirmation', color: '#A8A9AD' },
            ].map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] tracking-wide"
                style={{ background: `${color}08`, border: `1px solid ${color}20`, color }}>
                <Icon size={11} />{text}
              </div>
            ))}
          </div>

          {/* Holdings Table */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Holdings</h2>
                <p className="text-[11px] text-[#555] mt-0.5">Buyback rates reflect the vendor's latest update</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'gold', 'silver', 'platinum'].map((f) => (
                  <button key={f} onClick={() => setMetalFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all"
                    style={metalFilter === f
                      ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
                      : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
                    }>{f}</button>
                ))}
              </div>
            </div>

            {filteredHoldings.length === 0 ? (
              <div className="text-center py-14 rounded-2xl text-[#444] text-sm"
                style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                No holdings{metalFilter !== 'all' ? ` for ${metalFilter}` : ''}
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                        {['Date', 'Vendor', 'Metal', 'Purity', 'Grams', 'Purchase Rate', 'Buyback Rate', 'P&L', ''].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHoldings.map((row, i) => {
                        const mc = METAL_COLOR[row.metal] || METAL_COLOR.gold
                        const pnlPos = row.pnl_aed >= 0
                        return (
                          <tr key={row.order_ref}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">{row.date}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#F5F0E8]">{row.vendor}</span>
                                {row.vendor_verified && <Shield size={10} className="text-emerald-400 flex-shrink-0" />}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                                style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
                                {row.metal}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#888] whitespace-nowrap">{row.purity}</td>
                            <td className="px-4 py-3 text-xs font-semibold tabular-nums text-[#F5F0E8] whitespace-nowrap">
                              {Number(row.grams).toFixed(4)} g
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums text-[#888] whitespace-nowrap">
                              AED {Number(row.purchase_rate).toFixed(4)}/g
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums font-semibold whitespace-nowrap"
                              style={{ color: mc.text }}>
                              AED {Number(row.current_buyback).toFixed(4)}/g
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums font-semibold whitespace-nowrap">
                              <span className={pnlPos ? 'text-emerald-400' : 'text-red-400'}>
                                {pnlPos ? '+' : ''}AED {Number(row.pnl_aed).toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {row.sell_order_id ? (
                                <button
                                  onClick={() => navigate(`/sell-status/${row.sell_order_id}`)}
                                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold whitespace-nowrap"
                                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                                  Pending
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSellTarget(row)}
                                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all whitespace-nowrap"
                                  style={{ background: mc.bg, border: `1px solid ${mc.border}`, color: mc.text }}>
                                  Sell
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Ledger Table */}
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Transaction Ledger</h2>
                <p className="text-[11px] text-[#555] mt-0.5">Click any row to view lot details</p>
              </div>
              <div className="flex gap-2">
                {['all', 'BUY', 'SELL'].map((f) => (
                  <button key={f} onClick={() => setLedgerFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all"
                    style={ledgerFilter === f
                      ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
                      : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
                    }>{f === 'all' ? 'All' : f}</button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                      {['Lot ID', 'Date', 'Type', 'Product', 'Vendor', 'Qty (g)', 'Buy Price/g', 'Current Value', 'Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((row) => (
                      <LotDetailRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ─── ORDERS & HISTORY ───────────────────────────── */}
      {section === 'orders' && (
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Orders & History</h2>
              <p className="text-[11px] text-[#555] mt-0.5">All your buy and sell orders</p>
            </div>
            <div className="flex gap-2">
              {['all', 'BUY', 'SELL'].map((f) => (
                <button key={f} onClick={() => setOrdersFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all"
                  style={ordersFilter === f
                    ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
                  }>{f === 'all' ? 'All' : f}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {filteredOrders.map((order) => {
              const mc = METAL_COLOR[order.metal] || METAL_COLOR.gold
              const ss = STATUS_STYLE[order.status] || STATUS_STYLE.Pending
              return (
                <div key={order.id} className="rounded-2xl p-5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: mc.bg, border: `1px solid ${mc.border}` }}>
                        <Package size={16} style={{ color: mc.text }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-[#F5F0E8]">{order.product}</span>
                          <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                            style={order.type === 'BUY'
                              ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
                              : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            {order.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#666]">
                          {order.vendor} · {order.qty_grams}g · AED {order.price_per_gram}/g
                        </div>
                        <div className="text-[10px] text-[#444] mt-0.5 font-mono">{order.id} · {order.date}</div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <div className="text-lg font-black text-[#F5F0E8]">AED {order.total_aed?.toLocaleString()}</div>
                      <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm inline-block"
                        style={{ background: ss.bg, color: ss.color }}>
                        {order.status}
                      </span>
                      {order.raw_status === 'vendor_accepted' && (
                        <button
                          onClick={() => navigate(`/payment/${order.order_id}`)}
                          className="text-[10px] tracking-widest uppercase font-bold px-3 py-1.5 rounded-lg"
                          style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C96A)', color: '#080808' }}>
                          Pay Now →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl flex items-center gap-3"
            style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <ShoppingBag size={16} style={{ color: '#C9A84C' }} className="flex-shrink-0" />
            <p className="text-xs text-[#666]">
              Want to buy more metals?{' '}
              <Link to="/marketplace" className="font-semibold" style={{ color: '#C9A84C' }}>
                Browse the Marketplace →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ─── ACCOUNT & KYC ──────────────────────────────── */}
      {section === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* KYC Status + Document Upload */}
          <KYCDocumentUploader kyc={kyc} />

          {/* Personal Info */}
          <ProfileForm profile={profile} />

          {/* Bank Details */}
          <BankDetailsForm
            initialBank={bankData || bank}
            onSaved={(updated) => setBankData(updated)}
          />

          {/* Settings */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2 mb-5">
              <Settings size={14} className="text-[#C9A84C]" /> Preferences
            </h3>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Email notifications for orders', desc: 'Get notified on order status changes', on: true },
                { label: 'Price alert notifications', desc: 'Alert when buyback price changes significantly', on: false },
                { label: 'Monthly portfolio summary', desc: 'Monthly email summary of your holdings', on: true },
              ].map((setting) => (
                <div key={setting.label} className="flex items-center justify-between py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="text-sm font-semibold text-[#F5F0E8]">{setting.label}</div>
                    <div className="text-[11px] text-[#555] mt-0.5">{setting.desc}</div>
                  </div>
                  <div className="w-10 h-5.5 rounded-full relative cursor-pointer"
                    style={{ background: setting.on ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)', padding: '2px' }}>
                    <div className="w-4 h-4 rounded-full bg-white transition-transform"
                      style={{ transform: setting.on ? 'translateX(20px)' : 'translateX(0)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── SETTINGS ──────────────────────────────── */}
      {section === 'settings' && (
        <ChangePasswordSection />
      )}

      {/* Sell modal */}
      <AnimatePresence>
        {sellTarget && (
          <SellModal
            row={sellTarget}
            sellSharePct={data?.platform?.sell_share_pct ?? 5}
            onClose={() => setSellTarget(null)}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
