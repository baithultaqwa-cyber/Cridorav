import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, AlertTriangle, XCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

import { API_AUTH_BASE as API } from '../config'
import { ORDER_FLOW_POLL_MS } from '../config/pollIntervals'
import SeoHead from '../components/SeoHead'
import OrderTimer from '../components/OrderTimer'

const TERMINAL_STATUSES = ['completed', 'rejected', 'cancelled']

function Row({ label, value, valueStyle }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-xs text-[var(--text-dim)]">{label}</span>
      <span className="text-xs font-semibold" style={valueStyle || { color: '#888' }}>{value ?? '—'}</span>
    </div>
  )
}

const STATUS_CONFIG = {
  pending_vendor:  { label: 'Awaiting Vendor',    color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',    border: 'rgba(245,158,11,0.2)',    spinning: true  },
  vendor_accepted: { label: 'Awaiting Cridora — confirm funds from vendor',  color: '#3b82f6', bg: 'rgba(59,130,246,0.07)',   border: 'rgba(59,130,246,0.2)',   spinning: false },
  admin_approved:  { label: 'Funds confirmed — payout to your account pending',     color: '#10b981', bg: 'rgba(16,185,129,0.07)',   border: 'rgba(16,185,129,0.2)',   spinning: false },
  completed:       { label: 'Payout Complete',    color: '#10b981', bg: 'rgba(16,185,129,0.07)',   border: 'rgba(16,185,129,0.2)',   spinning: false },
  rejected:        { label: 'Rejected',           color: '#ef4444', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.2)',    spinning: false },
  cancelled:       { label: 'Cancelled',         color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',   border: 'rgba(148,163,184,0.22)', spinning: false },
}

const STATUS_DESC = {
  pending_vendor:  'Your sell request has been sent to the vendor. Waiting for their acceptance.',
  vendor_accepted: 'Payment initiated. Your payout will be credited to your account within 24 hours.',
  admin_approved:  'Payout verified. Funds will be credited to your account shortly.',
  completed:       'Sell completed. Payout has been processed successfully.',
  rejected:        'This sell request was rejected. Your holding remains unchanged.',
  cancelled:       'You cancelled this request after the vendor did not respond in time. Your holding remains unchanged.',
}

export default function SellStatus() {
  const { sellOrderId } = useParams()
  const navigate = useNavigate()
  const { authFetch } = useAuth()

  const { pathname } = useLocation()

  const [order, setOrder]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelErr, setCancelErr] = useState(null)
  const pollRef = useRef(null)

  const fetchOrder = useCallback(async (opts) => {
    // force: true bypasses the hidden-tab skip — used for the initial mount fetch so a
    // page that first loads in a backgrounded tab doesn't get stuck on the spinner forever.
    const force = opts?.force
    if (!force && typeof document !== 'undefined' && document.hidden) return
    try {
      const r = await authFetch(`${API}/sell-orders/${sellOrderId}/`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) { setFetchError(d.detail || 'Order not found.'); return }
      setOrder(d)
      if (TERMINAL_STATUSES.includes(d.status)) clearInterval(pollRef.current)
    } catch {
      setFetchError('Network error.')
    } finally {
      setLoading(false)
    }
  }, [sellOrderId, authFetch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load + poll for sell order
    void fetchOrder({ force: true })
    pollRef.current = setInterval(fetchOrder, ORDER_FLOW_POLL_MS)
    const onVis = () => {
      if (!document.hidden) fetchOrder()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [sellOrderId, fetchOrder])

  if (loading) {
    return (
      <>
        <SeoHead
          noindex
          title="Sell status"
          description="Authenticated Cridora sell-back status view; blocked from indexing."
          path={pathname || '/sell-status'}
        />
      <div className="min-h-screen flex items-center justify-center min-w-0 overflow-x-hidden" style={{ background: 'transparent' }}>
        <div className="w-8 h-8 border-2 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
      </>
    )
  }

  if (fetchError && !order) {
    return (
      <>
        <SeoHead
          noindex
          title="Sell status"
          description="Authenticated Cridora sell-back status view; blocked from indexing."
          path={pathname || '/sell-status'}
        />
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 min-w-0 overflow-x-hidden" style={{ background: 'transparent' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-[var(--text-primary)] font-semibold mb-2">Unable to load sell order</p>
          <p className="text-[var(--text-dim)] text-sm mb-6">{fetchError}</p>
          <button onClick={() => navigate('/dashboard/customer?section=portfolio')}
            className="px-6 py-2.5 rounded-lg text-xs tracking-widest uppercase font-semibold text-[var(--gold)]"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            Back to Portfolio
          </button>
        </div>
      </div>
      </>
    )
  }

  const cfg      = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_vendor
  const profit   = Number(order.profit_aed)
  const profitPos = profit >= 0
  const isRejected = order.status === 'rejected'
  const isCancelled = order.status === 'cancelled'
  const isDone     = order.status === 'completed'
  const pendingVendor = order.status === 'pending_vendor'
  const ttlMax = Number(order.vendor_accept_ttl_seconds) || 60
  const expIn = Number(order.expires_in ?? 0)
  const canCancel = pendingVendor && expIn <= 0

  const cancelOrder = async () => {
    setCancelErr(null)
    setCancelBusy(true)
    try {
      const r = await authFetch(`${API}/sell-orders/${sellOrderId}/cancel/`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setCancelErr(d.detail || 'Could not cancel.')
        return
      }
      setOrder(d)
    } catch {
      setCancelErr('Network error.')
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <>
      <SeoHead
        noindex
        title="Sell status"
        description="Authenticated Cridora sell-back status view; blocked from indexing."
        path={pathname || '/sell-status'}
      />
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 min-w-0 overflow-x-hidden" style={{ background: 'transparent' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
      </div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md relative z-10">

        {/* Back */}
        <button onClick={() => navigate('/dashboard/customer?section=portfolio')}
          className="flex items-center gap-1.5 text-[var(--text-faint)] hover:text-[var(--text-soft)] text-xs mb-6 transition-colors">
          <ArrowLeft size={12} /> Portfolio
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="text-[10px] tracking-[0.2em] uppercase mb-3 font-semibold" style={{ color: 'var(--gold)' }}>
            Sell Request
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">{order.order_ref}</h1>
          <p className="text-xs text-[var(--text-faint)] mt-1">{order.product_name} · {order.purity} · {order.metal}</p>
        </div>

        {/* Status banner */}
        <AnimatePresence mode="wait">
          <motion.div key={order.status}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.spinning
              ? <div className="w-5 h-5 rounded-full border-2 border-current/30 border-t-current animate-spin flex-shrink-0" style={{ color: cfg.color }} />
              : isDone
                ? <Check size={16} style={{ color: cfg.color }} className="flex-shrink-0" />
                : isRejected || isCancelled
                  ? <XCircle size={16} style={{ color: cfg.color }} className="flex-shrink-0" />
                  : <Clock size={16} style={{ color: cfg.color }} className="flex-shrink-0" />}
            <div>
              <p className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70" style={{ color: cfg.color }}>
                {STATUS_DESC[order.status]}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {pendingVendor && (
          <div className="rounded-xl px-4 py-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-2">Vendor response timer</div>
              {expIn > 0 ? (
                <OrderTimer seconds={expIn} max={ttlMax} />
              ) : (
                <p className="text-xs text-amber-400/90 font-semibold">Time expired — you can cancel this sell request.</p>
              )}
            </div>
            {canCancel && (
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                {cancelErr && <p className="text-[11px] text-red-400 text-right">{cancelErr}</p>}
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => void cancelOrder()}
                  className="px-4 py-2.5 rounded-xl text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca' }}>
                  {cancelBusy ? 'Cancelling…' : 'Cancel sell request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Payout breakdown */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(201,168,76,0.12)' }}>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-4">Payout Breakdown</div>
          <Row label="Product"              value={order.product_name} />
          <Row label="Vendor"               value={order.vendor_name ? order.vendor_name : '—'} />
          <Row label="Qty sold"             value={`${Number(order.qty_grams).toFixed(4)} g`} />
          <Row label="Purchase rate"        value={`AED ${Number(order.purchase_rate_per_gram).toFixed(4)}/g`} />
          <Row label="Buyback rate"         value={`AED ${Number(order.buyback_rate_per_gram).toFixed(4)}/g`} valueStyle={{ color: 'var(--gold)' }} />
          <Row label="Purchase cost"        value={`AED ${Number(order.purchase_cost_aed).toFixed(2)}`} />
          <Row label="Gross buyback payout" value={`AED ${Number(order.gross_aed).toFixed(2)}`} valueStyle={{ color: 'var(--text-primary)' }} />
          <Row label={profitPos ? 'Profit' : 'Loss'}
               value={`${profitPos ? '+' : ''}AED ${Number(order.profit_aed).toFixed(2)}`}
               valueStyle={{ color: profitPos ? '#10b981' : '#ef4444' }} />
          <Row label={`Cridora share (${Number(order.cridora_share_pct).toFixed(2)}% of profit)`}
               value={`- AED ${Number(order.cridora_share_aed).toFixed(2)}`}
               valueStyle={{ color: '#f59e0b' }} />
          {/* Net payout */}
          <div className="flex items-center justify-between pt-4 mt-1">
            <span className="text-sm font-bold text-[var(--text-primary)]">Net Payout</span>
            <span className="text-lg font-black" style={{ color: 'var(--gold)' }}>
              AED {Number(order.net_payout_aed).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Progress tracker */}
        {!isRejected && !isCancelled && (
          <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-4">Progress</div>
            {[
              { key: 'pending_vendor',  label: 'Sell request sent' },
              { key: 'vendor_accepted', label: 'Vendor accepted' },
              { key: 'admin_approved',  label: 'Admin approved' },
              { key: 'completed',       label: 'Payout complete' },
            ].map((step, idx, arr) => {
              const stepOrder  = arr.findIndex(s => s.key === order.status)
              const thisOrder  = idx
              const done       = thisOrder <= stepOrder
              const active     = thisOrder === stepOrder
              return (
                <div key={step.key} className="flex items-start gap-3 mb-3 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {done && <Check size={10} className="text-emerald-400" />}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="w-px h-5 mt-1" style={{ background: done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)' }} />
                    )}
                  </div>
                  <span className={`text-xs mt-0.5 ${active ? 'text-[var(--text-primary)] font-semibold' : done ? 'text-[var(--text-soft)]' : 'text-[var(--text-caption)]'}`}>
                    {step.label}
                    {active && cfg.spinning && (
                      <span className="ml-2 inline-block w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin align-middle" />
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button onClick={() => navigate('/dashboard/customer?section=portfolio')}
          className="w-full py-3 rounded-xl text-xs tracking-widest uppercase font-semibold text-[var(--gold)] transition-all hover:bg-[rgba(201,168,76,0.05)]"
          style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {isDone || isRejected ? 'Back to Portfolio' : 'View Portfolio'}
        </button>
      </motion.div>
    </div>
    </>
  )
}
