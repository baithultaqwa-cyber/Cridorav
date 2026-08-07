import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars -- motion.div / motion.button (member refs not counted by no-unused-vars)
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Shield, Clock, AlertTriangle, CreditCard, Lock, XCircle, Hourglass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE as API, USE_SIMULATED_PAYMENT } from '../config'
import SeoHead from '../components/SeoHead'
import { ORDER_FLOW_POLL_MS } from '../config/pollIntervals'

const TERMINAL = ['paid', 'held', 'confirmed', 'rejected', 'expired', 'payment_expired', 'cancelled']
const PAID_OK = ['paid', 'held', 'confirmed']
const STRIPE_SYNC_MS = 60_000
const STRIPE_VERIFY_INTERVAL_MS = 2_000

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-[var(--text-faint)] flex-shrink-0">{label}</span>
      <span className="text-xs text-[var(--text-soft)] text-right">{value ?? '—'}</span>
    </div>
  )
}

function FeeAccordion({ order, quote }) {
  const [open, setOpen] = useState(false)
  const lines = quote?.lines || order?.fees_breakdown?.lines || []
  const service = order?.platform_fee_aed ?? quote?.cridora_service_fee_aed
  return (
    <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(232,195,74,0.12)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-6 py-3 flex justify-between items-center text-left">
        <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)]">What&apos;s included in your total</span>
        <span className="text-[10px] text-[var(--gold)]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="px-6 pb-5 flex flex-col gap-2">
          {lines.length > 0 ? lines.map((l) => (
            <Row key={l.key || l.label} label={l.label} value={`AED ${Number(l.amount_aed ?? 0).toFixed(2)}`} />
          )) : (
            <>
              <Row label="Gold value" value={`AED ${(Number(order?.total_aed ?? 0) - Number(service ?? 0)).toFixed(2)}`} />
              <Row label="Cridora Assurance" value={`AED ${Number(service ?? 0).toFixed(2)}`} />
            </>
          )}
          {quote?.psp_fee_aed > 0 && (
            <Row label={quote.psp_fee_label || 'Secure Payment Handling (est.)'} value={`AED ${Number(quote.psp_fee_aed).toFixed(2)}`} />
          )}
          <p className="text-[10px] text-[var(--text-faint)] mt-2 leading-relaxed">
            {quote?.exclusions_note || "Delivery isn't included until you request it."}
          </p>
          <p className="text-[10px] text-amber-200/70 leading-relaxed">
            Cridora Assurance covers verification, secure handling, and your buy-back guarantee — it isn&apos;t refundable once your order is placed. Selling back uses a separate, clearly shown rate.
          </p>
        </div>
      )}
    </div>
  )
}

export default function Payment() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { authFetch } = useAuth()

  const { pathname } = useLocation()

  const [order, setOrder]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError]   = useState('')
  const [stripeSyncTimedOut, setStripeSyncTimedOut] = useState(false)
  const [stripeSyncKey, setStripeSyncKey] = useState(0)
  const [payCountdown, setPayCountdown] = useState(null)
  const [providers, setProviders] = useState([])
  const [providerKey, setProviderKey] = useState('manual_aani')
  const [feeQuote, setFeeQuote] = useState(null)
  const [aaniNote, setAaniNote] = useState('')
  const pollRef = useRef(null)
  const portfolioRedirectScheduled = useRef(false)
  const cancelled = searchParams.get('cancelled') === '1'
  const sessionBack = searchParams.get('session_id')

  const fetchOrder = useCallback(async (opts) => {
    // Skip background-tab polls (saves battery/requests), but never skip a caller-forced
    // fetch — otherwise a page that first mounts in a hidden/backgrounded tab (e.g. opened
    // via a background redirect) never fetches at all and is stuck on the spinner forever,
    // since no future visibilitychange event would fire until the tab is actually focused.
    const force = opts?.force
    if (!force && typeof document !== 'undefined' && document.hidden) return
    try {
      const r = await authFetch(`${API}/orders/${orderId}/`, { cache: 'no-store' })
      const d = await r.json()
      if (d.detail) { setError(d.detail); return }
      setOrder(d)
      if (TERMINAL.includes(d.status)) clearInterval(pollRef.current)
    } catch {
      setError("We couldn't load this order. It hasn't been affected — please refresh.")
    } finally {
      setLoading(false)
    }
  }, [orderId, authFetch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load + poll for order
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
  }, [orderId, fetchOrder])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync checkout countdown from GET /orders poll */
    const secondsRemaining = order?.checkout_seconds_remaining ?? order?.payment_seconds_remaining
    if (order?.status !== 'vendor_accepted' || secondsRemaining == null) {
      setPayCountdown(null)
      return
    }
    setPayCountdown(secondsRemaining)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [order?.status, order?.checkout_seconds_remaining, order?.payment_seconds_remaining])

  useEffect(() => {
    if (payCountdown == null || payCountdown <= 0) return
    const t = setInterval(() => {
      setPayCountdown((c) => (c != null && c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(t)
  }, [payCountdown])

  useEffect(() => {
    if (payCountdown == null || payCountdown > 0) return
    if (order?.status !== 'vendor_accepted') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-fetch to apply server-side checkout expiry
    void fetchOrder()
  }, [payCountdown, order?.status, fetchOrder])

  useEffect(() => {
    portfolioRedirectScheduled.current = false
  }, [orderId])

  useEffect(() => {
    let cancelledLocal = false
    ;(async () => {
      try {
        const r = await authFetch(`${API}/payments/providers/`)
        const d = await r.json().catch(() => ({}))
        if (cancelledLocal || !r.ok) return
        const list = Array.isArray(d.providers) ? d.providers : []
        setProviders(list)
        if (d.default) setProviderKey(d.default)
        else if (list[0]?.key) setProviderKey(list[0].key)
      } catch { /* ignore */ }
    })()
    return () => { cancelledLocal = true }
  }, [authFetch])

  useEffect(() => {
    if (!order || order.status !== 'vendor_accepted') return
    const metal = Number(order.total_aed) - Number(order.platform_fee_aed || 0)
    let cancelledLocal = false
    ;(async () => {
      try {
        const r = await authFetch(`${API}/payments/checkout-quote/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metal_subtotal_aed: metal, provider_key: providerKey }),
        })
        const d = await r.json().catch(() => ({}))
        if (!cancelledLocal && r.ok) setFeeQuote(d)
      } catch { /* ignore */ }
    })()
    return () => { cancelledLocal = true }
  }, [order?.id, order?.status, order?.total_aed, order?.platform_fee_aed, providerKey, authFetch])

  // After any path marks the order paid/held, show success then go to portfolio.
  useEffect(() => {
    if (!order || !PAID_OK.includes(order.status) || portfolioRedirectScheduled.current) return
    portfolioRedirectScheduled.current = true
    clearInterval(pollRef.current)
    const t = setTimeout(() => {
      navigate('/dashboard/customer?section=portfolio', { replace: true })
    }, 2000)
    return () => clearTimeout(t)
  }, [order?.status, orderId, navigate])

  // After Stripe redirect, confirm payment server-side (webhook can lag or fail; polling GET alone is not enough).
  useEffect(() => {
    if (!order || !sessionBack || order.status !== 'vendor_accepted' || !order.checkout_available) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear sync banner when order already paid
      if (order && PAID_OK.includes(order.status)) setStripeSyncTimedOut(false)
      return
    }
    setStripeSyncTimedOut(false)
    const started = Date.now()
    let intervalId = 0
    const verify = async () => {
      if (Date.now() - started > STRIPE_SYNC_MS) {
        clearInterval(intervalId)
        setStripeSyncTimedOut(true)
        return
      }
      try {
        const r = await authFetch(`${API}/orders/${orderId}/checkout/verify/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionBack }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.ok) {
          setOrder(d)
          setError('')
          clearInterval(intervalId)
          return
        }
        const msg = typeof d.detail === 'string' ? d.detail : ''
        if (r.status === 400 && /not complete yet/i.test(msg)) return
        if (msg) setError(msg)
      } catch {
        // Network blip; next tick or background poll may recover.
      }
    }
    void verify()
    intervalId = setInterval(verify, STRIPE_VERIFY_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [orderId, order?.status, order?.checkout_available, sessionBack, authFetch, stripeSyncKey])

  const startProviderPayment = async () => {
    setPaying(true)
    setError('')
    setAaniNote('')
    try {
      const r = await authFetch(`${API}/payments/orders/${orderId}/start/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_key: providerKey }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.detail || "We couldn't start your payment. Your order is safe — please try again.")
        return
      }
      if (d.checkout_url || d.url) {
        window.location.assign(d.checkout_url || d.url)
        return
      }
      if (d.instruction) setAaniNote(d.instruction)
      else setAaniNote('Payment initiated. Ops will confirm your Aani transfer; this page updates automatically once held.')
      void fetchOrder({ force: true })
    } catch {
      setError('Connection issue — your order is safe. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const startStripeCheckout = async () => {
    setProviderKey('stripe')
    setPaying(true)
    setError('')
    try {
      const r = await authFetch(`${API}/orders/${orderId}/checkout/`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.url) {
        window.location.assign(d.url)
        return
      }
      setError(d.detail || "Card payment didn't go through. No charge was made — try again, or contact us and we'll help.")
    } catch {
      setError('Connection issue — no charge was made. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const confirmPayment = async () => {
    setPaying(true)
    setError('')
    try {
      const r = await authFetch(`${API}/orders/${orderId}/`, { method: 'POST' })
      let d = {}
      try { d = await r.json() } catch { d = {} }
      if (r.ok) {
        clearInterval(pollRef.current)
        setOrder(d)
      } else {
        setError(d.detail || "We're double-checking your payment. If you were charged, your order will confirm automatically — no action needed.")
      }
    } catch {
      setError('Connection issue — your payment status is unaffected. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <>
        <SeoHead
          noindex
          title="Payment"
          description="Authenticated Cridora order checkout screen; blocked from indexing."
          path={pathname || '/payment'}
        />
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: 'transparent' }}>
        <div className="w-8 h-8 border-2 border-[var(--gold)]/20 border-t-[var(--gold)] rounded-full animate-spin" />
      </div>
      </>
    )
  }

  if (error && !order) {
    return (
      <>
        <SeoHead
          noindex
          title="Payment"
          description="Authenticated Cridora order checkout screen; blocked from indexing."
          path={pathname || '/payment'}
        />
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ background: 'transparent' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <p className="text-[var(--text-primary)] font-semibold mb-2">We couldn&apos;t load this order</p>
          <p className="text-[var(--text-dim)] text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/marketplace')}
            className="px-6 py-2.5 rounded-lg text-xs tracking-widest uppercase font-semibold text-[var(--gold)]"
            style={{ background: 'rgba(232,195,74,0.1)', border: '1px solid rgba(232,195,74,0.2)' }}>
            Back to Marketplace
          </button>
        </div>
      </div>
      </>
    )
  }

  if (order?.status === 'payment_expired') {
    const pid = Number(order?.product_id)
    const buyAgain = !Number.isNaN(pid) && pid > 0
      ? `/marketplace?openBuy=${pid}`
      : '/marketplace'
    return (
      <>
        <SeoHead
          noindex
          title="Payment"
          description="Authenticated Cridora order checkout screen; blocked from indexing."
          path={pathname || '/payment'}
        />
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ background: 'transparent' }}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-sm w-full rounded-2xl p-10"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,166,35,0.25)' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'rgba(245,166,35,0.1)', border: '2px solid rgba(245,166,35,0.35)' }}>
            <Clock size={28} className="text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Your Price Window Has Closed</h2>
          <p className="text-sm text-[var(--text-dim)] mb-1">{order?.order_ref}</p>
          <p className="text-xs text-[var(--text-faint)] mb-6 leading-relaxed">
            No charge was made. Gold prices move with the market — here&apos;s today&apos;s live rate to buy again.
          </p>
          <button
            type="button"
            onClick={() => navigate(buyAgain, { replace: true })}
            className="w-full py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold"
            style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#080808' }}>
            Buy again — live price
          </button>
        </motion.div>
      </div>
      </>
    )
  }

  if (order && PAID_OK.includes(order.status)) {
    return (
      <>
        <SeoHead
          noindex
          title="Payment"
          description="Authenticated Cridora order checkout screen; blocked from indexing."
          path={pathname || '/payment'}
        />
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ background: 'transparent' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-center max-w-sm w-full rounded-2xl p-10"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)' }}>
            <Check size={28} className="text-emerald-400" />
          </motion.div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Congratulations!</h2>
          <p className="text-sm text-[var(--text-dim)] mb-1">{order?.order_ref}</p>
          <p className="text-xs text-[var(--text-faint)] mb-6 leading-relaxed">
            Your gold purchase has been successfully secured{order?.vendor_name ? ` at ${order.vendor_name}` : ''}.
            You can monitor its value, request delivery, or manage your holdings anytime from your dashboard.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/customer?section=portfolio', { replace: true })}
            className="w-full py-3 rounded-xl text-xs tracking-widest uppercase font-bold mb-4"
            style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#080808' }}>
            View My Portfolio
          </button>
          <div className="w-6 h-6 border-2 border-emerald-400/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
        </motion.div>
      </div>
      </>
    )
  }

  const isRejected = order?.status === 'rejected'
  const isExpired  = order?.status === 'expired'
  const isWaiting  = order?.status === 'pending_vendor'
  const canPay     = order?.status === 'vendor_accepted'
  const useStripe  = Boolean(order?.checkout_available)

  return (
    <>
      <SeoHead
        noindex
        title="Payment"
        description="Authenticated Cridora order checkout screen; blocked from indexing."
        path={pathname || '/payment'}
      />
      <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 min-w-0 overflow-x-hidden" style={{ background: 'transparent' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--gold) 0%, transparent 70%)' }} />
      </div>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[10px] tracking-widest uppercase font-semibold"
            style={{ background: 'rgba(232,195,74,0.08)', border: '1px solid rgba(232,195,74,0.2)', color: 'var(--gold)' }}>
            <Lock size={10} /> Secure Payment Gateway
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)]">You&apos;re One Step Away from Gold Ownership</h1>
          <p className="text-xs text-[var(--text-faint)] mt-1">{order?.order_ref}</p>
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
                <p className="text-xs font-semibold text-[#F5A623]">Your Order Is With the Dealer</p>
                <p className="text-[10px] text-[#F5A623]/60 mt-0.5">
                  They&apos;re reviewing your order now. We&apos;ll unlock payment the moment they confirm.
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
                <p className="text-xs font-semibold text-emerald-400">Great News — Your Dealer Confirmed!</p>
                <p className="text-[10px] text-emerald-400/60 mt-0.5">
                  Confirm payment below and this gold is yours.
                </p>
                {useStripe && payCountdown != null && payCountdown > 0 && (
                  <p className="text-[10px] text-amber-200/80 mt-2 font-mono">
                    Pay within{' '}
                    {String(Math.floor(payCountdown / 60)).padStart(2, '0')}
                    :{String(payCountdown % 60).padStart(2, '0')}{' '}
                    or this checkout will time out and you will need a new order at the live price.
                  </p>
                )}
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
                <p className="text-xs font-semibold text-red-400">This Dealer Couldn&apos;t Fulfil Your Order</p>
                <p className="text-[10px] text-red-400/60 mt-0.5">No charge was made. Try other verified dealers on the marketplace.</p>
              </div>
            </motion.div>
          )}

          {isExpired && (
            <motion.div key="expired"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-4 mb-5 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Hourglass size={16} className="text-[var(--text-dim)] flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">This Order Has Expired</p>
                <p className="text-[10px] text-[var(--text-faint)] mt-0.5">No charge was made. The dealer didn&apos;t respond in time — get today&apos;s live rate and try again.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order summary */}
        <div className="rounded-2xl p-6 mb-5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(232,195,74,0.12)' }}>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-faint)] mb-4">Your Order</div>
          <div className="flex flex-col gap-2.5">
            <Row label="Product"      value={order?.product_name} />
            <Row label="Dealer"       value={order?.vendor_name} />
            <Row label="Quantity"     value={`${order?.qty_units} unit${order?.qty_units !== 1 ? 's' : ''} (${Number(order?.qty_grams ?? 0).toFixed(2)}g)`} />
            <Row label="Rate / gram"  value={`AED ${Number(order?.rate_per_gram ?? 0).toFixed(2)}`} />
            <Row label="Cridora Assurance" value={`AED ${Number(order?.platform_fee_aed ?? 0).toFixed(2)}`} />
            <div className="h-px bg-[#1A1A1A] my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-[var(--text-primary)]">Total</span>
              <span className="text-lg font-black gradient-gold-text">
                AED {Number(order?.total_aed ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <FeeAccordion order={order} quote={feeQuote} />

        {canPay && providers.length > 0 && (
          <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(232,195,74,0.1)' }}>
            <div className="text-[10px] tracking-widest uppercase text-[var(--text-faint)] mb-2">Payment method</div>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setProviderKey(p.key)}
                  className="px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                  style={providerKey === p.key
                    ? { background: 'rgba(232,195,74,0.2)', border: '1px solid rgba(232,195,74,0.45)', color: 'var(--gold)' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
                >
                  {p.label || p.key}
                </button>
              ))}
            </div>
          </div>
        )}

        {aaniNote && (
          <div className="rounded-xl px-4 py-3 mb-5 text-[11px] text-amber-100/90"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
            {aaniNote}
          </div>
        )}

        {/* Buyback guarantee */}
        {Number(order?.buyback_per_gram) > 0 && (
          <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <Shield size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-[11px] text-emerald-400/80 leading-relaxed">
              You can sell this back to {order?.vendor_name} anytime at{' '}
              <span className="font-bold text-emerald-400">
                AED {Number(order?.buyback_per_gram ?? 0).toFixed(2)}/g
              </span>{' '}
              — guaranteed.
            </p>
          </div>
        )}

        {sessionBack && canPay && !stripeSyncTimedOut && (
          <div className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-[11px] text-blue-300/90">
              Confirming your payment securely (up to 60 seconds) — no action needed. This page will update the moment it&apos;s done.
            </p>
          </div>
        )}

        {sessionBack && canPay && stripeSyncTimedOut && (
          <div className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)' }}>
            <p className="text-[11px] text-amber-200/90 mb-3">
              We&apos;re still confirming your payment — this can take a little longer at busy times. If your bank shows a successful charge, use "Try confirm again" or refresh this page in a moment.
            </p>
            <button
              type="button"
              onClick={() => { setError(''); setStripeSyncKey((k) => k + 1) }}
              className="w-full py-2.5 rounded-lg text-xs font-semibold tracking-wide"
              style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', color: '#F5A623' }}>
              Try confirm again
            </button>
          </div>
        )}

        {cancelled && canPay && (
          <div className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[11px] text-[var(--text-muted)]">Checkout was cancelled. You can try again when ready.</p>
          </div>
        )}

        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <CreditCard size={12} className="text-[var(--text-dim)] flex-shrink-0" />
          <p className="text-[11px] text-[var(--text-faint)]">
            {providerKey === 'stripe' || (useStripe && providerKey !== 'manual_aani' && providerKey !== 'telr')
              ? 'Card checkout via Stripe. You will return here while we confirm.'
              : providerKey === 'telr'
                ? 'Telr hosted checkout (when configured).'
                : providerKey === 'manual_aani'
                  ? 'Aani transfer: we initiate; ops confirms after you pay (maker-checker).'
                  : USE_SIMULATED_PAYMENT
                    ? 'Simulated payment available for development.'
                    : 'Choose a payment method above, then confirm.'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-[12px] text-red-400"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {canPay && (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (providerKey === 'stripe' || (useStripe && !providers.length && providerKey !== 'manual_aani')) {
                return startStripeCheckout()
              }
              if (USE_SIMULATED_PAYMENT && providerKey === 'manual_aani' && !providers.length) {
                return confirmPayment()
              }
              return startProviderPayment()
            }}
            disabled={paying}
            className="w-full py-4 rounded-xl text-sm tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#080808' }}>
            {paying
              ? <div className="w-5 h-5 border-2 border-[#08080830] border-t-[#080808] rounded-full animate-spin" />
              : <><CreditCard size={16} /> Pay AED {Number(order?.total_aed ?? 0).toFixed(2)} — Securely</>}
          </motion.button>
        )}

        {canPay && USE_SIMULATED_PAYMENT && (
          <button
            type="button"
            onClick={confirmPayment}
            disabled={paying}
            className="w-full mt-2 py-2 text-[10px] tracking-widest uppercase text-[var(--text-faint)] hover:text-[var(--text-dim)]"
          >
            Dev: simulate mark paid
          </button>
        )}

        {isWaiting && (
          <div className="w-full py-4 rounded-xl text-sm text-center text-[var(--text-faint)] font-semibold tracking-wide"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Clock size={14} className="inline mr-2 text-[var(--text-faint)]" />
            Waiting for vendor…
          </div>
        )}

        {(isRejected || isExpired) && (
          <button onClick={() => navigate('/marketplace')}
            className="w-full py-4 rounded-xl text-sm tracking-widest uppercase font-semibold text-[var(--gold)]"
            style={{ background: 'rgba(232,195,74,0.08)', border: '1px solid rgba(232,195,74,0.2)' }}>
            Back to Marketplace
          </button>
        )}

        {!isRejected && !isExpired && (
          <button onClick={() => navigate('/marketplace')}
            className="w-full mt-3 py-3 text-xs tracking-widest uppercase text-[var(--text-caption)] hover:text-[var(--text-dim)] transition-colors">
            Cancel
          </button>
        )}
      </motion.div>
    </div>
    </>
  )
}
