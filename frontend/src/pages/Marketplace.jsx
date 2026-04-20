import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Heart, ShoppingCart, Search, SlidersHorizontal, ChevronDown,
  Star, Shield, TrendingUp, TrendingDown, Info, X, Check,
  ArrowUpRight, Zap, Package, BarChart2, Clock, AlertTriangle, Sparkles
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE } from '../config'

/* ─── Metal theme map ────────────────────────────────────────── */
const metalTheme = {
  gold: {
    gradient: 'linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(232,201,106,0.04) 100%)',
    border: 'rgba(201,168,76,0.2)',
    hoverBorder: 'rgba(201,168,76,0.5)',
    icon: '#C9A84C',
    textClass: 'gradient-gold-text',
    badgeBg: 'rgba(201,168,76,0.15)',
    badgeText: '#C9A84C',
    btnBg: 'linear-gradient(135deg, #C9A84C 0%, #E8C96A 100%)',
  },
  silver: {
    gradient: 'linear-gradient(135deg, rgba(168,169,173,0.1) 0%, rgba(212,213,217,0.04) 100%)',
    border: 'rgba(168,169,173,0.2)',
    hoverBorder: 'rgba(168,169,173,0.5)',
    icon: '#A8A9AD',
    textClass: 'gradient-silver-text',
    badgeBg: 'rgba(168,169,173,0.15)',
    badgeText: '#D4D5D9',
    btnBg: 'linear-gradient(135deg, #A8A9AD 0%, #D4D5D9 100%)',
  },
  platinum: {
    gradient: 'linear-gradient(135deg, rgba(184,115,51,0.1) 0%, rgba(218,138,103,0.04) 100%)',
    border: 'rgba(184,115,51,0.2)',
    hoverBorder: 'rgba(184,115,51,0.5)',
    icon: '#B87333',
    textClass: 'gradient-copper-text',
    badgeBg: 'rgba(184,115,51,0.15)',
    badgeText: '#DA8A67',
    btnBg: 'linear-gradient(135deg, #B87333 0%, #DA8A67 100%)',
  },
  palladium: {
    gradient: 'linear-gradient(135deg, rgba(181,166,160,0.1) 0%, rgba(200,185,178,0.04) 100%)',
    border: 'rgba(181,166,160,0.2)',
    hoverBorder: 'rgba(181,166,160,0.5)',
    icon: '#B5A6A0',
    textClass: 'gradient-silver-text',
    badgeBg: 'rgba(181,166,160,0.15)',
    badgeText: '#D0C4BF',
    btnBg: 'linear-gradient(135deg, #B5A6A0 0%, #D0C4BF 100%)',
  },
}

const badgeColors = {
  gold: { bg: 'rgba(201,168,76,0.15)', text: '#C9A84C' },
  silver: { bg: 'rgba(168,169,173,0.15)', text: '#D4D5D9' },
  copper: { bg: 'rgba(184,115,51,0.15)', text: '#DA8A67' },
}

/* ─── Metal Card ─────────────────────────────────────────────── */
function PriceRow({ label, value, valueClass = 'text-[#888]', labelClass = 'text-[#444]', bold = false }) {
  return (
    <>
      <span className={`text-[9px] tracking-[0.12em] uppercase self-center ${labelClass}`}>{label}</span>
      <span className={`text-xs text-right tabular-nums ${bold ? 'font-black text-sm' : 'font-semibold'} ${valueClass}`}>{value}</span>
    </>
  )
}

function MetalCard({ item, wishlist, onWishlist, onBuy }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const theme = metalTheme[item.metal]
  const metalTotal = (item.ratePerGram * item.totalGrams).toFixed(2)
  const wished = wishlist.includes(item.id)
  const hasMetalRate = item.metalRatePerGram != null && Number(item.metalRatePerGram) > 0
  const hasPacking = Number(item.packagingFee) > 0
  const hasInsurance = Number(item.insuranceFee) > 0
  const hasStorage = Number(item.storageFee) > 0
  const vendorClosed = item.source === 'live' && item.isOpen === false
  const canBuy = item.inStock && !vendorClosed

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -6 }}
      className="relative rounded-2xl overflow-hidden flex flex-col group"
      style={{
        background: theme.gradient,
        border: `1px solid ${theme.border}`,
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.hoverBorder
        e.currentTarget.style.boxShadow = `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px ${theme.hoverBorder}`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.border
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Badges */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
        {item.badge && (
          <div
            className="px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase"
            style={{ background: badgeColors[item.badgeColor].bg, color: badgeColors[item.badgeColor].text }}
          >
            {item.badge}
          </div>
        )}
        {vendorClosed && (
          <div className="px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase"
            style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}>
            Closed
          </div>
        )}
      </div>

      {/* Wishlist */}
      <button
        onClick={() => onWishlist(item.id)}
        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: wished ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.5)',
          border: `1px solid ${wished ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        <Heart
          size={14}
          className="transition-all duration-200"
          style={{ color: wished ? '#EF4444' : '#888', fill: wished ? '#EF4444' : 'none' }}
        />
      </button>

      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-[#0A0A0A]">
        {item.image ? (
          <div className="w-full h-full transition-opacity duration-300 opacity-75 group-hover:opacity-90">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover transform-gpu transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: `${theme.icon}08` }}>
            <Package size={32} style={{ color: `${theme.icon}40` }} />
            <span className="text-[10px] tracking-widest uppercase" style={{ color: `${theme.icon}40` }}>{item.metal}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent pointer-events-none" />

        {/* Closed / out-of-stock overlay */}
        {(vendorClosed || !item.inStock) && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: vendorClosed ? 'rgba(8,8,8,0.72)' : 'rgba(8,8,8,0.80)' }}>
            <span className="text-[11px] tracking-[0.2em] uppercase border px-3 py-1.5"
              style={{
                color: vendorClosed ? '#ef4444' : '#666',
                borderColor: vendorClosed ? 'rgba(239,68,68,0.35)' : '#333',
              }}>
              {vendorClosed ? 'Vendor Closed' : 'Out of Stock'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-bold text-[#F5F0E8] leading-snug">{item.name}</h3>
          </div>
          <p className="text-[12px] text-[#555] leading-relaxed">{item.shortDesc}</p>
        </div>

        {/* Vendor */}
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `${theme.icon}20` }}
          >
            <Shield size={10} style={{ color: theme.icon }} />
          </div>
          <span className="text-[11px] text-[#666]">{item.vendorName}</span>
          {item.vendorVerified && (
            <span
              className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
              style={{ background: `${theme.icon}15`, color: theme.icon }}
            >
              Verified
            </span>
          )}
        </div>

        {/* Pricing breakdown — 2-col grid keeps values in a single right-aligned column */}
        <div className="p-3 rounded-xl"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="grid gap-y-1.5" style={{ gridTemplateColumns: '1fr auto' }}>

            {hasMetalRate && (
              <PriceRow
                label="Metal rate / g"
                value={`AED ${Number(item.metalRatePerGram).toFixed(2)}`}
                valueClass={theme.textClass}
              />
            )}

            <PriceRow
              label={`Total${hasMetalRate ? ' incl. fees' : ''} · ${item.totalGrams}g`}
              value={`AED ${metalTotal}`}
              valueClass={theme.textClass}
              bold
            />

            {hasPacking && (
              <PriceRow label="Packaging" value={`AED ${Number(item.packagingFee).toFixed(2)}`} />
            )}
            {hasInsurance && (
              <PriceRow label="Insurance" value={`AED ${Number(item.insuranceFee).toFixed(2)}`} />
            )}
            {hasStorage && (
              <PriceRow label="Storage" value={`AED ${Number(item.storageFee).toFixed(2)}`} />
            )}

            {/* divider spanning both columns */}
            <span className="col-span-2 block h-px bg-[#1A1A1A] my-1" />

            <PriceRow
              label="Buyback / g"
              value={Number(item.buybackPerGram) > 0
                ? `AED ${Number(item.buybackPerGram).toFixed(2)}`
                : '—'}
              valueClass={Number(item.buybackPerGram) > 0 ? 'text-emerald-400' : 'text-[#444]'}
            />

            <PriceRow
              label="VAT"
              value={item.vatIncluded
                ? `Incl.${item.vatPct ? ` ${item.vatPct}%` : ''}`
                : 'Excl.'}
              valueClass={item.vatIncluded ? 'text-[#A8A9AD]' : 'text-[#555]'}
            />
          </div>
        </div>

        {/* Rating */}
        {item.rating != null ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={10}
                  style={{
                    color: i < Math.floor(item.rating) ? theme.icon : '#333',
                    fill: i < Math.floor(item.rating) ? theme.icon : '#333',
                  }}
                />
              ))}
            </div>
            <span className="text-[11px] text-[#555]">{item.rating} ({item.reviews} reviews)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>New Listing</span>
            <span className="text-[11px] text-[#444]">Be the first to buy</span>
          </div>
        )}

        {/* Buy button */}
        <motion.button
          whileTap={canBuy ? { scale: 0.97 } : {}}
          onClick={() => canBuy && onBuy(item)}
          disabled={!canBuy}
          className="mt-auto w-full py-3 rounded-lg text-[11px] tracking-widest uppercase font-bold flex items-center justify-center gap-2 transition-all duration-300 disabled:cursor-not-allowed"
          style={{
            background: canBuy ? theme.btnBg : 'rgba(50,50,50,0.5)',
            color: '#080808',
            opacity: canBuy ? 1 : 0.45,
          }}
        >
          <ShoppingCart size={13} />
          {vendorClosed ? 'Shop Closed' : item.inStock ? 'Buy Now' : 'Unavailable'}
        </motion.button>
      </div>
    </motion.div>
  )
}

/* ─── Buy Modal (3-step: Quote → Confirm → Success) ─────────── */

function QuoteCountdown({ ttl, onExpire }) {
  const [remaining, setRemaining] = useState(ttl)
  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const t = setInterval(() => setRemaining((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [remaining, onExpire])
  const pct = (remaining / ttl) * 100
  const urgent = remaining <= 15
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="20" cy="20" r="16" fill="none"
            stroke={urgent ? '#ef4444' : '#C9A84C'} strokeWidth="3"
            strokeDasharray={100.5} strokeDashoffset={100.5 * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
        </svg>
        <Clock size={13} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ color: urgent ? '#ef4444' : '#C9A84C' }} />
      </div>
      <div>
        <div className="text-[10px] tracking-widest uppercase text-[#555]">Price locked for</div>
        <div className="text-xl font-black font-mono" style={{ color: urgent ? '#ef4444' : '#C9A84C' }}>
          {remaining}s
        </div>
      </div>
    </div>
  )
}

function BuyModal({ item, platformFeePct = 0.5, quoteTtl = 60, liveProducts = [], onClose }) {
  const navigate = useNavigate()
  const { authFetch } = useAuth()
  const [qty, setQty] = useState(1)
  const [step, setStep] = useState('quote')
  const [expired, setExpired] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [currentBuyback, setCurrentBuyback] = useState(item.buybackPerGram)
  const [buybackFetching, setBuybackFetching] = useState(false)
  const theme = metalTheme[item.metal]

  const handlePlaceOrder = async () => {
    if (item.source !== 'live') {
      setStep('success')
      return
    }
    const catalogId = parseInt(String(item.id).replace('live-', ''), 10)
    setPlacing(true)
    setOrderError('')
    try {
      const r = await authFetch(`${API_AUTH_BASE}/orders/place/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: catalogId, qty }),
      })
      let d = {}
      try { d = await r.json() } catch {}
      if (r.ok) {
        navigate(`/payment/${d.id}`)
      } else {
        setOrderError(d.detail || 'Failed to place order. Please try again.')
      }
    } catch {
      setOrderError('Network error. Please try again.')
    } finally {
      setPlacing(false)
    }
  }
  const metalPrice = item.ratePerGram * item.totalGrams * qty
  const feeMultiplier = (platformFeePct ?? 0.5) / 100
  const fee = metalPrice * feeMultiplier
  const total = (metalPrice + fee).toFixed(2)
  const quoteId = `Q-${Math.floor(Math.random() * 90000) + 10000}`

  useEffect(() => {
    if (item.source !== 'live') return
    setBuybackFetching(true)
    fetch(`${API_AUTH_BASE}/marketplace/`)
      .then((r) => r.ok ? r.json() : {})
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items || [])
        const catalogId = String(item.id).replace('live-', '')
        const found = items.find((p) => String(p.id) === catalogId)
        const fresh = found?.effective_buyback_per_gram ?? found?.buyback_per_gram
        if (fresh != null) setCurrentBuyback(fresh)
      })
      .catch(() => {})
      .finally(() => setBuybackFetching(false))
  }, [item.id, item.source])

  if (step === 'success') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="rounded-2xl p-10 text-center max-w-sm w-full"
          style={{ background: '#111', border: `1px solid ${theme.border}` }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: `${theme.icon}20`, border: `2px solid ${theme.icon}` }}>
            <Check size={28} style={{ color: theme.icon }} />
          </motion.div>
          <h3 className="text-xl font-bold text-[#F5F0E8] mb-2">Order Placed!</h3>
          <p className="text-xs text-[#555] font-mono mb-1">{quoteId}</p>
          <p className="text-sm text-[#666] mb-2">
            Your order is pending vendor acceptance. You will be notified once confirmed.
          </p>
          <p className="text-[11px] text-[#444] mb-6">
            {item.name} · {item.totalGrams * qty}g · {item.vendorName}
          </p>
          <div className="p-3 rounded-xl mb-5"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <p className="text-[11px] text-emerald-400/80">
              Holding is created after payment confirmation. Sell-back guaranteed at AED {Number(currentBuyback).toFixed(2)}/g ({item.vendorName}).
            </p>
          </div>
          <Link to="/dashboard/customer"
            className="block w-full py-3 rounded-lg text-xs tracking-widest uppercase font-bold text-center"
            style={{ background: theme.btnBg, color: '#080808' }}>
            View Portfolio
          </Link>
        </motion.div>
      </motion.div>
    )
  }

  if (expired) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="rounded-2xl p-10 text-center max-w-sm w-full"
          style={{ background: '#111', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-[#F5F0E8] mb-2">Quote Expired</h3>
          <p className="text-sm text-[#666] mb-6">
            Price quotes are valid for {quoteTtl} seconds to ensure market accuracy. Please request a new quote.
          </p>
          <button onClick={() => { setExpired(false); setStep('quote') }}
            className="w-full py-3 rounded-lg text-xs tracking-widest uppercase font-bold mb-3"
            style={{ background: theme.btnBg, color: '#080808' }}>
            Get New Quote
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-lg text-xs tracking-widest uppercase font-semibold text-[#555]">
            Cancel
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl max-w-md w-full flex flex-col overflow-hidden"
        style={{ background: '#0F0F0F', border: `1px solid ${theme.border}`, maxHeight: '90vh' }}>

        {/* Step indicator — pinned */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { key: 'quote', label: '1. Quote' },
            { key: 'confirm', label: '2. Confirm' },
          ].map((s) => (
            <div key={s.key} className="flex-1 py-3 text-center text-[10px] tracking-widest uppercase font-semibold transition-colors"
              style={{
                color: step === s.key ? theme.icon : '#444',
                borderBottom: step === s.key ? `2px solid ${theme.icon}` : '2px solid transparent',
              }}>
              {s.label}
            </div>
          ))}
        </div>

        {/* Header — pinned */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div>
            <h3 className="text-base font-bold text-[#F5F0E8]">
              {step === 'quote' ? 'Price Quote' : 'Order Confirmation'}
            </h3>
            <p className="text-xs text-[#555] mt-0.5">{item.vendorName}</p>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-[#888]"><X size={18} /></button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
          {/* Item */}
          <div className="flex items-center gap-4">
            <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover opacity-80" />
            <div>
              <div className={`text-sm font-bold ${theme.textClass}`}>{item.name}</div>
              <div className="text-xs text-[#555] mt-0.5">{item.totalGrams}g · AED {item.ratePerGram.toFixed(2)}/g</div>
              <div className="flex items-center gap-1.5 mt-1">
                {item.vendorVerified && <Shield size={10} className="text-emerald-400" />}
                <span className="text-[10px] text-emerald-400">Verified Vendor</span>
              </div>
            </div>
          </div>

          {/* STEP: QUOTE */}
          {step === 'quote' && (
            <>
              <QuoteCountdown ttl={quoteTtl} onExpire={() => setExpired(true)} />

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2 block">Quantity</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center"
                    style={{ background: `${theme.icon}10`, border: `1px solid ${theme.icon}30`, color: theme.icon }}>−</button>
                  <span className="text-lg font-bold text-[#F5F0E8] w-8 text-center">{qty}</span>
                  <button onClick={() => setQty(qty + 1)}
                    className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center"
                    style={{ background: `${theme.icon}10`, border: `1px solid ${theme.icon}30`, color: theme.icon }}>+</button>
                </div>
              </div>

              <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{ background: 'rgba(0,0,0,0.4)' }}>
                {[
                  ['Metal price', `AED ${(item.ratePerGram * item.totalGrams * qty).toFixed(2)}`],
                  ['VAT', item.vatIncluded ? 'Included' : 'Not applicable'],
                  [`Platform fee (${platformFeePct ?? 0.5}%)`, `AED ${fee.toFixed(2)}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs text-[#555]">{k}</span>
                    <span className="text-xs text-[#888]">{v}</span>
                  </div>
                ))}
                <div className="h-px bg-[#1A1A1A]" />
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#F5F0E8]">Total</span>
                  <span className={`text-sm font-black ${theme.textClass}`}>AED {total}</span>
                </div>
              </div>

              {/* Buyback guarantee — live vendor rate */}
              <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp size={13} className="text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] tracking-widest uppercase text-emerald-400/70 font-semibold truncate">
                      {item.vendorName} · Buyback Rate
                    </div>
                    {!buybackFetching && Number(currentBuyback) > 0 && (
                      <div className="text-[10px] text-emerald-400/50 mt-0.5">
                        Total sell-back: <span className="font-semibold text-emerald-400/80">
                          AED {(Number(currentBuyback) * item.totalGrams * qty).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {buybackFetching ? (
                    <div className="w-4 h-4 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                  ) : (
                    <div className="text-base font-black text-emerald-400">
                      AED {Number(currentBuyback).toFixed(2)}
                      <span className="text-[10px] font-normal text-emerald-400/60">/g</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <Info size={12} style={{ color: theme.icon }} className="flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed" style={{ color: `${theme.icon}aa` }}>
                  This price is locked for {quoteTtl} seconds. After expiry, a new quote will be required.
                </p>
              </div>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => setStep('confirm')}
                className="w-full py-4 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center justify-center gap-2"
                style={{ background: theme.btnBg, color: '#080808' }}>
                <Zap size={14} /> Proceed to Confirm
              </motion.button>
            </>
          )}

          {/* STEP: CONFIRM */}
          {step === 'confirm' && (
            <>
              <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${theme.border}` }}>
                <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3">Order Summary</div>
                {[
                  ['Product', item.name],
                  ['Quantity', `${item.totalGrams * qty}g`],
                  ['Vendor', item.vendorName],
                  ['Price locked at', `AED ${item.ratePerGram.toFixed(2)}/g`],
                  ['Total (incl. fee)', `AED ${total}`],
                  ['Quote ID', quoteId],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-xs text-[#555]">{k}</span>
                    <span className={`text-xs font-semibold ${k === 'Quote ID' ? 'font-mono text-[#C9A84C]' : 'text-[#F5F0E8]'}`}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                <TrendingUp size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                  Guaranteed sell-back at{' '}
                  <span className="font-bold">AED {Number(currentBuyback).toFixed(2)}/g</span>
                  {Number(currentBuyback) > 0 && (
                    <> = <span className="font-bold">
                      AED {(Number(currentBuyback) * item.totalGrams * qty).toFixed(2)} total
                    </span></>
                  )}
                  {' '}({item.vendorName}).
                </p>
              </div>

              {orderError && (
                <div className="px-3 py-2 rounded-lg text-[11px] text-red-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {orderError}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep('quote')} disabled={placing}
                  className="flex-1 py-3 rounded-xl text-xs tracking-widest uppercase font-semibold disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}>
                  Back
                </button>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="flex-1 py-3 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{ background: theme.btnBg, color: '#080808' }}>
                  {placing
                    ? <div className="w-4 h-4 border-2 border-[#08080830] border-t-[#080808] rounded-full animate-spin" />
                    : <><Check size={14} /> Place Order</>}
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Main Marketplace ───────────────────────────────────────── */
function normalizeLiveProduct(p) {
  return {
    id: `live-${p.id}`,
    name: p.name,
    shortDesc: `${p.purity} fine ${p.metal}. ${p.weight}g · ${p.vat_inclusive ? 'VAT incl.' : `+${p.vat_pct}% VAT`}`,
    metal: ['gold', 'silver', 'platinum', 'palladium'].includes(p.metal) ? p.metal : 'gold',
    image: p.image_url || null,
    metalRatePerGram: p.effective_rate ?? 0,
    ratePerGram: p.final_rate_per_gram,
    totalGrams: p.weight,
    vatIncluded: p.vat_inclusive,
    vatPct: p.vat_pct ?? 0,
    packagingFee: p.packaging_fee ?? 0,
    storageFee: p.storage_fee ?? 0,
    insuranceFee: p.insurance_fee ?? 0,
    vendorName: p.vendor_name || 'Verified Vendor',
    vendorVerified: p.vendor_verified !== false,
    buybackPerGram: p.effective_buyback_per_gram ?? p.buyback_per_gram ?? 0,
    rating: null,
    reviews: null,
    inStock: p.in_stock,
    isOpen: p.is_open !== false,
    badge: 'Live',
    badgeColor: 'gold',
    source: 'live',
  }
}

export default function Marketplace() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('default')
  const [wishlist, setWishlist] = useState([])
  const [buyItem, setBuyItem] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [liveProducts, setLiveProducts] = useState([])
  const [platformFeePct, setPlatformFeePct] = useState(0.5)
  const [quoteTtl, setQuoteTtl] = useState(60)

  useEffect(() => {
    const fetchProducts = () => {
      fetch(`${API_AUTH_BASE}/marketplace/`)
        .then((r) => r.ok ? r.json() : {})
        .then((data) => {
          const items = Array.isArray(data) ? data : (data.items || [])
          if (data.buy_fee_pct != null) setPlatformFeePct(Number(data.buy_fee_pct))
          if (data.quote_ttl_seconds != null) setQuoteTtl(Number(data.quote_ttl_seconds))
          setLiveProducts(items.map(normalizeLiveProduct))
        })
        .catch(() => {})
    }
    fetchProducts()
    const timer = setInterval(fetchProducts, 15000)
    return () => clearInterval(timer)
  }, [])

  const allListings = liveProducts

  const toggleWishlist = (id) =>
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const filterButtons = [
    { key: 'all', label: 'All Metals' },
    { key: 'gold', label: 'Gold' },
    { key: 'silver', label: 'Silver' },
    { key: 'platinum', label: 'Platinum' },
  ]

  const filtered = allListings
    .filter((l) => filter === 'all' || l.metal === filter)
    .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.vendorName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price-asc') return (a.ratePerGram * a.totalGrams) - (b.ratePerGram * b.totalGrams)
      if (sort === 'price-desc') return (b.ratePerGram * b.totalGrams) - (a.ratePerGram * a.totalGrams)
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return 0
    })

  return (
    <main className="min-h-screen pt-24 pb-20">
      {/* Page header */}
      <section className="relative py-16 overflow-hidden" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-[11px] tracking-[0.3em] uppercase text-[#C9A84C] mb-4">UAE Bullion Market</p>
            <h1 className="text-4xl md:text-6xl font-black mb-4">
              <span style={{ color: '#F5F0E8' }}>The</span>{' '}
              <span className="gradient-gold-text">Marketplace</span>
            </h1>
            <p className="text-[#666] text-sm max-w-lg leading-relaxed">
              Real-time listings from verified UAE bullion vendors. Every lot is backed by physical inventory. 
              All prices include transparent buyback guarantees.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" />
            <input
              type="text"
              placeholder="Search metal, vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-[#F5F0E8] placeholder-[#444] outline-none transition-all duration-300 focus:border-[rgba(201,168,76,0.4)]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.12)' }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className="px-4 py-2 rounded-lg text-[11px] tracking-widest uppercase font-semibold transition-all duration-200"
                style={
                  filter === btn.key
                    ? { background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#555' }
                }
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none pl-4 pr-10 py-3 rounded-xl text-xs tracking-widest uppercase text-[#888] outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.12)' }}
            >
              <option value="default">Sort: Default</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
          </div>
        </motion.div>

        {/* Result count */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] tracking-widest uppercase text-[#444]">
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''} found
          </span>
          {wishlist.length > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="flex items-center gap-1.5 text-[11px] tracking-widest uppercase"
              style={{ color: '#C9A84C' }}
            >
              <Heart size={11} fill="#C9A84C" />
              {wishlist.length} wishlisted
            </button>
          )}
        </div>
      </div>

      {/* Live listings banner */}
      {liveProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mb-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Sparkles size={12} className="text-emerald-400" />
            <span className="text-emerald-400 font-semibold">{liveProducts.length} live vendor listing{liveProducts.length !== 1 ? 's' : ''}</span>
            <span className="text-[#444]">are available from verified vendors.</span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-24"
            >
              <p className="text-[#444] text-sm tracking-widest uppercase max-w-md mx-auto leading-relaxed">
                {liveProducts.length === 0 && !search.trim()
                  ? 'No products are listed yet. Vendors add inventory in their dashboard—check back soon.'
                  : 'No listings match your search'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filtered.map((item) => (
                <MetalCard
                  key={item.id}
                  item={item}
                  wishlist={wishlist}
                  onWishlist={toggleWishlist}
                  onBuy={setBuyItem}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buy Modal */}
      <AnimatePresence>
        {buyItem && (
          <BuyModal
            item={buyItem}
            platformFeePct={platformFeePct}
            quoteTtl={quoteTtl}
            liveProducts={liveProducts}
            onClose={() => setBuyItem(null)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
