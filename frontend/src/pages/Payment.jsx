import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Shield, Clock, AlertTriangle, CreditCard, Lock, XCircle, Hourglass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE as API } from '../config'
const POLL_MS = 3000

const TERMINAL = ['paid', 'rejected', 'expired']

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-[#444] flex-shrink-0">{label}</span>
      <span className="text-xs text-[#888] text-right">{value ?? '—'}</span>
    </div>
  )
}

export default function Payment() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { authFetch } = useAuth()

  const [order, setOrder]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')
  const pollRef = useRef(null)

  const fetchOrder = async () => {
    try {
      const r = await authFetch(`${API}/orders/${orderId}/`)
      const d = await r.json()
      if (d.detail) { setError(d.detail); return }
      setOrder(d)
      if (TERMINAL.includes(d.status)) clearInterval(pollRef.current)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    pollRef.current = setInterval(fetchOrder, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [orderId])

  const confirmPayment = async () => {
    setPaying(true)
    setError('')
    try {
      const r = await authFetch(`${API}/orders/${orderId}/`, { method: 'POST' })
      let d = {}
      try { d = await r.json() } catch {}
      if (r.ok) {
        clearInterval(pollRef.current)
        setOrder(d)
        setDone(true)
        setTimeout(() => navigate('/dashboard/customer?section=orders'), 2500)
      } else {
        setError(d.detail || 'Payment confirmation failed.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080808' }}>
        <div className="w-8 h-8 border-2 border-[#C9A84C]/20 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#080808' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-[#F5F0E8] font-semibold mb-2">Unable to load order</p>
          <p className="text-[#555] text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/marketplace')}
            className="px-6 py-2.5 rounded-lg text-xs tracking-widest uppercase font-semibold text-[#C9A84C]"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}>
            Back to Marketplace
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#080808' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center max-w-sm w-full rounded-2xl p-10"
          style={{ background: '#111', border: '1px solid rgba(16,185,129,0.2)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)' }}>
            <Check size={28} className="text-emerald-400" />
          </motion.div>
          <h2 className="text-xl font-bold text-[#F5F0E8] mb-2">Payment Confirmed</h2>
          <p className="text-sm text-[#555] mb-1">{order?.order_ref}</p>
          <p className="text-xs text-[#444] mb-6">
            Order completed. Stock updated. Redirecting to your portfolio…
          </p>
          <div className="w-6 h-6 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
        </motion.div>
      </div>
    )
  }

  const isRejected = order?.status === 'rejected'
  const isExpired  = order?.status === 'expired'
  const isWaiting  = order?.status === 'pending_vendor'
  const canPay     = order?.status === 'vendor_accepted'

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#080808' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
      </div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[10px] tracking-widest uppercase font-semibold"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C' }}>
            <Lock size={10} /> Secure Payment Gateway
          </div>
          <h1 className="text-2xl font-black text-[#F5F0E8]">Complete Your Order</h1>
          <p className="text-xs text-[#444] mt-1">{order?.order_ref}</p>
        </div>

        {/* Vendor status banner */}
        <AnimatePresence mode="wait">
          {isWaiting && (
            <motion.div key="waiting"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
              style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)' }}>
              <div className="w-5 h-5 border-2 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#F5A623]">Awaiting vendor approval</p>
                <p className="text-[10px] text-[#F5A623]/60 mt-0.5">
                  The vendor is reviewing your order. Payment will unlock once accepted.
                </p>
              </div>
            </motion.div>
          )}

          {canPay && (
            <motion.div key="canpay"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Check size={16} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Vendor accepted your order!</p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">
                  Confirm payment below to complete your purchase.
                </p>
              </div>
            </motion.div>
          )}

          {isRejected && (
            <motion.div key="rejected"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <XCircle size={16} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-400">Order rejected by vendor</p>
                <p className="text-[10px] text-red-400/60 mt-0.5">The vendor declined this order.</p>
              </div>
            </motion.div>
          )}

          {isExpired && (
            <motion.div key="expired"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Hourglass size={16} className="text-[#555] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#666]">Order expired</p>
                <p className="text-[10px] text-[#444] mt-0.5">The vendor did not respond in time.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order summary */}
        <div className="rounded-2xl p-6 mb-5"
          style={{ background: '#0F0F0F', border: '1px solid rgba(201,168,76,0.12)' }}>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[#444] mb-4">Order Summary</div>
          <div className="flex flex-col gap-2.5">
            <Row label="Product"      value={order?.product_name} />
            <Row label="Vendor"       value={order?.vendor_name} />
            <Row label="Quantity"     value={`${order?.qty_units} unit${order?.qty_units !== 1 ? 's' : ''} (${Number(order?.qty_grams ?? 0).toFixed(2)}g)`} />
            <Row label="Rate / gram"  value={`AED ${Number(order?.rate_per_gram ?? 0).toFixed(2)}`} />
            <Row label="Platform fee" value={`AED ${Number(order?.platform_fee_aed ?? 0).toFixed(2)}`} />
            <div className="h-px bg-[#1A1A1A] my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-[#F5F0E8]">Total</span>
              <span className="text-lg font-black gradient-gold-text">
                AED {Number(order?.total_aed ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Buyback guarantee */}
        {Number(order?.buyback_per_gram) > 0 && (
          <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <Shield size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-[11px] text-emerald-400/80 leading-relaxed">
              Sell-back guaranteed at{' '}
              <span className="font-bold text-emerald-400">
                AED {Number(order?.buyback_per_gram ?? 0).toFixed(2)}/g
              </span>{' '}
              by {order?.vendor_name}.
            </p>
          </div>
        )}

        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <CreditCard size={12} className="text-[#555] flex-shrink-0" />
          <p className="text-[11px] text-[#444]">
            Confirm payment here once the vendor has approved your order.
          </p>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-[12px] text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        {canPay && (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={confirmPayment}
            disabled={paying}
            className="w-full py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 100%)', color: '#080808' }}>
            {paying
              ? <div className="w-5 h-5 border-2 border-[#08080830] border-t-[#080808] rounded-full animate-spin" />
              : <><Check size={16} /> Confirm Payment — AED {Number(order?.total_aed ?? 0).toFixed(2)}</>}
          </motion.button>
        )}

        {isWaiting && (
          <div className="w-full py-4 rounded-xl text-sm text-center text-[#444] font-semibold tracking-wide"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Clock size={14} className="inline mr-2 text-[#444]" />
            Waiting for vendor…
          </div>
        )}

        {(isRejected || isExpired) && (
          <button onClick={() => navigate('/marketplace')}
            className="w-full py-4 rounded-xl text-sm tracking-widest uppercase font-semibold text-[#C9A84C]"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
            Back to Marketplace
          </button>
        )}

        {!isRejected && !isExpired && (
          <button onClick={() => navigate('/marketplace')}
            className="w-full mt-3 py-3 text-xs tracking-widest uppercase text-[#333] hover:text-[#555] transition-colors">
            Cancel
          </button>
        )}
      </motion.div>
    </div>
  )
}
