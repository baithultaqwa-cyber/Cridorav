import { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Users, Building2, BarChart2, AlertTriangle, Shield, CheckCircle,
  XCircle, Clock, Lock, Unlock, TrendingUp, Settings, FileText,
  DollarSign, Eye, Flag, Gavel, Activity, ChevronDown, ChevronUp,
  Search, ToggleLeft, ToggleRight, AlertCircle, Info, ExternalLink,
  Upload
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { API_AUTH_BASE as API } from '../../config'

const NAV = [
  { sectionKey: 'overview',    icon: BarChart2,    label: 'Overview' },
  { sectionKey: 'users',       icon: Users,        label: 'Users' },
  { sectionKey: 'kyc',         icon: Shield,       label: 'KYC Queue' },
  { sectionKey: 'vendors',     icon: Building2,    label: 'Vendors' },
  { sectionKey: 'transactions',icon: TrendingUp,   label: 'Transactions' },
  { sectionKey: 'settlement',  icon: DollarSign,   label: 'Settlement' },
  { sectionKey: 'config',      icon: Settings,     label: 'Fees & Config' },
  { sectionKey: 'risk',        icon: AlertTriangle,label: 'Risk & Disputes' },
  { sectionKey: 'audit',       icon: FileText,     label: 'Audit Logs' },
  { sectionKey: 'settings',    icon: Settings,     label: 'Settings' },
]

const KYC_COLOR = { pending: '#f59e0b', verified: '#10b981', rejected: '#ef4444' }
const KYB_COLOR = { pending: '#f59e0b', verified: '#10b981', rejected: '#ef4444' }
const USER_TYPE_LABEL = { admin: 'Admin', vendor: 'Vendor', customer: 'Customer' }
const USER_TYPE_COLOR = { admin: '#C9A84C', vendor: '#A8A9AD', customer: '#B87333' }
const RISK_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }
const LOG_COLOR = {
  compliance: '#C9A84C', vendor: '#A8A9AD', risk: '#ef4444',
  config: '#B87333', finance: '#10b981', system: '#555',
}

function StatCard({ label, value, sub, color = '#C9A84C', icon: Icon, alert }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: `${color}08`, border: `1px solid ${alert ? '#ef4444' : color}20` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#555]">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-black text-[#F5F0E8]">{value}</div>
      {sub && <div className="text-[11px] text-[#555]">{sub}</div>}
    </motion.div>
  )
}

const DOC_STATUS_STYLE = {
  not_uploaded: { color: '#555',    label: 'Not Uploaded' },
  pending:      { color: '#f59e0b', label: 'Pending Review' },
  verified:     { color: '#10b981', label: 'Verified' },
  rejected:     { color: '#ef4444', label: 'Rejected' },
}

function DocumentPanel({ userId, authFetch, onRefresh }) {
  const [docs, setDocs] = useState(null)
  const [rejectState, setRejectState] = useState({})
  const [busy, setBusy] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    authFetch(`${API}/admin/documents/${userId}/`)
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => setDocs([]))
  }, [userId])

  const reviewDoc = async (docId, action, reason = '') => {
    setBusy((p) => ({ ...p, [docId]: true }))
    setMsg('')
    try {
      const res = await authFetch(`${API}/admin/documents/${docId}/${action}/`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      const d = await res.json()
      setDocs((prev) => prev.map((doc) => (doc.id === docId ? d : doc)))
      setRejectState((p) => { const n = { ...p }; delete n[docId]; return n })
      setMsg(action === 'verify' ? 'Document verified.' : 'Document rejected.')
      onRefresh()
    } catch {
      setMsg('Action failed.')
    } finally {
      setBusy((p) => ({ ...p, [docId]: false }))
    }
  }

  if (!docs) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-[#555]">
      <div className="w-4 h-4 border border-[#333] border-t-[#C9A84C] rounded-full animate-spin" />
      Loading documents…
    </div>
  )

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-3 font-semibold">Verification Documents</div>
      {msg && (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs text-emerald-400"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
          {msg}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {docs.map((doc) => {
          const st = DOC_STATUS_STYLE[doc.status] || DOC_STATUS_STYLE.not_uploaded
          const isRejecting = rejectState[doc.id]?.open
          const isBusy = busy[doc.id]
          return (
            <div key={doc.doc_type} className="rounded-xl p-3"
              style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${doc.status === 'rejected' ? 'rgba(239,68,68,0.2)' : doc.status === 'verified' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.color }} />
                  <div>
                    <span className="text-xs font-semibold text-[#F5F0E8]">{doc.label}</span>
                    {doc.uploaded_at && (
                      <span className="ml-2 text-[10px] text-[#444]">{doc.original_filename} · {doc.uploaded_at}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                    style={{ background: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </span>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-semibold"
                      style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                      <ExternalLink size={9} /> View
                    </a>
                  )}
                  {doc.status !== 'not_uploaded' && doc.status !== 'verified' && (
                    <button disabled={isBusy} onClick={() => reviewDoc(doc.id, 'verify')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                      style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                      <CheckCircle size={9} /> Verify
                    </button>
                  )}
                  {doc.status !== 'not_uploaded' && doc.status !== 'rejected' && (
                    <button disabled={isBusy}
                      onClick={() => setRejectState((p) => ({ ...p, [doc.id]: { open: !p[doc.id]?.open, reason: p[doc.id]?.reason || '' } }))}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                      <XCircle size={9} /> Reject
                    </button>
                  )}
                  {doc.status === 'rejected' && (
                    <button disabled={isBusy}
                      onClick={() => setRejectState((p) => ({ ...p, [doc.id]: { open: !p[doc.id]?.open, reason: p[doc.id]?.reason || doc.rejection_reason || '' } }))}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                      Update Reason
                    </button>
                  )}
                </div>
              </div>
              {doc.rejection_reason && doc.status === 'rejected' && !isRejecting && (
                <div className="mt-2 text-[10px] text-red-400 pl-5">
                  Rejected: {doc.rejection_reason}
                </div>
              )}
              {isRejecting && (
                <div className="mt-2 flex gap-2 items-start">
                  <input
                    autoFocus
                    placeholder="Rejection reason (required)"
                    value={rejectState[doc.id]?.reason || ''}
                    onChange={(e) => setRejectState((p) => ({ ...p, [doc.id]: { ...p[doc.id], reason: e.target.value } }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs text-[#F5F0E8]"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', outline: 'none' }}
                  />
                  <button
                    disabled={!rejectState[doc.id]?.reason?.trim() || isBusy}
                    onClick={() => reviewDoc(doc.id, 'reject', rejectState[doc.id]?.reason)}
                    className="px-3 py-2 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                    Confirm
                  </button>
                  <button onClick={() => setRejectState((p) => { const n = { ...p }; delete n[doc.id]; return n })}
                    className="px-3 py-2 rounded-lg text-[9px] text-[#555]">✕</button>
                </div>
              )}
            </div>
          )
        })}
        {docs.length === 0 && (
          <p className="text-xs text-[#444] py-2">No documents uploaded yet.</p>
        )}
      </div>
    </div>
  )
}

const BANK_STATUS_STYLE = {
  not_added: { color: '#555',    label: 'Not Added' },
  pending:   { color: '#f59e0b', label: 'Pending Review' },
  verified:  { color: '#10b981', label: 'Verified' },
  rejected:  { color: '#ef4444', label: 'Rejected' },
}

function BankDetailsPanel({ userId, authFetch, onRefresh }) {
  const [bank, setBank] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  useEffect(() => {
    authFetch(`${API}/admin/bank-details/${userId}/`)
      .then((r) => r.json())
      .then(setBank)
      .catch(() => setBank({ status: 'not_added' }))
  }, [userId])

  const act = async (action) => {
    setBusy(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const res = await authFetch(`${API}/admin/bank-details/${userId}/${action}/`, { method: 'POST' })
      let d = {}
      try { d = await res.json() } catch {}
      if (res.ok) {
        setBank(d)
        setMsg({ text: action === 'verify' ? 'Bank details verified.' : 'Bank details rejected.', type: 'ok' })
        onRefresh()
      } else {
        setMsg({ text: d.detail || 'Action failed.', type: 'err' })
      }
    } catch {
      setMsg({ text: 'Network error.', type: 'err' })
    } finally {
      setBusy(false)
    }
  }

  if (!bank) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-[#555]">
      <div className="w-4 h-4 border border-[#333] border-t-[#C9A84C] rounded-full animate-spin" />
      Loading bank details…
    </div>
  )

  const st = BANK_STATUS_STYLE[bank.status] || BANK_STATUS_STYLE.not_added

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[#555] font-semibold">Bank Details</div>
        <span className="text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
          style={{ background: `${st.color}15`, color: st.color }}>
          {st.label}
        </span>
      </div>

      {msg.text && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg.type === 'ok' ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
          {msg.text}
        </div>
      )}

      {bank.status === 'not_added' ? (
        <p className="text-xs text-[#444] py-2">Customer has not added bank details yet.</p>
      ) : (
        <div className="rounded-xl p-3"
          style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${st.color}20` }}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
            {[
              ['Account Name',   bank.account_name   || '—'],
              ['Bank Name',      bank.bank_name       || '—'],
              ['Account Number', bank.account_number  || '—'],
              ['IFSC / SWIFT',   bank.ifsc            || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[9px] tracking-widest uppercase text-[#444] mb-0.5">{label}</div>
                <div className="text-xs font-semibold text-[#F5F0E8]">{value}</div>
              </div>
            ))}
          </div>
          {bank.updated_at && (
            <div className="text-[9px] text-[#444] mb-3">Submitted: {bank.updated_at}</div>
          )}
          {bank.status !== 'verified' && bank.status !== 'rejected' && (
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => act('verify')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                <CheckCircle size={9} /> Verify
              </button>
              <button disabled={busy} onClick={() => act('reject')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                <XCircle size={9} /> Reject
              </button>
            </div>
          )}
          {bank.status === 'verified' && (
            <button disabled={busy} onClick={() => act('reject')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <XCircle size={9} /> Revoke
            </button>
          )}
          {bank.status === 'rejected' && (
            <button disabled={busy} onClick={() => act('verify')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] tracking-widest uppercase font-bold disabled:opacity-40"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
              <CheckCircle size={9} /> Re-verify
            </button>
          )}
        </div>
      )}
    </div>
  )
}


export default function AdminDashboard() {
  const { authFetch } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('overview')
  const [txFilter, setTxFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [flags, setFlags] = useState({})
  const [actionBusy, setActionBusy] = useState({})
  const [actionMsg, setActionMsg] = useState('')
  const [expandedDocs, setExpandedDocs] = useState({})
  const [feeEdit, setFeeEdit] = useState({})
  const [feeSaving, setFeeSaving] = useState({})
  const [feeMsg, setFeeMsg] = useState('')
  const [timerEdit, setTimerEdit] = useState({})
  const [timerSaving, setTimerSaving] = useState({})
  const [timerMsg, setTimerMsg] = useState('')
  const [pendingSellOrders, setPendingSellOrders] = useState([])
  const [sellBusy, setSellBusy] = useState({})
  const [pwdRequests, setPwdRequests] = useState([])
  const [pwdBusy, setPwdBusy] = useState({})
  const [pwdTemp, setPwdTemp] = useState({})
  const [pwdMsg, setPwdMsg] = useState({})
  const [adminPwdForm, setAdminPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [adminPwdMsg, setAdminPwdMsg] = useState(null)
  const [adminPwdSaving, setAdminPwdSaving] = useState(false)

  const loadData = () => {
    authFetch(`${API}/dashboard/admin/`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadPendingSells = async () => {
    try {
      const r = await authFetch(`${API}/admin/sell-orders/`)
      if (r.ok) setPendingSellOrders(await r.json())
    } catch {}
  }

  const loadPwdRequests = async () => {
    try {
      const r = await authFetch(`${API}/admin/password-requests/`)
      if (r.ok) setPwdRequests(await r.json())
    } catch {}
  }

  const handleSetTempPassword = async (reqId) => {
    const temp = (pwdTemp[reqId] || '').trim()
    if (temp.length < 6) {
      setPwdMsg((p) => ({ ...p, [reqId]: { type: 'error', text: 'Temp password must be at least 6 characters.' } })); return
    }
    setPwdBusy((p) => ({ ...p, [reqId]: true })); setPwdMsg((p) => ({ ...p, [reqId]: null }))
    try {
      const res = await authFetch(`${API}/admin/password-requests/${reqId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_password: temp }),
      })
      const d = await res.json()
      if (res.ok) {
        setPwdRequests((prev) => prev.filter((r) => r.id !== reqId))
        setPwdMsg((p) => ({ ...p, [reqId]: { type: 'ok', text: d.detail } }))
      } else {
        setPwdMsg((p) => ({ ...p, [reqId]: { type: 'error', text: d.detail || 'Failed.' } }))
      }
    } catch {
      setPwdMsg((p) => ({ ...p, [reqId]: { type: 'error', text: 'Network error.' } }))
    } finally {
      setPwdBusy((p) => ({ ...p, [reqId]: false }))
    }
  }

  const handleAdminChangePassword = async (e) => {
    e.preventDefault()
    if (adminPwdForm.new_password !== adminPwdForm.confirm_password) {
      setAdminPwdMsg({ type: 'error', text: 'New passwords do not match.' }); return
    }
    if (adminPwdForm.new_password.length < 8) {
      setAdminPwdMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return
    }
    setAdminPwdSaving(true); setAdminPwdMsg(null)
    try {
      const res = await authFetch(`${API}/change-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: adminPwdForm.old_password, new_password: adminPwdForm.new_password }),
      })
      const d = await res.json()
      if (res.ok) {
        setAdminPwdMsg({ type: 'ok', text: 'Password changed successfully.' })
        setAdminPwdForm({ old_password: '', new_password: '', confirm_password: '' })
      } else {
        setAdminPwdMsg({ type: 'error', text: d.detail || 'Failed.' })
      }
    } catch {
      setAdminPwdMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setAdminPwdSaving(false)
    }
  }

  useEffect(() => { loadData(); loadPendingSells(); loadPwdRequests() }, [authFetch])

  const handleSellApproval = async (soId, action) => {
    setSellBusy((p) => ({ ...p, [soId]: true }))
    try {
      const r = await authFetch(`${API}/admin/sell-orders/${soId}/${action}/`, { method: 'POST' })
      if (r.ok) await loadPendingSells()
    } catch {}
    setSellBusy((p) => ({ ...p, [soId]: false }))
  }

  const act = async (key, url) => {
    setActionBusy((p) => ({ ...p, [key]: true }))
    setActionMsg('')
    try {
      const res = await authFetch(url, { method: 'POST' })
      const d = await res.json()
      setActionMsg(d.detail || 'Done.')
      loadData()
    } catch {
      setActionMsg('Action failed. Please try again.')
    } finally {
      setActionBusy((p) => ({ ...p, [key]: false }))
    }
  }

  const saveFee = async (key) => {
    const value = feeEdit[key]
    if (value == null || value === '') return
    const num = parseFloat(value)
    if (isNaN(num) || num < 0 || num > 100) {
      setFeeMsg('Enter a valid percentage between 0 and 100.')
      return
    }
    setFeeSaving((p) => ({ ...p, [key]: true }))
    setFeeMsg('')
    try {
      const res = await authFetch(`${API}/admin/platform-config/`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: num }),
      })
      let d = {}
      try { d = await res.json() } catch {}
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          fees_config: { ...(prev?.fees_config || {}), ...d },
        }))
        setFeeEdit((p) => { const n = { ...p }; delete n[key]; return n })
        setFeeMsg('Fee updated.')
        setTimeout(() => setFeeMsg(''), 3000)
      } else {
        setFeeMsg(d.detail || 'Save failed.')
      }
    } catch {
      setFeeMsg('Network error.')
    } finally {
      setFeeSaving((p) => ({ ...p, [key]: false }))
    }
  }

  const saveTimer = async (key) => {
    const value = timerEdit[key]
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 5 || num > 3600) {
      setTimerMsg('Enter a valid duration between 5 and 3600 seconds.')
      return
    }
    setTimerSaving((p) => ({ ...p, [key]: true }))
    setTimerMsg('')
    try {
      const res = await authFetch(`${API}/admin/platform-config/`, {
        method: 'PATCH',
        body: JSON.stringify({ [key]: num }),
      })
      let d = {}
      try { d = await res.json() } catch {}
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          fees_config: { ...(prev?.fees_config || {}), ...d },
        }))
        setTimerEdit((p) => { const n = { ...p }; delete n[key]; return n })
        setTimerMsg('Timer updated.')
        setTimeout(() => setTimerMsg(''), 3000)
      } else {
        setTimerMsg(d.detail || 'Save failed.')
      }
    } catch {
      setTimerMsg('Network error.')
    } finally {
      setTimerSaving((p) => ({ ...p, [key]: false }))
    }
  }

  const handleKYC = (userId, action) =>
    act(`kyc-${userId}`, `${API}/admin/kyc/${userId}/${action}/`)

  const handleKYB = (userId, action) =>
    act(`kyb-${userId}`, `${API}/admin/kyb/${userId}/${action}/`)

  const handleFreeze = (userId, currentlyActive) =>
    act(`freeze-${userId}`, `${API}/admin/user/${userId}/${currentlyActive ? 'freeze' : 'unfreeze'}/`)

  if (loading) return (
    <DashboardLayout navItems={NAV} title="Admin Dashboard" activeSection={section} onSectionChange={setSection}>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(201,168,76,0.2)', borderTopColor: '#C9A84C' }} />
      </div>
    </DashboardLayout>
  )

  const stats = data?.stats || {}
  const users = data?.users || []
  const kycQueue = data?.kyc_queue || []
  const vendors = data?.vendors || []
  const transactions = data?.recent_transactions || []
  const settlement = data?.settlement || {}
  const feesConfig = data?.fees_config || {}
  const riskDisputes = data?.risk_disputes || []
  const auditLogs = data?.audit_logs || []

  const filteredUsers = users.filter((u) =>
    userSearch === '' ||
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )
  const filteredTx = txFilter === 'all' ? transactions : transactions.filter((t) => t.type === txFilter)

  const navWithBadge = NAV.map((n) => ({
    ...n,
    badge: n.sectionKey === 'kyc' ? (kycQueue.length + (data?.kyb_queue?.length || 0))
         : n.sectionKey === 'settlement' ? pendingSellOrders.length
         : n.sectionKey === 'risk' ? riskDisputes.filter((r) => r.status === 'open').length
         : n.sectionKey === 'settings' ? pwdRequests.length
         : 0,
  }))

  const SECTION_TITLES = {
    overview: 'Platform Overview',
    users: 'User Management',
    kyc: 'KYC Queue',
    vendors: 'Vendor Management',
    transactions: 'Transactions',
    settlement: 'Settlement & Finance',
    config: 'Fees & Configuration',
    risk: 'Risk & Disputes',
    audit: 'Audit Logs',
  }

  return (
    <DashboardLayout navItems={navWithBadge} title={SECTION_TITLES[section] || 'Admin'}
      activeSection={section} onSectionChange={setSection}>

      {/* Desktop section tabs */}
      <div className="hidden lg:flex flex-wrap gap-2 mb-8 overflow-x-auto">
        {navWithBadge.map((t) => (
          <button key={t.sectionKey} onClick={() => setSection(t.sectionKey)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs tracking-widest uppercase font-semibold transition-all whitespace-nowrap"
            style={section === t.sectionKey
              ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
              : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }}>
            <t.icon size={13} />
            {t.label}
            {t.badge > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── OVERVIEW ─────────────────────────────────── */}
      {section === 'overview' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Users" value={stats.total_users} sub="All accounts" color="#C9A84C" icon={Users} />
            <StatCard label="Active Users" value={stats.active_users} sub="Customers" color="#10b981" icon={Users} />
            <StatCard label="Pending KYC" value={stats.pending_users} sub="Needs review" color="#f59e0b" icon={Clock} />
            <StatCard label="Vendors" value={stats.total_vendors} sub={`${stats.pending_vendors} pending`} color="#A8A9AD" icon={Building2} />
            <StatCard label="Alerts" value={stats.alerts} sub="Action required" color="#ef4444" alert icon={AlertTriangle} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
            {[
              { label: 'Total Buy Volume', value: `AED ${stats.total_buy_volume_aed?.toLocaleString()}`, color: '#10b981' },
              { label: 'Total Sell-back Volume', value: `AED ${stats.total_sellback_volume_aed?.toLocaleString()}`, color: '#ef4444' },
              { label: 'Platform Revenue', value: `AED ${stats.platform_revenue_aed?.toLocaleString()}`, color: '#C9A84C' },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl p-5"
                style={{ background: `${m.color}06`, border: `1px solid ${m.color}18` }}>
                <div className="text-[10px] tracking-widest uppercase text-[#555] mb-2">{m.label}</div>
                <div className="text-xl font-black" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Alerts */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={13} /> Active Alerts
              </h3>
              {[
                { msg: 'KYC queue has pending verifications', time: '2 min ago' },
                { msg: 'Sell-back request flagged for manual review', time: '18 min ago' },
              ].map((a) => (
                <div key={a.msg} className="flex items-start justify-between gap-3 py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(239,68,68,0.08)' }}>
                  <p className="text-xs text-[#888] leading-relaxed">{a.msg}</p>
                  <span className="text-[10px] text-[#555] whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>

            {/* User breakdown */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] mb-4">User Breakdown</h3>
              {['customer', 'vendor', 'admin'].map((type) => {
                const count = users.filter((u) => u.user_type === type).length
                const pct = users.length ? Math.round((count / users.length) * 100) : 0
                return (
                  <div key={type} className="py-3 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#888] capitalize">{USER_TYPE_LABEL[type]}</span>
                      <span className="text-sm font-bold text-[#F5F0E8]">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: USER_TYPE_COLOR[type] }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recent activity */}
            <div className="md:col-span-2 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-4">Recent Platform Activity</h3>
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 py-3 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                      style={tx.type === 'BUY' ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      {tx.type}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-[#F5F0E8]">{tx.customer} · {tx.product}</div>
                      <div className="text-[10px] text-[#555]">{tx.vendor} · {tx.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: '#C9A84C' }}>AED {tx.amount_aed?.toLocaleString()}</div>
                    <div className={`text-[10px] ${tx.status === 'Completed' ? 'text-emerald-400' : tx.status === 'Failed' ? 'text-red-400' : 'text-amber-400'}`}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── USERS ────────────────────────────────────── */}
      {section === 'users' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Search size={14} className="text-[#555]" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="flex-1 bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#444]" />
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                    {['#', 'Name', 'Email', 'Type', 'KYC', 'Joined', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => {
                    const frozen = !u.is_active
                    const busy = actionBusy[`freeze-${u.id}`]
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td className="px-4 py-3 text-[#555] text-xs font-mono">#{u.id}</td>
                        <td className="px-4 py-3 text-[#F5F0E8] font-medium whitespace-nowrap">{u.name}</td>
                        <td className="px-4 py-3 text-[#888] text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                            style={{ background: `${USER_TYPE_COLOR[u.user_type]}15`, color: USER_TYPE_COLOR[u.user_type] }}>
                            {USER_TYPE_LABEL[u.user_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: KYC_COLOR[u.kyc_status] }} />
                            <span className="text-[10px] tracking-widest uppercase" style={{ color: KYC_COLOR[u.kyc_status] }}>{u.kyc_status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#555] text-xs">{u.joined}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] tracking-widest uppercase font-semibold ${frozen ? 'text-red-400' : 'text-emerald-400'}`}>
                            {frozen ? 'Frozen' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.user_type !== 'admin' && (
                            <button
                              disabled={busy}
                              onClick={() => handleFreeze(u.id, u.is_active)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all disabled:opacity-40"
                              style={frozen
                                ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }
                                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                              {frozen ? <><Unlock size={10} /> Unfreeze</> : <><Lock size={10} /> Freeze</>}
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
        </div>
      )}

      {/* ─── KYC QUEUE ────────────────────────────────── */}
      {section === 'kyc' && (
        <div>
          {actionMsg && (
            <div className="mb-4 px-4 py-2.5 rounded-xl text-xs text-emerald-400 flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle size={13} /> {actionMsg}
            </div>
          )}

          {/* Customer KYC */}
          <p className="text-xs text-[#555] mb-4 tracking-wide uppercase font-semibold">Customer KYC</p>
          {kycQueue.length === 0 ? (
            <div className="text-center py-10 rounded-2xl mb-6"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <CheckCircle size={28} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-[#555]">KYC queue is clear</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {kycQueue.map((u) => {
                const busy = actionBusy[`kyc-${u.id}`]
                const docsOpen = expandedDocs[`kyc-${u.id}`]
                return (
                  <div key={u.id} className="rounded-2xl p-5"
                    style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                          {u.name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#F5F0E8]">{u.name}</div>
                          <div className="text-xs text-[#666] mt-0.5">{u.email} · Joined {u.joined}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px]"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          <Clock size={10} /> KYC Pending
                        </div>
                        {u.bank_status === 'pending' && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px]"
                            style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>
                            <DollarSign size={10} /> Bank Pending
                          </div>
                        )}
                        <button onClick={() => setExpandedDocs((p) => ({ ...p, [`kyc-${u.id}`]: !p[`kyc-${u.id}`] }))}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
                          <FileText size={10} /> Review {docsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                        <button disabled={busy} onClick={() => handleKYC(u.id, 'approve')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                          <CheckCircle size={11} /> Approve KYC
                        </button>
                        <button disabled={busy} onClick={() => handleKYC(u.id, 'reject')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          <XCircle size={11} /> Reject KYC
                        </button>
                      </div>
                    </div>
                    {docsOpen && (
                      <DocumentPanel userId={u.id} authFetch={authFetch} onRefresh={loadData} />
                    )}
                    {docsOpen && (
                      <BankDetailsPanel userId={u.id} authFetch={authFetch} onRefresh={loadData} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Vendor KYB */}
          <p className="text-xs text-[#555] mb-4 tracking-wide uppercase font-semibold">Vendor KYB</p>
          {(data?.kyb_queue || []).length === 0 ? (
            <div className="text-center py-10 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <CheckCircle size={28} className="mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-[#555]">KYB queue is clear</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(data?.kyb_queue || []).map((v) => {
                const busy = actionBusy[`kyb-${v.id}`]
                const docsOpen = expandedDocs[`kyb-${v.id}`]
                return (
                  <div key={v.id} className="rounded-2xl p-5"
                    style={{ background: 'rgba(168,169,173,0.04)', border: '1px solid rgba(168,169,173,0.15)' }}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                          style={{ background: 'rgba(168,169,173,0.15)', color: '#A8A9AD' }}>
                          {v.vendor_company?.[0] || v.name?.[0] || 'V'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#F5F0E8]">{v.vendor_company || v.name}</div>
                          <div className="text-xs text-[#666] mt-0.5">{v.email} · Joined {v.joined}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px]"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                          <Clock size={10} /> KYB Pending
                        </div>
                        <button onClick={() => setExpandedDocs((p) => ({ ...p, [`kyb-${v.id}`]: !p[`kyb-${v.id}`] }))}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
                          <FileText size={10} /> Docs {docsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                        <button disabled={busy} onClick={() => handleKYB(v.id, 'approve')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                          <CheckCircle size={11} /> Approve KYB
                        </button>
                        <button disabled={busy} onClick={() => handleKYB(v.id, 'reject')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    </div>
                    {docsOpen && (
                      <DocumentPanel userId={v.id} authFetch={authFetch} onRefresh={loadData} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── VENDORS ──────────────────────────────────── */}
      {section === 'vendors' && (
        <div>
          <p className="text-xs text-[#555] mb-6 tracking-wide">
            Manage vendor KYB approvals, status, and marketplace access.
          </p>
          {vendors.length === 0 ? (
            <div className="text-center py-16 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Building2 size={28} className="mx-auto text-[#444] mb-3" />
              <p className="text-sm text-[#555]">No vendors registered yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {vendors.map((v) => {
                const frozen = !v.is_active
                const kybStatus = v.kyb_status
                const busyKYB = actionBusy[`kyb-${v.id}`]
                const busyFreeze = actionBusy[`freeze-${v.id}`]
                return (
                  <div key={v.id} className="rounded-2xl p-5"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black"
                          style={{ background: 'rgba(168,169,173,0.1)', color: '#A8A9AD' }}>
                          {(v.company || 'V').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-[#F5F0E8]">{v.company}</span>
                            {kybStatus === 'verified' && <Shield size={12} className="text-emerald-400" />}
                          </div>
                          <div className="text-xs text-[#666]">{v.owner} · {v.email}</div>
                          <div className="text-[10px] text-[#444] mt-0.5 font-mono">
                            ID:{v.id} · {v.country} · Joined {v.joined}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-right">
                          <div className="text-[10px] tracking-widest uppercase text-[#555]">Volume</div>
                          <div className="text-sm font-bold" style={{ color: '#C9A84C' }}>
                            AED {(v.total_volume_aed || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] tracking-widest uppercase text-[#555]">Listings</div>
                          <div className="text-sm font-bold text-[#F5F0E8]">{v.total_listings}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 flex-wrap gap-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: KYB_COLOR[kybStatus] }} />
                          <span className="text-[10px] tracking-widest uppercase font-semibold" style={{ color: KYB_COLOR[kybStatus] }}>
                            KYB: {kybStatus}
                          </span>
                        </div>
                        <span className={`text-[10px] tracking-widest uppercase font-semibold ${frozen ? 'text-red-400' : 'text-emerald-400'}`}>
                          {frozen ? '· Frozen' : '· Active'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {kybStatus === 'pending' && (
                          <>
                            <button disabled={busyKYB} onClick={() => handleKYB(v.id, 'approve')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                              <CheckCircle size={11} /> Approve KYB
                            </button>
                            <button disabled={busyKYB} onClick={() => handleKYB(v.id, 'reject')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                              <XCircle size={11} /> Reject
                            </button>
                          </>
                        )}
                        <button
                          disabled={busyFreeze}
                          onClick={() => handleFreeze(v.id, v.is_active)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold disabled:opacity-40"
                          style={frozen
                            ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }
                            : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                          {frozen ? <><Unlock size={10} /> Activate</> : <><Lock size={10} /> Freeze</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TRANSACTIONS ─────────────────────────────── */}
      {section === 'transactions' && (
        <div>
          <div className="flex gap-2 mb-5 flex-wrap">
            {['all', 'BUY', 'SELL'].map((f) => (
              <button key={f} onClick={() => setTxFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold transition-all"
                style={txFilter === f
                  ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
                  : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
                }>{f === 'all' ? 'All' : f}</button>
            ))}
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                    {['Txn ID', 'Type', 'Customer', 'Vendor', 'Product', 'Amount (AED)', 'Status', 'Date'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td className="px-4 py-3 text-[#C9A84C] font-mono text-xs">{tx.id}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                          style={tx.type === 'BUY' ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' } : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#F5F0E8] whitespace-nowrap">{tx.customer}</td>
                      <td className="px-4 py-3 text-[#888] text-xs whitespace-nowrap">{tx.vendor}</td>
                      <td className="px-4 py-3 text-[#888] text-xs whitespace-nowrap">{tx.product}</td>
                      <td className="px-4 py-3 text-[#F5F0E8] font-bold">AED {tx.amount_aed?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] tracking-widest uppercase font-semibold
                          ${tx.status === 'Completed' ? 'text-emerald-400' : tx.status === 'Failed' ? 'text-red-400' : 'text-amber-400'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#555] text-xs">{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SETTLEMENT ───────────────────────────────── */}
      {section === 'settlement' && (
        <div>

          {/* ── Pending Sell Payouts ── */}
          {pendingSellOrders.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Pending Sell Payouts</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {pendingSellOrders.length}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {pendingSellOrders.map((so) => {
                    const profitPos = so.profit_aed >= 0
                    return (
                      <motion.div key={so.id} layout
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-2xl p-5"
                        style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                          <div>
                            <div className="text-sm font-bold font-mono text-[#F5F0E8]">{so.order_ref}</div>
                            <div className="text-xs text-[#666] mt-0.5">
                              {so.customer_name} · {so.product_name} · {so.purity} · {Number(so.qty_grams).toFixed(4)}g {so.metal}
                            </div>
                            <div className="text-[10px] text-[#444] mt-0.5">
                              Buy order: {so.buy_order_ref} ·{' '}
                              {so.status === 'admin_approved'
                                ? 'Funds confirmed — send payout to customer, then complete'
                                : 'Vendor accepted — confirm funds before payout'}
                            </div>
                            {so.vendor_balance_used !== undefined && (
                              <div className="text-[10px] text-amber-400/90 mt-1">
                                Vendor pool at accept: AED {Number(so.vendor_pool_balance_at_accept ?? 0).toFixed(2)}
                                {so.vendor_balance_used ? ' · Vendor balance applied toward payout' : ' · Collect from vendor before customer payout'}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black" style={{ color: '#C9A84C' }}>
                              Net payout: AED {Number(so.net_payout_aed).toFixed(2)}
                            </div>
                            <div className={`text-xs font-semibold mt-0.5 ${profitPos ? 'text-emerald-400' : 'text-red-400'}`}>
                              Customer {profitPos ? 'profit' : 'loss'}: {profitPos ? '+' : ''}AED {Number(so.profit_aed).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {/* Breakdown grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl mb-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
                          {[
                            ['Purchase rate', `AED ${Number(so.purchase_rate_per_gram).toFixed(4)}/g`],
                            ['Buyback rate', `AED ${Number(so.buyback_rate_per_gram).toFixed(4)}/g`],
                            [`Cridora share (${Number(so.cridora_share_pct).toFixed(1)}%)`, `AED ${Number(so.cridora_share_aed).toFixed(2)}`],
                            ['Gross buyback', `AED ${Number(so.gross_aed).toFixed(2)}`],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div className="text-[10px] text-[#444] mb-0.5">{k}</div>
                              <div className="text-xs font-semibold text-[#888]">{v}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {so.status === 'vendor_accepted' && (
                            <button
                              onClick={() => handleSellApproval(so.id, 'approve')}
                              disabled={!!sellBusy[so.id]}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                              style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa' }}>
                              <CheckCircle size={12} /> Confirm funds secured
                            </button>
                          )}
                          {so.status === 'admin_approved' && (
                            <button
                              onClick={() => handleSellApproval(so.id, 'complete')}
                              disabled={!!sellBusy[so.id]}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                              <CheckCircle size={12} /> Mark payout complete
                            </button>
                          )}
                          <button
                            onClick={() => handleSellApproval(so.id, 'reject')}
                            disabled={!!sellBusy[so.id]}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Inflow', value: `AED ${settlement.total_inflow_aed?.toLocaleString()}`, color: '#10b981' },
              { label: 'Vendor Payouts', value: `AED ${settlement.vendor_payouts_aed?.toLocaleString()}`, color: '#A8A9AD' },
              { label: 'Platform Fees', value: `AED ${settlement.platform_fees_aed?.toLocaleString()}`, color: '#C9A84C' },
              { label: 'Pending Settlement', value: `AED ${settlement.pending_settlement_aed?.toLocaleString()}`, color: '#ef4444' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-5"
                style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                <div className="text-[10px] tracking-widest uppercase text-[#555] mb-2">{s.label}</div>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-emerald-400">Reconciliation: Current</div>
              <div className="text-[11px] text-[#555]">Last reconciled: {settlement.last_reconciled}</div>
            </div>
          </div>

          <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-4">Vendor Pool Balances</h3>
          <div className="flex flex-col gap-3">
            {(settlement.vendor_pools || []).map((pool) => (
              <div key={pool.vendor} className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-sm font-bold text-[#F5F0E8]">{pool.vendor}</div>
                  <div className="text-[11px] text-[#555] mt-0.5">Isolated vendor pool</div>
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-[#555]">Pool Balance</div>
                    <div className="text-sm font-bold" style={{ color: '#C9A84C' }}>AED {pool.pool_balance_aed?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-[#555]">Reserved</div>
                    <div className="text-sm font-bold text-red-400">AED {pool.reserved_aed?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-[#555]">Available</div>
                    <div className="text-sm font-bold text-emerald-400">AED {pool.available_aed?.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FEES & CONFIG ────────────────────────────── */}
      {section === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform fees */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
              <DollarSign size={14} className="text-[#C9A84C]" /> Platform Fees
            </h3>
            {feeMsg && (
              <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${feeMsg.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ background: feeMsg.includes('updated') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${feeMsg.includes('updated') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                {feeMsg.includes('updated') ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {feeMsg}
              </div>
            )}
            <div className="flex flex-col gap-5">
              {[
                { label: 'Buy Fee', key: 'buy_fee_pct', value: feesConfig.buy_fee_pct, color: '#10b981', desc: 'Charged on every customer buy order' },
                { label: 'Sell Fee', key: 'sell_fee_pct', value: feesConfig.sell_fee_pct, color: '#ef4444', desc: 'Flat fee charged on every sell-back request' },
                { label: 'Sell Profit Share', key: 'sell_share_pct', value: feesConfig.sell_share_pct, color: '#C9A84C', desc: "Cridora's share of customer's profit on sell-back (applied only when profit > 0)" },
              ].map((fee) => {
                const isEditing = fee.key in feeEdit
                const isSaving = feeSaving[fee.key]
                return (
                  <div key={fee.key} className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold text-[#F5F0E8]">{fee.label}</div>
                      <div className="text-[11px] text-[#555]">{fee.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-1">
                            <input
                              type="number" step="0.01" min="0" max="100"
                              value={feeEdit[fee.key]}
                              onChange={(e) => setFeeEdit((p) => ({ ...p, [fee.key]: e.target.value }))}
                              className="w-20 px-2 py-1.5 rounded-lg text-xs text-center font-bold"
                              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${fee.color}40`, color: fee.color, outline: 'none' }}
                              autoFocus
                            />
                            <span className="text-xs text-[#555]">%</span>
                          </div>
                          <button disabled={isSaving} onClick={() => saveFee(fee.key)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                            {isSaving ? '…' : <><CheckCircle size={9} /> Save</>}
                          </button>
                          <button onClick={() => setFeeEdit((p) => { const n = { ...p }; delete n[fee.key]; return n })}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] text-[#555]">✕</button>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-black" style={{ color: fee.color }}>{fee.value ?? '—'}%</div>
                          <button
                            onClick={() => setFeeEdit((p) => ({ ...p, [fee.key]: String(fee.value ?? '') }))}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order Timers */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
              <Clock size={14} className="text-[#C9A84C]" /> Order Timers
            </h3>
            {timerMsg && (
              <div className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${timerMsg.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
                style={{ background: timerMsg.includes('updated') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${timerMsg.includes('updated') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                {timerMsg.includes('updated') ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {timerMsg}
              </div>
            )}
            <div className="flex flex-col gap-5">
              {[
                { label: 'Customer Quote Timer', key: 'quote_ttl_seconds', value: feesConfig.quote_ttl_seconds, desc: 'Seconds a price quote is locked for the customer' },
                { label: 'Vendor Accept Timer', key: 'vendor_accept_ttl_seconds', value: feesConfig.vendor_accept_ttl_seconds, desc: 'Seconds a vendor has to accept or reject an order' },
              ].map((timer) => {
                const isEditing = timer.key in timerEdit
                const isSaving = timerSaving[timer.key]
                return (
                  <div key={timer.key} className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold text-[#F5F0E8]">{timer.label}</div>
                      <div className="text-[11px] text-[#555]">{timer.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-1">
                            <input
                              type="number" step="1" min="5" max="3600"
                              value={timerEdit[timer.key]}
                              onChange={(e) => setTimerEdit((p) => ({ ...p, [timer.key]: e.target.value }))}
                              className="w-20 px-2 py-1.5 rounded-lg text-xs text-center font-bold"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', outline: 'none' }}
                              autoFocus
                            />
                            <span className="text-xs text-[#555]">s</span>
                          </div>
                          <button disabled={isSaving} onClick={() => saveTimer(timer.key)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                            {isSaving ? '…' : <><CheckCircle size={9} /> Save</>}
                          </button>
                          <button onClick={() => setTimerEdit((p) => { const n = { ...p }; delete n[timer.key]; return n })}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] text-[#555]">✕</button>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-black" style={{ color: '#C9A84C' }}>{timer.value ?? 60}<span className="text-sm font-normal text-[#555] ml-1">s</span></div>
                          <button
                            onClick={() => setTimerEdit((p) => ({ ...p, [timer.key]: String(timer.value ?? 60) }))}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Feature flags */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
              <Settings size={14} className="text-[#C9A84C]" /> Feature Flags
            </h3>
            <div className="flex flex-col gap-4">
              {Object.entries(feesConfig.feature_flags || {}).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-sm text-[#888] capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="w-10 h-5 rounded-full relative"
                    style={{ background: enabled ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)', padding: '2px' }}>
                    <div className="w-4 h-4 rounded-full bg-white transition-transform"
                      style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor tiers */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
              <Building2 size={14} className="text-[#C9A84C]" /> Vendor Commission Tiers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(feesConfig.vendor_tiers || []).map((tier) => (
                <div key={tier.tier} className="p-4 rounded-xl"
                  style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
                  <div className="text-[10px] tracking-widest uppercase text-[#555] mb-2">{tier.tier}</div>
                  <div className="text-2xl font-black" style={{ color: '#C9A84C' }}>{tier.fee_pct}%</div>
                  <div className="text-[11px] text-[#555] mt-1">
                    Min volume: AED {tier.min_volume_aed?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RISK & DISPUTES ──────────────────────────── */}
      {section === 'risk' && (
        <div>
          <p className="text-xs text-[#555] mb-6 tracking-wide">
            Flagged transactions, disputes, and risk events requiring admin review.
          </p>
          <div className="flex flex-col gap-4">
            {riskDisputes.map((item) => {
              const resolvedLocally = flags[item.id]
              return (
                <div key={item.id} className="rounded-2xl p-5"
                  style={{
                    background: item.priority === 'high' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.priority === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${RISK_COLOR[item.priority]}15` }}>
                        {item.type === 'dispute' ? <Gavel size={16} style={{ color: RISK_COLOR[item.priority] }} /> : <Flag size={16} style={{ color: RISK_COLOR[item.priority] }} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#F5F0E8] font-mono">{item.id}</span>
                          <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-sm font-bold capitalize"
                            style={{ background: `${RISK_COLOR[item.priority]}15`, color: RISK_COLOR[item.priority] }}>
                            {item.priority}
                          </span>
                          <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-sm font-semibold capitalize"
                            style={{
                              background: item.status === 'resolved' ? 'rgba(16,185,129,0.1)' : item.status === 'open' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: item.status === 'resolved' ? '#10b981' : item.status === 'open' ? '#ef4444' : '#f59e0b',
                            }}>
                            {resolvedLocally ? 'resolved' : item.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#666] mt-0.5">{item.user} · {item.vendor}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#444]">{item.raised_at}</div>
                  </div>
                  <p className="text-xs text-[#888] mb-3 leading-relaxed">{item.description}</p>
                  {!resolvedLocally && item.status !== 'resolved' && (
                    <button onClick={() => setFlags((p) => ({ ...p, [item.id]: true }))}
                      className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── AUDIT LOGS ───────────────────────────────── */}
      {/* ─── SETTINGS ──────────────────────────────── */}
      {section === 'settings' && (
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8] mb-6">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Change own password */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-5 flex items-center gap-2">
                <Settings size={13} className="text-[#C9A84C]" /> Change My Password
              </h3>
              <form onSubmit={handleAdminChangePassword} className="flex flex-col gap-4">
                {[
                  { key: 'old_password',     label: 'Current Password' },
                  { key: 'new_password',     label: 'New Password' },
                  { key: 'confirm_password', label: 'Confirm New Password' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
                    <input type="password" value={adminPwdForm[key]}
                      onChange={(e) => setAdminPwdForm((p) => ({ ...p, [key]: e.target.value }))} required
                      className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8]"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }} />
                  </div>
                ))}
                {adminPwdMsg && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${adminPwdMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
                    style={{ background: adminPwdMsg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${adminPwdMsg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                    {adminPwdMsg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />} {adminPwdMsg.text}
                  </div>
                )}
                <button type="submit" disabled={adminPwdSaving}
                  className="btn-gold py-3 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50">
                  {adminPwdSaving ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Password reset requests */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] flex items-center gap-2">
                  <Lock size={13} className="text-[#C9A84C]" /> Password Reset Requests
                </h3>
                {pwdRequests.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {pwdRequests.length} pending
                  </span>
                )}
              </div>
              {pwdRequests.length === 0 ? (
                <p className="text-xs text-[#555] py-4 text-center">No pending password reset requests.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {pwdRequests.map((req) => (
                    <div key={req.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-sm font-bold"
                          style={{ background: req.user_type === 'vendor' ? 'rgba(201,168,76,0.15)' : 'rgba(99,102,241,0.15)', color: req.user_type === 'vendor' ? '#C9A84C' : '#818cf8' }}>
                          {req.user_type}
                        </span>
                        <span className="text-sm font-semibold text-[#F5F0E8]">{req.name}</span>
                      </div>
                      <div className="text-xs text-[#666] mb-3">{req.email} · {req.created_at}</div>
                      <div className="flex gap-2">
                        <input type="password" placeholder="Set temp password (min 6 chars)"
                          value={pwdTemp[req.id] || ''} onChange={(e) => setPwdTemp((p) => ({ ...p, [req.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg text-xs text-[#F5F0E8]"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }} />
                        <button onClick={() => handleSetTempPassword(req.id)} disabled={pwdBusy[req.id]}
                          className="px-4 py-2 rounded-lg text-xs font-bold tracking-wide disabled:opacity-50"
                          style={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>
                          {pwdBusy[req.id] ? '…' : 'Set'}
                        </button>
                      </div>
                      {pwdMsg[req.id] && (
                        <div className={`mt-2 text-xs ${pwdMsg[req.id].type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pwdMsg[req.id].text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'audit' && (
        <div>
          <p className="text-xs text-[#555] mb-6 tracking-wide">
            Complete record of all admin actions and system events on the platform.
          </p>
          <div className="flex flex-col gap-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: LOG_COLOR[log.category] || '#555' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                          style={{ background: `${LOG_COLOR[log.category] || '#555'}15`, color: LOG_COLOR[log.category] || '#555' }}>
                          {log.category}
                        </span>
                        <span className="text-sm font-semibold text-[#F5F0E8]">{log.action}</span>
                      </div>
                      <div className="text-xs text-[#666] mt-0.5">{log.actor} → {log.target}</div>
                      <div className="text-[11px] text-[#555] mt-1 leading-relaxed">{log.details}</div>
                    </div>
                    <div className="text-[10px] text-[#444] whitespace-nowrap font-mono">
                      {log.timestamp?.replace('T', ' ').slice(0, 16)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-[#333] font-mono">{log.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
