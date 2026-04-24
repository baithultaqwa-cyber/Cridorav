import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, Package, RefreshCw, Users, Zap, CheckCircle, XCircle,
  Plus, BarChart2, DollarSign, AlertTriangle, Timer, FileText,
  Edit2, Eye, EyeOff, X, Save, UserPlus, Shield, Warehouse,
  ChevronDown, RotateCcw, Upload, ExternalLink, Clock,
  Sliders, RefreshCcw, Link2, Trash2, Info, Calendar, Trash, Settings, Lock, Image as ImageIcon
} from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { API_AUTH_BASE as API_BASE, API_SPOT_PRICES } from '../../config'
import { usePoll } from '../../hooks/usePoll'
import { VENDOR_DESK_POLL_MS, VENDOR_DASH_POLL_MS } from '../../config/pollIntervals'
import { broadcastPricesRefresh } from '../../lib/pricesRefresh'
import { openAuthDocument } from '../../utils/openAuthDocument'
import { withResolvedCatalogImage, catalogImageUrl } from '../../utils/mediaUrl'
import { validateCatalogImageFile } from '../../utils/catalogImageValidation'
import CatalogImage from '../../components/CatalogImage'

const NAV = [
  { sectionKey: 'desk',       icon: Zap,       label: 'Live Sales Desk' },
  { sectionKey: 'portfolio',  icon: BarChart2,  label: 'Portfolio' },
  { sectionKey: 'schedule',   icon: Clock,     label: 'Schedule & Hours' },
  { sectionKey: 'sellback',   icon: RefreshCw,  label: 'Sell-back Queue' },
  { sectionKey: 'catalog',    icon: Package,   label: 'Catalog' },
  { sectionKey: 'pricing',    icon: Sliders,   label: 'Pricing' },
  { sectionKey: 'inventory',  icon: Warehouse, label: 'Inventory' },
  { sectionKey: 'financials', icon: DollarSign,label: 'Financials' },
  { sectionKey: 'statements', icon: FileText,  label: 'Statements' },
  { sectionKey: 'team',       icon: Users,     label: 'Team' },
  { sectionKey: 'kyb',        icon: Shield,    label: 'KYB Docs' },
  { sectionKey: 'settings',   icon: Settings,  label: 'Settings' },
]

const METALS = [
  { key: 'gold',      label: 'Gold',      color: '#C9A84C', symbol: 'Au' },
  { key: 'silver',    label: 'Silver',    color: '#A8A9AD', symbol: 'Ag' },
  { key: 'platinum',  label: 'Platinum',  color: '#E5E4E2', symbol: 'Pt' },
  { key: 'palladium', label: 'Palladium', color: '#B5A6A0', symbol: 'Pd' },
]

/** Unique fineness labels from catalog for one metal (stable sort). */
function catalogPuritiesForMetal(catalog, metalKey) {
  const set = new Set()
  for (const p of catalog || []) {
    if (p.metal === metalKey && p.purity != null && String(p.purity).trim() !== '') {
      set.add(String(p.purity).trim())
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/** Approximate AED/g from public spot payload for vendor preview (aligns with tier scaling in backend). */
const GRAM_SELL = {
  gold: 'gold_gram_rates_by_purity',
  silver: 'silver_gram_rates_by_purity',
  platinum: 'platinum_gram_rates_by_purity',
  palladium: 'palladium_gram_rates_by_purity',
}
const GRAM_BUY = {
  gold: 'gold_gram_buybacks_by_purity',
  silver: 'silver_gram_buybacks_by_purity',
  platinum: 'platinum_gram_buybacks_by_purity',
  palladium: 'palladium_gram_buybacks_by_purity',
}

function liveSellAedG(pricing, spotPayload, form) {
  if (!form?.use_live_rate) return parseFloat(form.manual_rate_per_gram) || 0
  if (!pricing) return 0
  const m = form.metal
  const p = String(form.purity || '').trim()
  const gk = GRAM_SELL[m]
  if (!gk) return parseFloat(pricing[`${m}_rate`]) || 0
  const gmap = pricing[gk] || {}
  if (gmap[p] != null && String(gmap[p]) !== '' && Number(gmap[p]) > 0) return Number(gmap[p])
  for (const [k, v] of Object.entries(gmap)) {
    if (k.trim().toLowerCase() === p.toLowerCase() && Number(v) > 0) return Number(v)
  }
  if ((m === 'gold' && pricing.use_home_spot_gold) || (m === 'silver' && pricing.use_home_spot_silver)) {
    const sp = previewSpotRatePerGram(spotPayload, m, p)
    if (sp != null && !Number.isNaN(sp) && sp > 0) return sp
  }
  return parseFloat(pricing[`${m}_rate`]) || 0
}

function liveBuyAedG(pricing, form, sellRate, liveDeductions) {
  if (!form?.use_live_rate) return Math.max(0, parseFloat(form.buyback_per_gram) || 0)
  if (!pricing) return 0
  const m = form.metal
  const p = String(form.purity || '').trim()
  const bk = GRAM_BUY[m]
  if (!bk) {
    return Math.max(0, sellRate - (parseFloat(liveDeductions?.[m]) || 0))
  }
  const bmap = pricing[bk] || {}
  let v = bmap[p]
  if (v == null) {
    for (const [k, val] of Object.entries(bmap)) {
      if (k.trim().toLowerCase() === p.toLowerCase()) { v = val; break }
    }
  }
  if (v != null && v !== '' && !Number.isNaN(Number(v))) {
    return Math.max(0, Number(v))
  }
  return Math.max(0, sellRate - (parseFloat(liveDeductions?.[m]) || 0))
}

function previewSpotRatePerGram(spotPayload, metalKey, purity) {
  if (!spotPayload) return null
  if (metalKey === 'gold') {
    const g = spotPayload.gold
    if (!g || typeof g !== 'object') return null
    const p = (purity || '24K').trim()
    if (g[p] != null) return Number(g[p])
    const pu = p.toUpperCase()
    if (g[pu] != null) return Number(g[pu])
    const num = parseFloat(String(p).replace(/\s/g, ''))
    if (!Number.isNaN(num) && num > 0 && num <= 1000) {
      const base = Number(g['24K'] ?? 0)
      return base * (num / 1000)
    }
    return Number(g['24K'] ?? 0) || null
  }
  if (metalKey === 'silver') {
    const s = spotPayload.silver
    if (!s || typeof s !== 'object') return null
    const p = (purity || '999').trim()
    if (s[p] != null) return Number(s[p])
    const num = parseFloat(String(p).replace(/\s/g, ''))
    if (!Number.isNaN(num) && num > 0 && num <= 1000) {
      const base = Number(s['999'] ?? 0)
      return base * (num / 1000)
    }
    return Number(s['999'] ?? 0) || null
  }
  return null
}

function resolveCatalogPreviewUrl(preview) {
  if (preview == null || preview === '') return null
  const s = String(preview)
  if (s.startsWith('blob:') || s.startsWith('data:')) return s
  return catalogImageUrl(s) || s
}

function formatUploadErrorResponse(data, status) {
  if (data == null || typeof data !== 'object') return `Upload failed (HTTP ${status})`
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((x) => (typeof x === 'string' ? x : (x && (x.string || x.message)) || JSON.stringify(x)))
      .join(' ')
  }
  return `Upload failed (HTTP ${status})`
}

/* ── Live product controls (embedded in Live Sales Desk) ─────── */
function mapCatalogToDeskRow(p) {
  return {
    id: p.id, name: p.name, metal: p.metal, weight: p.weight, purity: p.purity,
    in_stock: p.in_stock, stock_qty: p.stock_qty,
    use_live_rate: p.use_live_rate,
    manual_rate_per_gram: p.manual_rate_per_gram ?? 0,
    effective_rate: p.effective_rate ?? 0,
    final_price: p.final_price,
    image_url: catalogImageUrl(p.image_url) || null,
  }
}

function LiveProductControls({ catalog, getToken, onUpdate, onProductUpdated }) {
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState({})
  const [msgs, setMsgs] = useState({})
  const rowDirtyRef = useRef({})

  useEffect(() => {
    setRows((prev) => {
      const prevById = Object.fromEntries(prev.map((r) => [r.id, r]))
      return catalog.map((p) => {
        if (rowDirtyRef.current[p.id] && prevById[p.id]) {
          return prevById[p.id]
        }
        return mapCatalogToDeskRow(p)
      })
    })
  }, [catalog])

  const setRow = (id, key, val) => {
    rowDirtyRef.current[id] = true
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: val } : r))
  }

  const setStockQty = (id, raw) => {
    rowDirtyRef.current[id] = true
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      const next = { ...r, stock_qty: raw }
      if (Number(raw) > 0) next.in_stock = true
      return next
    }))
  }

  const revertToLive = (id) => {
    rowDirtyRef.current[id] = true
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, use_live_rate: true } : r))
  }

  const overrideRate = (id, val) => {
    rowDirtyRef.current[id] = true
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, manual_rate_per_gram: val, use_live_rate: false } : r
    ))
  }

  const quickSave = async (row) => {
    setSaving((p) => ({ ...p, [row.id]: true }))
    const payload = {
      in_stock: Number(row.stock_qty) > 0 ? true : row.in_stock,
      stock_qty: Number(row.stock_qty),
      use_live_rate: row.use_live_rate,
      manual_rate_per_gram: Number(row.manual_rate_per_gram || 0),
    }
    const r = await fetch(`${API_BASE}/vendor/catalog/${row.id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    })
    setSaving((p) => ({ ...p, [row.id]: false }))
    if (r.ok) {
      const updated = await r.json()
      delete rowDirtyRef.current[updated.id]
      // immediately sync local row + parent catalog state from the server response
      setRows((prev) => prev.map((rx) => rx.id === updated.id ? {
        ...rx,
        in_stock: updated.in_stock,
        stock_qty: updated.stock_qty,
        use_live_rate: updated.use_live_rate,
        manual_rate_per_gram: updated.manual_rate_per_gram,
        effective_rate: updated.effective_rate,
        effective_buyback_per_gram: updated.effective_buyback_per_gram,
        final_price: updated.final_price,
      } : rx))
      onProductUpdated?.(updated)   // patch catalog in parent immediately
      onUpdate?.()                  // also trigger full refresh for other sections
      broadcastPricesRefresh({ source: 'vendor-catalog-desk' })
      setMsgs((p) => ({ ...p, [row.id]: 'Saved' }))
      setTimeout(() => setMsgs((p) => ({ ...p, [row.id]: '' })), 2500)
    } else {
      setMsgs((p) => ({ ...p, [row.id]: 'Error' }))
    }
  }

  if (rows.length === 0) return null

  const METAL_COLOR = { gold: '#C9A84C', silver: '#A8A9AD', platinum: '#E5E4E2', palladium: '#B5A6A0' }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Package size={14} className="text-[#C9A84C]" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#888]">Product Inventory Controls</h3>
        <span className="text-[10px] text-[#444]">— manage stock, availability &amp; sell price without leaving this page</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const color = METAL_COLOR[row.metal] || '#C9A84C'
          const displayRate = row.use_live_rate
            ? Number(row.effective_rate ?? 0)
            : Number(row.manual_rate_per_gram || 0)
          return (
            <div key={row.id} className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>

              {/* Thumb */}
              <CatalogImage
                url={row.image_url}
                alt=""
                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                fallback={(
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ background: `${color}15` }}>
                    <Package size={14} style={{ color }} />
                  </div>
                )}
              />

              {/* Name + metal */}
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs font-semibold text-[#F5F0E8] truncate">{row.name}</div>
                <div className="text-[10px]" style={{ color }}>{row.weight}g · {row.metal} · {row.purity}</div>
              </div>

              {/* ── Sell rate control ── */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    {row.use_live_rate ? (
                      <span className="text-[9px] tracking-widest uppercase font-bold px-1.5 py-0.5 rounded-sm"
                        style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C' }}>
                        Live
                      </span>
                    ) : (
                      <button onClick={() => revertToLive(row.id)}
                        className="text-[9px] tracking-widest uppercase font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#555' }}>
                        <RotateCcw size={8} /> Live
                      </button>
                    )}
                    <label className="text-[10px] uppercase tracking-wider text-[#555]">Rate/g</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#555]">AED</span>
                    <input
                      type="number" step="0.0001" min="0"
                      value={row.use_live_rate ? displayRate : row.manual_rate_per_gram}
                      readOnly={row.use_live_rate}
                      onChange={(e) => overrideRate(row.id, e.target.value)}
                      onFocus={() => { if (row.use_live_rate) overrideRate(row.id, displayRate) }}
                      className="w-24 px-2 py-1.5 rounded-lg text-xs text-center"
                      style={{
                        background: row.use_live_rate ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${row.use_live_rate ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.15)'}`,
                        color: row.use_live_rate ? '#C9A84C' : '#F5F0E8',
                        outline: 'none',
                        cursor: row.use_live_rate ? 'default' : 'text',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Stock qty */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <label className="text-[10px] uppercase tracking-wider text-[#555]">Stock Qty</label>
                <input
                  type="number" min="0" value={row.stock_qty}
                  onChange={(e) => setStockQty(row.id, e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-lg text-xs text-center text-[#F5F0E8]"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                />
              </div>

              {/* In stock toggle */}
              <button type="button"
                onClick={() => setRow(row.id, 'in_stock', !row.in_stock)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold flex-shrink-0 transition-colors"
                style={{
                  background: row.in_stock ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${row.in_stock ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                  color: row.in_stock ? '#10b981' : '#ef4444',
                }}>
                {row.in_stock ? <CheckCircle size={11} /> : <XCircle size={11} />}
                {row.in_stock ? 'In Stock' : 'Sold Out'}
              </button>

              {/* Save btn */}
              <button onClick={() => quickSave(row)} disabled={saving[row.id]}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold flex-shrink-0 disabled:opacity-50"
                style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}>
                {saving[row.id] ? <RefreshCcw size={10} className="animate-spin" /> : <Save size={10} />}
                <span style={{ color: msgs[row.id] === 'Error' ? '#ef4444' : msgs[row.id] === 'Saved' ? '#10b981' : undefined }}>
                  {msgs[row.id] || 'Update'}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}


/* ── Live metal rate controls (embedded in Live Sales Desk) — same per-fineness grid as Pricing ─ */
function LiveMetalRateControls({ vendorPricing, usedMetals, catalog, getToken, onSaved }) {
  const [local, setLocal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })
  const [spotPreview, setSpotPreview] = useState(null)
  const dirty = useRef(false)
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,169,173,0.15)', color: '#F5F0E8', outline: 'none' }
  const catalogGoldPurities = useMemo(() => catalogPuritiesForMetal(catalog, 'gold'), [catalog])
  const catalogSilverPurities = useMemo(() => catalogPuritiesForMetal(catalog, 'silver'), [catalog])
  const goldPurityText = (local?.gold_purity_options && local.gold_purity_options.length)
    ? local.gold_purity_options.join(', ') : '24K, 22K, 21K, 18K, 999.9, 999, 916'
  const silverPurityText = (local?.silver_purity_options && local.silver_purity_options.length)
    ? local.silver_purity_options.join(', ') : '999, 999.9, 925, 958'
  const loadSpotPreview = () => {
    fetch(API_SPOT_PRICES, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSpotPreview(data) })
      .catch(() => {})
  }
  useEffect(() => { loadSpotPreview() }, [])
  useEffect(() => {
    if (dirty.current) return
    setLocal(vendorPricing)
  }, [vendorPricing])
  const save = async () => {
    if (!local) return
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await fetch(`${API_BASE}/vendor/pricing/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...local,
          gold_purity_options: splitPurityInput(goldPurityText),
          silver_purity_options: splitPurityInput(silverPurityText),
        }),
      })
      const d = await r.json()
      if (r.ok) {
        dirty.current = false
        onSaved?.(d)
        broadcastPricesRefresh({ source: 'vendor-desk-rates' })
        setMsg({ text: 'Pricing updated.', type: 'ok' })
        setTimeout(() => setMsg({ text: '', type: 'ok' }), 3000)
      } else {
        setMsg({ text: d.detail || 'Save failed.', type: 'err' })
      }
    } catch {
      setMsg({ text: 'Network error.', type: 'err' })
    } finally {
      setSaving(false)
    }
  }
  const METAL_COLOR = { gold: '#C9A84C', silver: '#A8A9AD', platinum: '#E5E4E2', palladium: '#B5A6A0' }
  const showGoldSpotPreview = (local?.use_home_spot_gold) && catalogGoldPurities.length > 0
  const showSilverSpotPreview = (local?.use_home_spot_silver) && catalogSilverPurities.length > 0
  if (usedMetals.length === 0 || !local) return null
  return (
    <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.12)' }}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Sliders size={13} className="text-[#C9A84C]" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#888]">Live sell &amp; buyback (per fineness)</h3>
        <span className="text-[10px] text-[#444]">— same as Pricing; optional cells fall back to spot or base rate</span>
        <button type="button" onClick={loadSpotPreview}
          className="ml-auto text-[10px] tracking-widest uppercase font-semibold px-2 py-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
          Refresh spot preview
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
        {usedMetals.map(({ key, label, color, symbol }) => {
          const roG = key === 'gold' && local.use_home_spot_gold
          const roS = key === 'silver' && local.use_home_spot_silver
          const pur = puritiesForMetalInPricing(key, local, catalog, goldPurityText, silverPurityText)
          return (
            <MetalPurityRatesEditor
              key={key}
              keyName={key}
              label={label}
              color={color || METAL_COLOR[key] || '#C9A84C'}
              symbol={symbol}
              dimmed={false}
              cfg={local}
              setCfg={(up) => { dirty.current = true; setLocal(up) }}
              purities={pur}
              catalog={catalog}
              inputStyle={inputStyle}
              readOnlySpotSell={roG || roS}
              spotSourceNote={roG ? 'Tied to global spot (24K ref).' : roS ? 'Tied to global spot (999 ref).' : ''}
            />
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
          style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}>
          {saving ? <RefreshCcw size={10} className="animate-spin" /> : <Zap size={10} />}
          {saving ? 'Saving…' : 'Save live pricing'}
        </button>
        {msg.text && <span className={`text-[10px] ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
      {(showGoldSpotPreview || showSilverSpotPreview) && spotPreview && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-[#555] mb-2">Public ticker (may include admin display margin)</p>
          <div className="flex flex-wrap gap-4">
            {showGoldSpotPreview && (
              <div className="rounded-lg px-3 py-2 text-[10px]" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <div className="font-bold text-[#C9A84C] mb-1 uppercase tracking-wider">Gold</div>
                {catalogGoldPurities.map((pur) => {
                  const v = previewSpotRatePerGram(spotPreview, 'gold', pur)
                  return (
                    <div key={pur} className="flex justify-between gap-4 text-[#888]">
                      <span>{pur}</span>
                      <span className="font-mono text-[#F5F0E8]">{v != null && !Number.isNaN(v) ? v.toFixed(4) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {showSilverSpotPreview && (
              <div className="rounded-lg px-3 py-2 text-[10px]" style={{ background: 'rgba(168,169,173,0.06)', border: '1px solid rgba(168,169,173,0.12)' }}>
                <div className="font-bold text-[#A8A9AD] mb-1 uppercase tracking-wider">Silver</div>
                {catalogSilverPurities.map((pur) => {
                  const v = previewSpotRatePerGram(spotPreview, 'silver', pur)
                  return (
                    <div key={pur} className="flex justify-between gap-4 text-[#888]">
                      <span>{pur}</span>
                      <span className="font-mono text-[#F5F0E8]">{v != null && !Number.isNaN(v) ? v.toFixed(4) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


/* ── Vendor Portfolio ────────────────────────────────────────────── */
const STATUS_STYLE = {
  paid:            { label: 'Completed', cls: 'bg-emerald-500/10 text-emerald-400' },
  vendor_accepted: { label: 'Awaiting Payment', cls: 'bg-blue-500/10 text-blue-400' },
  pending_vendor:  { label: 'Pending',   cls: 'bg-yellow-500/10 text-yellow-500' },
  rejected:        { label: 'Rejected',  cls: 'bg-red-500/10 text-red-400' },
  expired:         { label: 'Expired',   cls: 'bg-[#333] text-[#555]' },
}

const METAL_COLOR = {
  gold:    '#F5A623',
  silver:  '#A8A9AD',
  platinum:'#9BBACC',
}

function SummaryCard({ label, value, sub, icon: Icon, accent = '#A8A9AD' }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[9px] tracking-[0.14em] uppercase text-[#555]">{label}</p>
        {Icon && <Icon size={12} style={{ color: accent }} />}
      </div>
      <p className="text-xl font-black tabular-nums text-white leading-none">{value}</p>
      {sub && <p className="text-[10px] text-[#555] mt-0.5">{sub}</p>}
    </div>
  )
}

function PortfolioSection() {
  const { authFetch } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    authFetch(`${API_BASE}/vendor/portfolio/`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load portfolio.'); setLoading(false) })
  }, [authFetch])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error) return <p className="text-sm text-red-400 py-8">{error}</p>

  const { stats, financials, inventory, schedule, live_rates,
          metal_revenue, metal_units, product_stats, recent_orders } = data
  const metals = Object.keys(metal_revenue || {})
  const liveMetals = Object.keys(live_rates || {})

  const fmt = (n, d = 2) => Number(n ?? 0).toLocaleString('en', { minimumFractionDigits: d })

  return (
    <div className="space-y-8">

      {/* ── Row 1: Vendor status + today strip ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${schedule?.is_open_now ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <span className={`text-xs font-semibold ${schedule?.is_open_now ? 'text-emerald-400' : 'text-red-400'}`}>
            {schedule?.is_open_now ? 'Open for Business' : 'Currently Closed'}
          </span>
          {schedule?.opening_time && (
            <span className="text-[10px] text-[#444]">
              {schedule.opening_time.slice(0, 5)} – {schedule?.closing_time?.slice(0, 5)}
            </span>
          )}
          {schedule?.always_open && <span className="text-[10px] text-[#444]">Always open</span>}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[9px] tracking-widest uppercase text-[#444]">Today's Revenue</p>
            <p className="text-sm font-black tabular-nums text-[#C9A84C]">AED {fmt(stats.today_revenue_aed)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-widest uppercase text-[#444]">Today's Orders</p>
            <p className="text-sm font-black tabular-nums text-white">{stats.today_orders}</p>
          </div>
          {stats.pending > 0 && (
            <div className="text-right">
              <p className="text-[9px] tracking-widest uppercase text-[#444]">Pending</p>
              <p className="text-sm font-black tabular-nums text-yellow-500">{stats.pending}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: 8 key metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        <SummaryCard label="Net Revenue"       value={`AED ${fmt(stats.net_revenue_aed)}`}   icon={DollarSign} accent="#C9A84C"
          sub={`Gross AED ${fmt(stats.revenue_aed)}`} />
        <SummaryCard label="Total Orders"     value={stats.total_orders}                     icon={FileText}   accent="#A8A9AD"
          sub={`${stats.accepted} completed · ${stats.pending} pending`} />
        <SummaryCard label="Buybacks"         value={stats.total_sellbacks || 0}             icon={RefreshCw}  accent="#ef4444"
          sub={`AED ${fmt(stats.total_sellbacks_aed)} paid · ${stats.pending_sellbacks || 0} pending`} />
        <SummaryCard label="Acceptance Rate"  value={`${stats.acceptance_rate}%`}            icon={CheckCircle} accent="#10b981"
          sub={`Avg order AED ${fmt(stats.avg_order_aed)}`} />
      </div>

      {/* ── Row 3: Financials + Inventory + Schedule ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Financials */}
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] flex items-center gap-1.5">
            <DollarSign size={10} /> Financials
          </p>
          {[
            ['Total Revenue',     `AED ${fmt(financials?.total_revenue_aed)}`,    'text-[#C9A84C]'],
            ['Total Sellbacks',   `−AED ${fmt(financials?.total_sellbacks_aed)}`, 'text-red-400'],
            ['Net Pool Balance',  `AED ${fmt(financials?.pool_balance_aed)}`,     'text-white'],
            ['Credits Today',     `AED ${fmt(financials?.credits_today_aed)}`,    'text-emerald-400'],
            ['Debits Today',      `−AED ${fmt(financials?.debits_today_aed)}`,    'text-orange-400'],
            ['Platform Fees',     `AED ${fmt(financials?.platform_fees_aed)}`,    'text-[#555]'],
          ].map(([k, v, cls]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-[11px] text-[#555]">{k}</span>
              <span className={`text-xs font-bold tabular-nums ${cls}`}>{v}</span>
            </div>
          ))}
        </div>

        {/* Inventory health */}
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] flex items-center gap-1.5">
            <Package size={10} /> Inventory
          </p>
          {[
            ['Total Products',  inventory?.total_products,   'text-white'],
            ['Active & In Stock', inventory?.active,          'text-emerald-400'],
            ['Low Stock (≤5)',   inventory?.low_stock,        inventory?.low_stock > 0 ? 'text-yellow-500' : 'text-[#555]'],
            ['Out of Stock',    inventory?.out_of_stock,      inventory?.out_of_stock > 0 ? 'text-red-400' : 'text-[#555]'],
          ].map(([k, v, cls]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-[11px] text-[#555]">{k}</span>
              <span className={`text-xs font-bold tabular-nums ${cls}`}>{v ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Live rates snapshot */}
        <div className="rounded-xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] flex items-center gap-1.5">
            <TrendingUp size={10} /> Live Rates
          </p>
          {liveMetals.length === 0 ? (
            <p className="text-[11px] text-[#444]">No rates configured</p>
          ) : liveMetals.map(m => (
            <div key={m} className="flex justify-between items-center">
              <span className="text-[11px] capitalize" style={{ color: METAL_COLOR[m] || '#888' }}>{m}</span>
              <span className="text-xs font-bold tabular-nums text-white">
                AED {fmt(live_rates[m])}/g
              </span>
            </div>
          ))}
          {schedule?.holidays_count > 0 && (
            <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <span className="text-[11px] text-[#444]">Upcoming holidays</span>
              <span className="text-xs font-bold text-yellow-500">{schedule.holidays_count}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Metal revenue breakdown ── */}
      {metals.length > 0 && (
        <div>
          <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] mb-3">Revenue by metal</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metals.map(m => {
              const total_rev = Number(stats.revenue_aed) || 1
              const pct = Math.round(Number(metal_revenue[m]) / total_rev * 100)
              return (
                <div key={m} className="rounded-xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: METAL_COLOR[m] || '#888' }} />
                    <span className="text-xs font-semibold capitalize" style={{ color: METAL_COLOR[m] || '#888' }}>{m}</span>
                    <span className="ml-auto text-[10px] text-[#444]">{pct}%</span>
                  </div>
                  <p className="text-base font-black tabular-nums text-white">
                    AED {fmt(metal_revenue[m])}
                  </p>
                  <p className="text-[10px] text-[#555] mt-0.5">{Number(metal_units[m]).toFixed(2)} g sold</p>
                  {/* progress bar */}
                  <div className="mt-2 h-1 rounded-full bg-[#1A1A1A] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: METAL_COLOR[m] || '#888' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Row 5: Top products ── */}
      {product_stats.length > 0 && (
        <div>
          <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] mb-3">Top products by revenue</p>
          <div className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            {product_stats.map((p, i) => (
              <div key={i}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                style={{ borderColor: 'rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-black text-[#444] w-5 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-[#555] capitalize">
                      {p.metal} · {p.orders} order{p.orders !== 1 ? 's' : ''} · {Number(p.grams).toFixed(2)} g
                    </p>
                  </div>
                </div>
                <p className="text-xs font-black tabular-nums text-emerald-400 shrink-0 pl-4">
                  AED {fmt(p.revenue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 6: Recent orders ── */}
      <div>
        <p className="text-[9px] tracking-[0.14em] uppercase text-[#555] mb-3">Recent orders</p>
        {recent_orders.length === 0 ? (
          <div className="text-center py-16 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <FileText size={28} className="mx-auto text-[#333] mb-3" />
            <p className="text-sm text-[#444]">No orders yet</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid px-4 py-2"
              style={{ gridTemplateColumns: '4rem 1fr 1fr 5rem 5.5rem 5rem', background: 'rgba(0,0,0,0.3)' }}>
              {['Type', 'Customer', 'Product', 'Grams', 'AED', 'Status'].map(h => (
                <span key={h} className="text-[9px] tracking-[0.12em] uppercase text-[#444]">{h}</span>
              ))}
            </div>
            {recent_orders.map((o, i) => {
              const s = STATUS_STYLE[o.status] || { label: o.status, cls: 'text-[#666]' }
              const isSell = o.type === 'SELL'
              return (
                <div key={`${o.type}-${o.id}`}
                  className="grid items-center px-4 py-3 border-t"
                  style={{
                    gridTemplateColumns: '4rem 1fr 1fr 5rem 5.5rem 5rem',
                    borderColor: 'rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  }}>
                  <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm w-fit ${isSell ? 'text-red-400 bg-red-400/10' : 'text-emerald-400 bg-emerald-400/10'}`}>
                    {o.type || 'BUY'}
                  </span>
                  <span className="text-xs text-white truncate pr-2">{o.customer}</span>
                  <span className="text-xs text-[#888] truncate pr-2">{o.product}</span>
                  <span className="text-xs tabular-nums text-[#888]">{Number(o.qty_grams).toFixed(2)} g</span>
                  <span className={`text-xs tabular-nums font-semibold ${isSell ? 'text-red-400' : 'text-white'}`}>
                    {isSell ? '−' : ''}{Number(o.total_aed).toLocaleString('en', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}


/* ── Schedule & Hours ───────────────────────────────────────────── */
function ScheduleSection() {
  const { authFetch } = useAuth()
  const [openingTime, setOpeningTime] = useState('')
  const [closingTime, setClosingTime] = useState('')
  const [holidays, setHolidays] = useState([])
  const [isOpenNow, setIsOpenNow] = useState(true)
  const [customDate, setCustomDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

  const fmtDate = (iso) => {
    const d = new Date(iso + 'T12:00:00')
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
    if (iso === today) return `Today · ${d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}`
    if (iso === tomorrow) return `Tomorrow · ${d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}`
    return d.toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  useEffect(() => {
    authFetch(`${API_BASE}/vendor/schedule/`)
      .then((r) => r.json())
      .then((d) => {
        setOpeningTime(d.opening_time || '')
        setClosingTime(d.closing_time || '')
        setHolidays(d.holiday_dates || [])
        setIsOpenNow(d.is_open_now !== false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authFetch])

  const save = async () => {
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await authFetch(`${API_BASE}/vendor/schedule/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_time: openingTime || null,
          closing_time: closingTime || null,
          holiday_dates: holidays,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setIsOpenNow(d.is_open_now !== false)
        setMsg({ text: 'Schedule saved successfully.', type: 'ok' })
      } else {
        setMsg({ text: d.detail || 'Save failed.', type: 'err' })
      }
    } catch {
      setMsg({ text: 'Network error.', type: 'err' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg({ text: '', type: 'ok' }), 3500)
    }
  }

  const addHoliday = (iso) => {
    if (iso && !holidays.includes(iso))
      setHolidays((prev) => [...prev, iso].sort())
  }

  const removeHoliday = (iso) => setHolidays((prev) => prev.filter((d) => d !== iso))

  const clearAllHolidays = () => setHolidays([])

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(168,169,173,0.15)',
    color: '#F5F0E8',
    outline: 'none',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 border-2 border-[#333] border-t-[#C9A84C] rounded-full animate-spin" />
    </div>
  )

  const hasHours = openingTime && closingTime

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Current status */}
      <div className="flex items-center gap-4 p-5 rounded-2xl"
        style={{
          background: isOpenNow ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${isOpenNow ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: isOpenNow ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)' }}>
          <div className={`w-3 h-3 rounded-full ${isOpenNow ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
        </div>
        <div>
          <div className={`text-base font-black ${isOpenNow ? 'text-emerald-400' : 'text-red-400'}`}>
            {isOpenNow ? 'Shop is Open' : 'Shop is Closed'}
          </div>
          <div className="text-[11px] text-[#555] mt-0.5">
            {!hasHours
              ? 'No hours set — shop shows as always open'
              : `Hours: ${openingTime} – ${closingTime}`}
            {holidays.includes(todayStr) && ' · Today is a holiday'}
          </div>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] tracking-widest uppercase font-bold px-3 py-1.5 rounded-full"
            style={{
              background: isOpenNow ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
              color: isOpenNow ? '#10b981' : '#ef4444',
            }}>
            {isOpenNow ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Business hours */}
      <div className="rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#C9A84C]" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#888]">Business Hours</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[#555] mb-2 block">Opening Time</label>
            <input type="time" value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle} />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[#555] mb-2 block">Closing Time</label>
            <input type="time" value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-[#444]"
          style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.08)' }}>
          <Info size={11} className="text-[#C9A84C] flex-shrink-0" />
          Leave both empty to show your shop as always open. Times are in Asia/Dubai (GST+4) timezone.
        </div>
      </div>

      {/* Holiday management */}
      <div className="rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[#C9A84C]" />
            <h3 className="text-xs font-bold tracking-widest uppercase text-[#888]">Holiday Dates</h3>
            {holidays.length > 0 && (
              <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {holidays.length} day{holidays.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {holidays.length > 0 && (
            <button onClick={clearAllHolidays}
              className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-400 transition-colors">
              Clear all
            </button>
          )}
        </div>

        {/* Quick add */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Today', date: todayStr },
            { label: 'Tomorrow', date: tomorrowStr },
          ].map(({ label, date }) => (
            <button key={date}
              onClick={() => addHoliday(date)}
              disabled={holidays.includes(date)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: holidays.includes(date) ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${holidays.includes(date) ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: holidays.includes(date) ? '#ef4444' : '#888',
              }}>
              <Calendar size={10} />
              {holidays.includes(date) ? `✓ ${label}` : `Mark ${label}`}
            </button>
          ))}
        </div>

        {/* Custom date */}
        <div className="flex gap-2">
          <input type="date" value={customDate}
            min={todayStr}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={inputStyle} />
          <button
            onClick={() => { addHoliday(customDate); setCustomDate('') }}
            disabled={!customDate || holidays.includes(customDate)}
            className="px-4 py-2.5 rounded-xl text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
            style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}>
            Add Date
          </button>
        </div>

        {/* Holiday list */}
        {holidays.length === 0 ? (
          <div className="text-center py-4 text-[11px] text-[#444]">
            No holidays set — your shop will follow business hours only.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {holidays.map((iso) => (
              <div key={iso} className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={{
                  background: iso === todayStr ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${iso === todayStr ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                <div className="flex items-center gap-3">
                  <Calendar size={12} style={{ color: iso === todayStr ? '#ef4444' : '#555' }} />
                  <span className="text-sm text-[#F5F0E8]">{fmtDate(iso)}</span>
                  {iso === todayStr && (
                    <span className="text-[9px] tracking-widest uppercase font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                      Active
                    </span>
                  )}
                </div>
                <button onClick={() => removeHoliday(iso)}
                  className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`px-4 py-3 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{
            background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
          {msg.type === 'ok' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
          {msg.text}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="btn-gold self-start px-6 py-3 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center gap-2 disabled:opacity-50">
        <Save size={13} />
        {saving ? 'Saving…' : 'Save Schedule'}
      </button>
    </div>
  )
}

/** Per-fineness sell (AED/g) + buyback; overrides spot for that fineness when set. */
function MetalPurityRatesEditor({
  keyName, label, color, symbol, dimmed, cfg, setCfg, purities, inputStyle,
  readOnlySpotSell, spotSourceNote, catalog,
}) {
  if (!cfg || typeof cfg !== 'object') return null
  const sk = GRAM_SELL[keyName]
  const bk = GRAM_BUY[keyName]
  const smap = (cfg[sk] && typeof cfg[sk] === 'object') ? cfg[sk] : {}
  const bmap = (cfg[bk] && typeof cfg[bk] === 'object') ? cfg[bk] : {}
  const productCount = catalog.filter((p) => p.metal === keyName).length
  const patch = (mapKey, pur, val) => {
    setCfg((p) => {
      const m = { ...(p[mapKey] && typeof p[mapKey] === 'object' ? p[mapKey] : {}) }
      if (val === '' || val == null) delete m[pur]
      else m[pur] = val
      return { ...p, [mapKey]: m }
    })
  }
  if (!purities || purities.length === 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
        <div className="text-[10px] uppercase" style={{ color }}>{label}</div>
        <p className="text-[10px] text-[#555] mt-2">Set fineness list above (gold/silver) or add a catalog product (platinum/palladium).</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: `${color}${dimmed ? '04' : '08'}`, border: `1px solid ${color}${dimmed ? '10' : '20'}`, opacity: dimmed ? 0.45 : 1 }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: dimmed ? '#444' : '#666' }}>{label}</div>
          <div className="text-xs font-mono font-bold" style={{ color }}>{symbol} · by fineness</div>
        </div>
        <div className="text-right">
          {productCount > 0
            ? <span className="text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm" style={{ background: `${color}15`, color }}>{productCount} product{productCount !== 1 ? 's' : ''}</span>
            : <span className="text-[9px] text-[#333]">No products</span>}
        </div>
      </div>
      {readOnlySpotSell && spotSourceNote && (
        <p className="text-[10px] text-[#666]">{spotSourceNote} You can still set explicit overrides per fineness below.</p>
      )}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
        {purities.map((pur) => {
          const sVal = smap[pur] ?? ''
          const bVal = bmap[pur] ?? ''
          return (
            <div key={pur} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="sm:col-span-2 text-[10px] font-mono font-bold" style={{ color }}>{pur}</div>
              <div className="sm:col-span-5">
                <label className="text-[9px] text-[#555] block">Sell / g</label>
                <input type="number" step="0.0001" min="0"
                  value={sVal}
                  onChange={(e) => patch(sk, pur, e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs"
                  style={{ ...inputStyle, color, border: `1px solid ${color}30` }}
                  placeholder="AED (optional)"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="text-[9px] text-[#555] block">Buyback / g</label>
                <input type="number" step="0.0001" min="0"
                  value={bVal}
                  onChange={(e) => patch(bk, pur, e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs"
                  style={{ ...inputStyle, color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                  placeholder="AED"
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="pt-1 space-y-2">
        <p className="text-[9px] text-[#555]">Fallback if a fineness row is left empty: home spot (gold/silver) or base rate below, then buyback = sell − deduction.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-[#555]">Base sell / g (fallback)</label>
            <input type="number" step="0.0001" min="0" readOnly={readOnlySpotSell}
              value={cfg[`${keyName}_rate`] ?? ''} onChange={(e) => setCfg((p) => ({ ...p, [`${keyName}_rate`]: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={inputStyle} />
          </div>
          <div>
            <label className="text-[9px] text-[#555]">Default deduction / g</label>
            <input type="number" step="0.0001" min="0"
              value={cfg[`${keyName}_buyback_deduction`] ?? ''} onChange={(e) => setCfg((p) => ({ ...p, [`${keyName}_buyback_deduction`]: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ ...inputStyle, color: '#ef4444' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_GOLD_PURITY_LIST = '24K, 22K, 21K, 18K, 999.9, 999, 916'
const DEFAULT_SILVER_PURITY_LIST = '999, 999.9, 925, 958'

function splitPurityInput(t) {
  return String(t || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
}

function puritiesForMetalInPricing(metal, cfg, catalog, goldPurityText, silverPurityText) {
  if (metal === 'gold') return splitPurityInput(goldPurityText)
  if (metal === 'silver') return splitPurityInput(silverPurityText)
  const fromCat = catalogPuritiesForMetal(catalog, metal)
  const mkey = metal === 'platinum' ? 'platinum_gram_rates_by_purity' : 'palladium_gram_rates_by_purity'
  const m = (cfg && cfg[mkey]) || {}
  const u = Array.from(new Set([...fromCat, ...Object.keys(m)])).filter(Boolean)
  if (u.length === 0) u.push('999.5')
  return u.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * Reference column for the pricing table: home spot (when linked) or base rate.
 * Read-only; same inputs drive effective_rate in the API as the legacy grid.
 */
function refRateForPricingRow(pricing, spotPreview, metal, purity) {
  if (!pricing) return null
  if (metal === 'gold') {
    if (pricing.use_home_spot_gold && spotPreview) {
      return previewSpotRatePerGram(spotPreview, 'gold', purity)
    }
    const v = parseFloat(pricing.gold_rate)
    return Number.isNaN(v) ? null : v
  }
  if (metal === 'silver') {
    if (pricing.use_home_spot_silver && spotPreview) {
      return previewSpotRatePerGram(spotPreview, 'silver', purity)
    }
    const v = parseFloat(pricing.silver_rate)
    return Number.isNaN(v) ? null : v
  }
  if (metal === 'platinum') {
    const v = parseFloat(pricing.platinum_rate)
    return Number.isNaN(v) ? null : v
  }
  if (metal === 'palladium') {
    const v = parseFloat(pricing.palladium_rate)
    return Number.isNaN(v) ? null : v
  }
  return null
}

/**
 * One live table: same gram maps and flags as MetalPurityRatesEditor, no API changes.
 * Effective sell + buyback match liveSellAedG / liveBuyAedG.
 */
function PricingLiveTable({
  cfg,
  setCfg,
  usedMetals,
  catalog,
  goldPurityText,
  silverPurityText,
  spotPreview,
  loadSpotPreview,
  inputStyle,
}) {
  const rows = useMemo(() => {
    const out = []
    for (const m of usedMetals) {
      const pur = puritiesForMetalInPricing(m.key, cfg, catalog, goldPurityText, silverPurityText)
      for (const p of pur) {
        out.push({
          key: `${m.key}::${p}`,
          metal: m.key,
          metalLabel: m.label,
          color: m.color,
          symbol: m.symbol,
          purity: p,
        })
      }
    }
    return out
  }, [usedMetals, cfg, catalog, goldPurityText, silverPurityText])

  const patchMap = (mapKey, pur, val) => {
    setCfg((p) => {
      const m = { ...(p[mapKey] && typeof p[mapKey] === 'object' ? p[mapKey] : {}) }
      if (val === '' || val == null) delete m[pur]
      else m[pur] = val
      return { ...p, [mapKey]: m }
    })
  }

  if (!rows.length) {
    return (
      <div className="px-4 py-6 rounded-xl text-xs text-[#555]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        Add catalog products to see metal rows, or set gold/silver fineness lists above.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8]">Live rate table (per fineness)</h3>
        <button
          type="button"
          onClick={loadSpotPreview}
          className="text-[10px] tracking-widest uppercase font-semibold px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}
        >
          Refresh ref. rates
        </button>
      </div>
      <p className="text-[10px] text-[#555] max-w-4xl">
        <strong className="text-[#666]">Ref (AED/g)</strong> is platform home spot (when gold/silver are linked) or your base
        sell rate. <strong className="text-[#666]">Override</strong> is optional; when empty, the effective sell uses spot
        or base + rules from your saved config. Buyback is per fineness, same as before.
      </p>
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(201,168,76,0.12)' }}>
        <table className="w-full min-w-[900px] text-left text-[11px]">
          <thead>
            <tr style={{ background: 'rgba(201,168,76,0.08)', color: '#888' }}
              className="uppercase tracking-wider text-[9px]">
              <th className="px-3 py-2.5 font-semibold">Metal</th>
              <th className="px-2 py-2.5 font-semibold">Purity</th>
              <th className="px-2 py-2.5 font-semibold">Ref (AED/g)</th>
              <th className="px-2 py-2.5 font-semibold">Override sell</th>
              <th className="px-2 py-2.5 font-semibold">vs ref %</th>
              <th className="px-2 py-2.5 font-semibold">Effective sell</th>
              <th className="px-2 py-2.5 font-semibold">Buyback / g</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sk = GRAM_SELL[row.metal]
              const bk = GRAM_BUY[row.metal]
              const smap = (sk && cfg[sk] && typeof cfg[sk] === 'object') ? cfg[sk] : {}
              const bmap = (bk && cfg[bk] && typeof cfg[bk] === 'object') ? cfg[bk] : {}
              const sVal = smap[row.purity] ?? ''
              const bVal = bmap[row.purity] ?? ''
              const form = { use_live_rate: true, metal: row.metal, purity: row.purity, manual_rate_per_gram: 0 }
              const eff = liveSellAedG(cfg, spotPreview, form)
              const refR = refRateForPricingRow(cfg, spotPreview, row.metal, row.purity)
              const vsRef = refR != null && refR > 0 && eff > 0
                ? ((eff - refR) / refR) * 100
                : null
              return (
                <tr key={row.key} className="border-t border-white/5" style={{ background: 'rgba(0,0,0,0.12)' }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: row.color || '#C9A84C' }}>{row.metalLabel}</td>
                  <td className="px-2 py-2 font-mono text-[#F5F0E8]">{row.purity}</td>
                  <td className="px-2 py-2 font-mono text-[#999]">
                    {refR != null && !Number.isNaN(refR) ? refR.toFixed(4) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={sVal}
                      onChange={(e) => patchMap(sk, row.purity, e.target.value)}
                      className="w-full min-w-[100px] px-2 py-1 rounded-md text-xs font-mono"
                      style={{ ...inputStyle, color: row.color }}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-[#666]">
                    {vsRef != null && !Number.isNaN(vsRef) ? `${vsRef.toFixed(2)}%` : '—'}
                  </td>
                  <td className="px-2 py-2 font-mono text-[#C9A84C] font-bold">
                    {eff > 0 ? eff.toFixed(4) : '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={bVal}
                      onChange={(e) => patchMap(bk, row.purity, e.target.value)}
                      className="w-full min-w-[100px] px-2 py-1 rounded-md text-xs font-mono"
                      style={{ ...inputStyle, color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                      placeholder="AED"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-[#444]">
        When buyback is empty, the platform uses the same sell-minus-deduction rule as before. Row overrides are
        <strong className="text-[#666]"> not</strong> saved until you click &quot;Save all rates&quot;.
      </p>
      {usedMetals.length > 0 && (
        <div className="mt-1 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 className="text-[10px] tracking-widest uppercase text-[#666] mb-3">Base fallbacks (if fineness is empty in the table)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {usedMetals.map((m) => {
              const roG = m.key === 'gold' && cfg.use_home_spot_gold
              const roS = m.key === 'silver' && cfg.use_home_spot_silver
              return (
                <div key={m.key} className="p-3 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] font-bold mb-2" style={{ color: m.color }}>{m.label}</div>
                  <label className="text-[9px] text-[#555]">Base sell / g</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    readOnly={roG || roS}
                    value={cfg[`${m.key}_rate`] ?? ''}
                    onChange={(e) => setCfg((p) => ({ ...p, [`${m.key}_rate`]: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs mt-0.5 mb-2"
                    style={inputStyle}
                  />
                  <label className="text-[9px] text-[#555]">Default deduction / g</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={cfg[`${m.key}_buyback_deduction`] ?? ''}
                    onChange={(e) => setCfg((p) => ({ ...p, [`${m.key}_buyback_deduction`]: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg text-xs mt-0.5"
                    style={{ ...inputStyle, color: '#ef4444' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PricingSection({ catalog, onRatesUpdated }) {
  const { getToken } = useAuth()
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [applyingSpot, setApplyingSpot] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'ok' })
  const [feedOpen, setFeedOpen] = useState(false)
  const [goldPurityText, setGoldPurityText] = useState(DEFAULT_GOLD_PURITY_LIST)
  const [silverPurityText, setSilverPurityText] = useState(DEFAULT_SILVER_PURITY_LIST)
  const [spotPreview, setSpotPreview] = useState(null)

  const usedMetals = useMemo(() => {
    const s = new Set(catalog.map((p) => p.metal))
    return METALS.filter((m) => s.has(m.key))
  }, [catalog])

  const catalogGoldPurities = useMemo(() => catalogPuritiesForMetal(catalog, 'gold'), [catalog])
  const catalogSilverPurities = useMemo(() => catalogPuritiesForMetal(catalog, 'silver'), [catalog])

  const loadSpotPreview = () => {
    fetch(API_SPOT_PRICES, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSpotPreview(data) })
      .catch(() => {})
  }

  useEffect(() => {
    loadSpotPreview()
    const t = setInterval(() => { loadSpotPreview() }, 90000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    const r = await fetch(`${API_BASE}/vendor/pricing/`, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (r.ok) {
      const d = await r.json()
      setCfg(d)
      setGoldPurityText(
        d.gold_purity_options && d.gold_purity_options.length
          ? d.gold_purity_options.join(', ')
          : DEFAULT_GOLD_PURITY_LIST
      )
      setSilverPurityText(
        d.silver_purity_options && d.silver_purity_options.length
          ? d.silver_purity_options.join(', ')
          : DEFAULT_SILVER_PURITY_LIST
      )
    }
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setCfg((p) => ({ ...p, [k]: e.target.value }))
  const setVal = (k, v) => setCfg((p) => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    setMsg({ text: '', type: 'ok' })
    const payload = {
      ...cfg,
      gold_purity_options: splitPurityInput(goldPurityText),
      silver_purity_options: splitPurityInput(silverPurityText),
    }
    try {
      const r = await fetch(`${API_BASE}/vendor/pricing/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (r.ok) {
        setCfg(d)
        onRatesUpdated?.({
          gold: d.gold_rate, silver: d.silver_rate,
          platinum: d.platinum_rate, palladium: d.palladium_rate,
        })
        broadcastPricesRefresh({ source: 'vendor-pricing-save' })
        setMsg({ text: 'Rates saved. All products using live rate are updated.', type: 'ok' })
      } else {
        setMsg({ text: d.detail || 'Save failed.', type: 'err' })
      }
    } catch { setMsg({ text: 'Network error.', type: 'err' }) }
    finally { setSaving(false) }
  }

  const fetchFeed = async () => {
    setFetching(true)
    setMsg({ text: '', type: 'ok' })
    try {
      const r = await fetch(`${API_BASE}/vendor/pricing/fetch-feed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ feed_url: cfg?.feed_url }),
      })
      const d = await r.json()
      if (r.ok) {
        setCfg(d.pricing)
        if (d.pricing.gold_purity_options?.length) {
          setGoldPurityText(d.pricing.gold_purity_options.join(', '))
        }
        if (d.pricing.silver_purity_options?.length) {
          setSilverPurityText(d.pricing.silver_purity_options.join(', '))
        }
        onRatesUpdated?.({
          gold: d.pricing.gold_rate, silver: d.pricing.silver_rate,
          platinum: d.pricing.platinum_rate, palladium: d.pricing.palladium_rate,
        })
        broadcastPricesRefresh({ source: 'vendor-pricing-feed' })
        setMsg({ text: d.detail, type: 'ok' })
      } else {
        setMsg({ text: d.detail || 'Feed fetch failed.', type: 'err' })
      }
    } catch { setMsg({ text: 'Network error.', type: 'err' }) }
    finally { setFetching(false) }
  }

  const syncFinenessFromCatalog = () => {
    setMsg({ text: '', type: 'ok' })
    if (catalogGoldPurities.length) {
      setGoldPurityText(catalogGoldPurities.join(', '))
    }
    if (catalogSilverPurities.length) {
      setSilverPurityText(catalogSilverPurities.join(', '))
    }
    if (!catalogGoldPurities.length && !catalogSilverPurities.length) {
      setMsg({ text: 'No gold or silver purities found in catalog yet.', type: 'err' })
      return
    }
    setMsg({ text: 'Fineness fields updated from catalog. Click Save All Rates to persist.', type: 'ok' })
  }

  const applyHomepageSpotFeed = async () => {
    if (!cfg) return
    setApplyingSpot(true)
    setMsg({ text: '', type: 'ok' })
    const hasGold = usedMetals.some((m) => m.key === 'gold')
    const hasSilver = usedMetals.some((m) => m.key === 'silver')
    const goldOpts = hasGold && catalogGoldPurities.length
      ? catalogGoldPurities
      : splitPurityInput(goldPurityText)
    const silverOpts = hasSilver && catalogSilverPurities.length
      ? catalogSilverPurities
      : splitPurityInput(silverPurityText)
    const nextCfg = {
      ...cfg,
      use_home_spot_gold: hasGold,
      use_home_spot_silver: hasSilver,
    }
    const payload = {
      ...nextCfg,
      gold_purity_options: goldOpts,
      silver_purity_options: silverOpts,
    }
    try {
      const r = await fetch(`${API_BASE}/vendor/pricing/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (r.ok) {
        setCfg(d)
        setGoldPurityText(
          d.gold_purity_options && d.gold_purity_options.length
            ? d.gold_purity_options.join(', ')
            : goldPurityText
        )
        setSilverPurityText(
          d.silver_purity_options && d.silver_purity_options.length
            ? d.silver_purity_options.join(', ')
            : silverPurityText
        )
        onRatesUpdated?.({
          gold: d.gold_rate, silver: d.silver_rate,
          platinum: d.platinum_rate, palladium: d.palladium_rate,
        })
        broadcastPricesRefresh({ source: 'vendor-pricing-home-spot' })
        setMsg({ text: 'Homepage spot flags and catalog purities saved.', type: 'ok' })
        loadSpotPreview()
      } else {
        setMsg({ text: d.detail || 'Could not apply homepage spot settings.', type: 'err' })
      }
    } catch {
      setMsg({ text: 'Network error.', type: 'err' })
    } finally {
      setApplyingSpot(false)
    }
  }

  if (!cfg) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-[#333] border-t-[#C9A84C] rounded-full animate-spin" /></div>

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,169,173,0.15)', color: '#F5F0E8', outline: 'none' }

  const showPricingGoldPreview = catalogGoldPurities.length > 0
  const showPricingSilverPreview = catalogSilverPurities.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8] mb-1">Sell &amp; buyback (per fineness)</h2>
        <p className="text-xs text-[#555] max-w-2xl">
          Use the <strong className="text-[#888]">live table</strong> for quick edits (same data as before). Fineness
          lists and gold/silver &quot;link to platform spot&quot; toggles are below; external feed and save behaviour are unchanged.
        </p>
      </div>

      <div className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)' }}>
        <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8]">Global spot (home page) &amp; purities</h3>
        <p className="text-[11px] text-[#555] max-w-2xl">
          Tie <strong className="text-[#888]">gold</strong> and <strong className="text-[#888]">silver</strong> live rates to the public home page ticker feed.
          Fineness lists should match what you sell — pull them from the catalog, then use <strong className="text-[#888]">Apply homepage spot</strong> to turn on flags,
          sync purities, and save in one step. Manual toggles below still work; always click <strong className="text-[#888]">Save All Rates</strong> if you only change switches or text.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={syncFinenessFromCatalog}
            className="text-[10px] tracking-widest uppercase font-bold px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}>
            Sync fineness from catalog
          </button>
          <button type="button" onClick={applyHomepageSpotFeed} disabled={applyingSpot || usedMetals.length === 0}
            className="text-[10px] tracking-widest uppercase font-bold px-3 py-2 rounded-xl disabled:opacity-45"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
            {applyingSpot ? 'Applying…' : 'Apply homepage spot (save)'}
          </button>
          <button type="button" onClick={loadSpotPreview}
            className="text-[10px] tracking-widest uppercase font-semibold px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888' }}>
            Refresh spot preview
          </button>
        </div>
        {(showPricingGoldPreview || showPricingSilverPreview) && (
          <div className="rounded-xl p-3 text-[10px]" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[#555] mb-2">
              Public ticker (AED/g) by fineness in your catalog — figures may include display margin vs backend settlement.
            </p>
            {!spotPreview ? (
              <span className="text-[#444]">Loading spot…</span>
            ) : (
              <div className="flex flex-wrap gap-4">
                {showPricingGoldPreview && (
                  <div className="rounded-lg px-3 py-2 min-w-[140px]" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
                    <div className="font-bold text-[#C9A84C] mb-1 uppercase tracking-wider">Gold</div>
                    {catalogGoldPurities.map((pur) => {
                      const v = previewSpotRatePerGram(spotPreview, 'gold', pur)
                      return (
                        <div key={pur} className="flex justify-between gap-4 text-[#888]">
                          <span>{pur}</span>
                          <span className="font-mono text-[#F5F0E8]">{v != null && !Number.isNaN(v) ? v.toFixed(4) : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {showPricingSilverPreview && (
                  <div className="rounded-lg px-3 py-2 min-w-[140px]" style={{ background: 'rgba(168,169,173,0.06)', border: '1px solid rgba(168,169,173,0.12)' }}>
                    <div className="font-bold text-[#A8A9AD] mb-1 uppercase tracking-wider">Silver</div>
                    {catalogSilverPurities.map((pur) => {
                      const v = previewSpotRatePerGram(spotPreview, 'silver', pur)
                      return (
                        <div key={pur} className="flex justify-between gap-4 text-[#888]">
                          <span>{pur}</span>
                          <span className="font-mono text-[#F5F0E8]">{v != null && !Number.isNaN(v) ? v.toFixed(4) : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setVal('use_home_spot_gold', !cfg.use_home_spot_gold)}
              className="w-10 h-5 rounded-full relative flex-shrink-0 transition-colors"
              style={{ background: cfg.use_home_spot_gold ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
                style={{ transform: cfg.use_home_spot_gold ? 'translateX(20px)' : 'translateX(2px)' }} />
            </button>
            <span className="text-xs text-[#888]">Use home page <strong className="text-[#C9A84C]">gold</strong> spot (24K reference tier)</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setVal('use_home_spot_silver', !cfg.use_home_spot_silver)}
              className="w-10 h-5 rounded-full relative flex-shrink-0 transition-colors"
              style={{ background: cfg.use_home_spot_silver ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
                style={{ transform: cfg.use_home_spot_silver ? 'translateX(20px)' : 'translateX(2px)' }} />
            </button>
            <span className="text-xs text-[#888]">Use home page <strong className="text-[#A8A9AD]">silver</strong> spot (999 reference tier)</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Gold — karats &amp; fineness (catalog)</label>
            {catalogGoldPurities.length > 0 && (
              <p className="text-[10px] text-[#666] mb-1">In catalog now: {catalogGoldPurities.join(', ')}</p>
            )}
            <textarea value={goldPurityText} onChange={(e) => setGoldPurityText(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F0E8', outline: 'none' }}
              placeholder="e.g. 24K, 22K, 21K, 18K, 999.9" />
            <p className="text-[10px] text-[#444] mt-1">Comma or newline separated. Keep aligned with product purities so live-rate tiers match.</p>
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Silver — fineness (catalog)</label>
            {catalogSilverPurities.length > 0 && (
              <p className="text-[10px] text-[#666] mb-1">In catalog now: {catalogSilverPurities.join(', ')}</p>
            )}
            <textarea value={silverPurityText} onChange={(e) => setSilverPurityText(e.target.value)} rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#F5F0E8', outline: 'none' }}
              placeholder="e.g. 999, 925, 999.9" />
            <p className="text-[10px] text-[#444] mt-1">Comma or newline separated. Keep aligned with product purities so live-rate tiers match.</p>
          </div>
        </div>
      </div>

      {msg.text && (
        <div className={`px-4 py-3 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
          {msg.type === 'ok' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {msg.text}
        </div>
      )}

      {usedMetals.length === 0 && (
        <div className="px-4 py-3 rounded-xl text-xs text-[#555] flex items-center gap-2"
          style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.08)' }}>
          <Info size={12} className="text-[#C9A84C]" />
          Add products in Catalog first — their metal types will be highlighted here.
        </div>
      )}

      <PricingLiveTable
        cfg={cfg}
        setCfg={setCfg}
        usedMetals={usedMetals}
        catalog={catalog}
        goldPurityText={goldPurityText}
        silverPurityText={silverPurityText}
        spotPreview={spotPreview}
        loadSpotPreview={loadSpotPreview}
        inputStyle={inputStyle}
      />

      <div className="text-[11px] text-[#444] flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.08)' }}>
        <Info size={12} className="text-[#C9A84C] flex-shrink-0" />
        Last saved: {cfg.updated_at || '—'}.
        {cfg.feed_last_fetched && <span>&nbsp;Last feed sync: {cfg.feed_last_fetched}.</span>}
      </div>

      <button onClick={save} disabled={saving}
        className="btn-gold self-start px-6 py-3 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center gap-2 disabled:opacity-50">
        <Save size={13} /> {saving ? 'Saving…' : 'Save All Rates'}
      </button>

      {/* External price feed */}
      <div className="rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setFeedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
          style={{ background: 'rgba(255,255,255,0.02)', borderRadius: feedOpen ? '1rem 1rem 0 0' : '1rem' }}>
          <div className="flex items-center gap-3">
            <Link2 size={15} className="text-[#C9A84C]" />
            <div>
              <div className="text-sm font-bold text-[#F5F0E8]">External Price Feed API</div>
              <div className="text-[11px] text-[#555] mt-0.5">Auto-sync sell rates from your own pricing system</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {cfg.feed_enabled && (
              <span className="text-[9px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Live</span>
            )}
            <ChevronDown size={14} className={`text-[#555] transition-transform ${feedOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {feedOpen && (
          <div className="px-6 pb-6 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-3 pt-4">
              <button type="button" onClick={() => setVal('feed_enabled', !cfg.feed_enabled)}
                className="w-10 h-5 rounded-full relative flex-shrink-0 transition-colors"
                style={{ background: cfg.feed_enabled ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
                <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
                  style={{ transform: cfg.feed_enabled ? 'translateX(20px)' : 'translateX(2px)' }} />
              </button>
              <span className="text-xs text-[#888]">Enable automatic sell rate sync (does not sync buyback deductions)</span>
            </div>

            <div>
              <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Feed URL</label>
              <input value={cfg.feed_url || ''} onChange={set('feed_url')} placeholder="https://yourapp.com/api/metal-prices"
                className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Auth Header</label>
                <input value={cfg.feed_auth_header || ''} onChange={set('feed_auth_header')} placeholder="Authorization"
                  className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Header Value</label>
                <input value={cfg.feed_auth_value || ''} onChange={set('feed_auth_value')} placeholder="Bearer <token>"
                  className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-widest uppercase text-[#555] mb-2">JSON Field Mapping (dot notation supported)</div>
              <div className="grid grid-cols-2 gap-3">
                {METALS.map(({ key, label, color }) => (
                  <div key={key}>
                    <label className="text-[10px] mb-1.5 block" style={{ color }}>{label} field path</label>
                    <input value={cfg[`feed_${key}_field`] || ''} onChange={set(`feed_${key}_field`)}
                      placeholder={`e.g. rates.${key}`}
                      className="w-full px-3 py-2.5 rounded-xl text-xs" style={inputStyle} />
                  </div>
                ))}
              </div>
            </div>
            {cfg.feed_last_error && (
              <div className="px-3 py-2.5 rounded-xl text-xs text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                Last error: {cfg.feed_last_error}
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                style={{ background: 'rgba(168,169,173,0.08)', border: '1px solid rgba(168,169,173,0.2)', color: '#D4D5D9' }}>
                <Save size={12} /> {saving ? 'Saving…' : 'Save Config'}
              </button>
              <button onClick={fetchFeed} disabled={fetching || !cfg.feed_url}
                className="btn-gold flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50">
                <RefreshCcw size={12} className={fetching ? 'animate-spin' : ''} />
                {fetching ? 'Fetching…' : 'Fetch & Sync Now'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const REQUIRED_VENDOR_DOCS = [
  { doc_type: 'trade_license',         label: 'Trade License',                   hint: 'Valid trade license issued by the relevant authority' },
  { doc_type: 'company_registration',  label: 'Company Registration Certificate', hint: 'Official certificate of company incorporation' },
  { doc_type: 'owner_id',              label: 'Owner / Director ID',             hint: 'Passport or national ID of the primary owner/director' },
  { doc_type: 'bank_proof',            label: 'Bank Account Proof',              hint: 'Bank letter or statement showing account details' },
]

const DOC_STATUS_STYLE = {
  not_uploaded: { color: '#555',     label: 'Not Uploaded',  Icon: Upload },
  pending:      { color: '#f59e0b',  label: 'Under Review',  Icon: Clock },
  verified:     { color: '#10b981',  label: 'Verified',      Icon: CheckCircle },
  rejected:     { color: '#ef4444',  label: 'Rejected',      Icon: XCircle },
}

const API = API_BASE
const VENDOR_INTRO_MAX = 2000

function VendorLogoSection() {
  const { getToken, refreshUser, authFetch } = useAuth()
  const [logoUrl, setLogoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await authFetch(`${API}/me/`)
        if (cancelled || !r.ok) return
        const d = await r.json()
        if (!cancelled) setLogoUrl(d.vendor_logo_url ? catalogImageUrl(d.vendor_logo_url) : null)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authFetch])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const v = await validateCatalogImageFile(f)
    if (!v.ok) {
      setMsg({ type: 'err', text: v.error || 'Invalid image.' })
      return
    }
    setUploading(true)
    setMsg(null)
    const fd = new FormData()
    fd.append('logo', f, f.name || 'logo.jpg')
    try {
      const token = getToken()
      const r = await fetch(`${API}/vendor/logo/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const d = await r.json()
      if (r.ok) {
        setLogoUrl(catalogImageUrl(d.vendor_logo_url))
        setMsg({ type: 'ok', text: 'Logo saved. It appears on the verified vendors page.' })
        refreshUser()
      } else {
        setMsg({ type: 'err', text: d.detail || 'Upload failed.' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    setUploading(true)
    setMsg(null)
    try {
      const token = getToken()
      const r = await fetch(`${API}/vendor/logo/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        setLogoUrl(null)
        setMsg({ type: 'ok', text: 'Logo removed.' })
        refreshUser()
      } else {
        const d = await r.json().catch(() => ({}))
        setMsg({ type: 'err', text: d.detail || 'Could not remove logo.' })
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-6 mb-6"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-2 flex items-center gap-2">
        <ImageIcon size={13} className="text-[#C9A84C]" /> Company logo
      </h3>
      <p className="text-[11px] text-[#555] mb-4 leading-relaxed">
        Shown on the public <span className="text-[#888]">/vendors</span> page next to your company name. Use a square
        image if possible. Same rules as catalog: JPG, PNG, or WebP, max 5MB.
      </p>
      {loading ? (
        <p className="text-xs text-[#555]">Loading…</p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(201,168,76,0.2)' }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Company logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] text-[#444] text-center px-1">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFile}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold"
                style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C' }}
              >
                {uploading ? '…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={remove}
                  className="px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold text-[#888]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Remove
                </button>
              )}
            </div>
            {msg && (
              <div
                className={`text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VendorPublicIntroSection() {
  const { authFetch, refreshUser } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await authFetch(`${API}/me/`)
        if (cancelled || !r.ok) return
        const d = await r.json()
        if (!cancelled) setText((d.vendor_description != null) ? String(d.vendor_description) : '')
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authFetch])

  const handleSave = async (e) => {
    e.preventDefault()
    if (text.length > VENDOR_INTRO_MAX) {
      setMsg({ type: 'error', text: `Please keep the intro to ${VENDOR_INTRO_MAX} characters or less.` })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const r = await authFetch(`${API}/profile/update/`, {
        method: 'PATCH',
        body: JSON.stringify({ vendor_description: text }),
      })
      const d = await r.json()
      if (r.ok) {
        setMsg({ type: 'ok', text: 'Public intro saved. It is shown to buyers on the verified vendors page.' })
        refreshUser()
      } else {
        setMsg({ type: 'error', text: d.detail || 'Could not save your intro.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-6 mb-6"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-xs font-bold tracking-widest uppercase text-[#F5F0E8] mb-2 flex items-center gap-2">
        <FileText size={13} className="text-[#C9A84C]" /> Public vendor intro
      </h3>
      <p className="text-[11px] text-[#555] mb-4 leading-relaxed">
        Short description of your business for the marketing site. Shown on{' '}
        <span className="text-[#888]">/vendors</span> for KYB-verified partners along with your company name and region.
      </p>
      {loading ? (
        <p className="text-xs text-[#555]">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={VENDOR_INTRO_MAX}
            rows={5}
            placeholder="e.g. DMCC-licensed gold and silver; LBMA good delivery; walk-in and online since 2010."
            className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8] resize-y min-h-[120px]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none' }}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] text-[#444]">{text.length} / {VENDOR_INTRO_MAX}</span>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold py-2.5 px-5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save intro'}
            </button>
          </div>
          {msg && (
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${
                msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
              }`}
              style={{
                background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${
                  msg.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
                }`,
              }}
            >
              {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />} {msg.text}
            </div>
          )}
        </form>
      )}
    </div>
  )
}

function VendorChangePasswordSection() {
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
        <p className="text-[11px] text-[#555] mt-4 leading-relaxed">
          If you are locked out, use <strong className="text-[#888]">Forgot password</strong> on the sign-in page — you may
          receive an email with a reset link, or the team will assist.
        </p>
      </div>
    </div>
  )
}

function KYBDocumentUploader() {
  const { getToken, refreshUser } = useAuth()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">KYB Documents</h2>
          <p className="text-[11px] text-[#555] mt-0.5">
            Upload required business verification documents. Once all documents are reviewed and approved by Cridora compliance, your KYB will be verified.
          </p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-xl text-xs text-emerald-400 flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle size={13} /> {msg}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {REQUIRED_VENDOR_DOCS.map(({ doc_type, label, hint }) => {
          const doc = getDoc(doc_type)
          const st = DOC_STATUS_STYLE[doc?.status || 'not_uploaded']
          const { Icon } = st
          const isUploading = uploading[doc_type]
          return (
            <div key={doc_type} className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${doc?.status === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${st.color}15` }}>
                    <Icon size={14} style={{ color: st.color }} />
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
                  {doc?.file_url && doc?.id != null && (
                    <button type="button"
                      onClick={() => openAuthDocument(doc.id, getToken)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                      style={{ background: 'rgba(168,169,173,0.08)', border: '1px solid rgba(168,169,173,0.2)', color: '#A8A9AD' }}>
                      <ExternalLink size={10} /> View
                    </button>
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
                      : { background: 'rgba(168,169,173,0.08)', border: '1px solid rgba(168,169,173,0.2)', color: '#D4D5D9' }}>
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
        Accepted formats: PDF, JPG, PNG · Max 10 MB per file. Documents are reviewed within 3–5 business days.
      </p>
    </div>
  )
}

function StatCard({ label, value, sub, color = '#C9A84C', icon: Icon }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
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

function OrderTimer({ seconds, max = 60 }) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (remaining <= 0) return
    const t = setInterval(() => setRemaining((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [remaining])
  const pct = (remaining / max) * 100
  const urgent = remaining <= Math.max(10, Math.floor(max * 0.2))
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none"
            stroke={urgent ? '#ef4444' : '#C9A84C'} strokeWidth="3"
            strokeDasharray={75.4} strokeDashoffset={75.4 * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <Timer size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ color: urgent ? '#ef4444' : '#C9A84C' }} />
      </div>
      <span className="text-sm font-mono font-bold" style={{ color: urgent ? '#ef4444' : '#C9A84C' }}>
        {remaining}s
      </span>
    </div>
  )
}

const EMPTY_PRODUCT = {
  name: '', metal: 'gold', weight: '', purity: '999.9',
  use_live_rate: true, manual_rate_per_gram: '', buyback_per_gram: '',
  packaging_fee: 0, storage_fee: 0, insurance_fee: 0,
  vat_pct: 5, vat_inclusive: false,
  in_stock: true, visible: true, stock_qty: 0,
}

function calcFinalPrice(form, vendorPricing, liveDeductions, spotPreview) {
  const weight = parseFloat(form.weight) || 0
  const rate = form.use_live_rate
    ? liveSellAedG(vendorPricing, spotPreview, form)
    : (parseFloat(form.manual_rate_per_gram) || 0)
  const metalCost = rate * weight
  const fees = (parseFloat(form.packaging_fee) || 0)
    + (parseFloat(form.storage_fee) || 0)
    + (parseFloat(form.insurance_fee) || 0)
  const subtotal = metalCost + fees
  const vatPct = parseFloat(form.vat_pct) || 0
  const finalPrice = form.vat_inclusive ? subtotal : subtotal * (1 + vatPct / 100)
  const vatAmount = form.vat_inclusive ? 0 : subtotal * vatPct / 100
  const deduction = form.use_live_rate ? (parseFloat(liveDeductions?.[form.metal]) || 0) : 0
  const effectiveBuyback = form.use_live_rate
    ? liveBuyAedG(vendorPricing, form, rate, liveDeductions)
    : (parseFloat(form.buyback_per_gram) || 0)
  const metalRatePerGram = rate
  return { metalCost, fees, subtotal, vatAmount, finalPrice, metalRatePerGram, effectiveBuyback, deduction }
}

function CatalogModal({ item, onClose, onSave, vendorPricing, spotPreview, liveDeductions, goldPurityOptions, silverPurityOptions, getToken }) {
  const [form, setForm] = useState(item ? {
    ...EMPTY_PRODUCT, ...item,
    weight: item.weight ?? item.weight_grams ?? '',
    manual_rate_per_gram: item.manual_rate_per_gram ?? '',
  } : { ...EMPTY_PRODUCT })
  const [imageFile, setImageFile] = useState(null)
  const [stagingId, setStagingId] = useState(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [imagePreview, setImagePreview] = useState(item?.image_url ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const imgInputRef = useRef(null)
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const isNew = !item?.id
  const calc = calcFinalPrice(form, vendorPricing, liveDeductions, spotPreview)
  const gPurityOpts = goldPurityOptions?.length ? goldPurityOptions : ['24K', '22K', '21K', '18K', '999.9', '999', '916']
  const sPurityOpts = silverPurityOptions?.length ? silverPurityOptions : ['999', '999.9', '925', '958']

  useEffect(() => {
    if (form.metal === 'gold' && gPurityOpts.length > 0 && !gPurityOpts.includes(String(form.purity))) {
      setForm((p) => ({ ...p, purity: gPurityOpts[0] }))
    }
    if (form.metal === 'silver' && sPurityOpts.length > 0 && !sPurityOpts.includes(String(form.purity))) {
      setForm((p) => ({ ...p, purity: sPurityOpts[0] }))
    }
  }, [form.metal])

  const clearStaging = async (sid) => {
    if (!sid) return
    try {
      await fetch(`${API_BASE}/vendor/catalog/staging-image/${sid}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
    } catch { /* best-effort */ }
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const v = await validateCatalogImageFile(file)
    if (!v.ok) {
      setImageUploadError(v.error)
      e.target.value = ''
      return
    }
    setImageUploadError('')
    if (stagingId) {
      await clearStaging(stagingId)
      setStagingId(null)
    }
    if (imagePreview && String(imagePreview).startsWith('blob:')) {
      try { URL.revokeObjectURL(imagePreview) } catch { /* noop */ }
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleUploadToServer = async () => {
    if (!imageFile) return
    const v = await validateCatalogImageFile(imageFile)
    if (!v.ok) {
      setImageUploadError(v.error)
      setImageFile(null)
      if (imgInputRef.current) imgInputRef.current.value = ''
      return
    }
    const token = getToken?.()
    if (!token) {
      setImageUploadError('Not signed in — refresh the page and try again.')
      return
    }
    setImageUploading(true)
    setImageUploadError('')
    try {
      const fd = new FormData()
      fd.append('image', imageFile, imageFile.name || 'upload.jpg')
      const r = await fetch(`${API_BASE}/vendor/catalog/staging-image/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const raw = await r.text()
      let data = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = { detail: raw || `HTTP ${r.status}` }
      }
      if (!r.ok) {
        throw new Error(formatUploadErrorResponse(data, r.status))
      }
      if (imagePreview && String(imagePreview).startsWith('blob:')) {
        try { URL.revokeObjectURL(imagePreview) } catch { /* noop */ }
      }
      setStagingId(data.staging_id)
      setImagePreview(data.image_url)
      setImageFile(null)
    } catch (err) {
      setImageUploadError(err?.message || 'Upload failed')
    } finally {
      setImageUploading(false)
    }
  }

  const clearProductImage = async () => {
    if (stagingId) {
      await clearStaging(stagingId)
      setStagingId(null)
    }
    if (imagePreview && String(imagePreview).startsWith('blob:')) {
      try { URL.revokeObjectURL(imagePreview) } catch { /* noop */ }
    }
    setImageFile(null)
    setImagePreview(null)
    setImageUploadError('')
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,169,173,0.15)', color: '#F5F0E8', outline: 'none' }
  const Toggle = ({ field, label }) => (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => set(field, !form[field])}
        className="w-10 h-5 rounded-full relative flex-shrink-0 transition-colors"
        style={{ background: form[field] ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)' }}>
        <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform"
          style={{ transform: form[field] ? 'translateX(20px)' : 'translateX(2px)' }} />
      </button>
      <span className="text-xs text-[#888]">{label}</span>
    </div>
  )

  const handleSave = async () => {
    if (imageFile) {
      setSaveError('Click “Upload to server & verify” and confirm the image loads before saving, or remove the image.')
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      await onSave(form, null, stagingId)
    } catch (e) {
      setSaveError(e?.message || 'Unexpected error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{ background: '#0F0F0F', border: '1px solid rgba(168,169,173,0.2)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-7 py-5"
          style={{ background: '#0F0F0F', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-base font-bold text-[#F5F0E8]">{isNew ? 'Add New Product' : 'Edit Product'}</h3>
          <button onClick={onClose} className="text-[#555] hover:text-[#888]"><X size={16} /></button>
        </div>

        <div className="px-7 py-5 flex flex-col gap-5">
          {/* Basic info */}
          <div>
            <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3 font-semibold">Product Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Product Name</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. 24K Gold Bar 100g"
                  className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
              </div>
              {[
                { key: 'metal', label: 'Metal', type: 'select', opts: ['gold','silver','platinum','palladium'] },
                { key: 'weight', label: 'Weight (grams)', type: 'number', placeholder: '100' },
                { key: 'purity', label: 'Purity / karat', type: 'purity' },
                { key: 'stock_qty', label: 'Stock Qty', type: 'number', placeholder: '0' },
              ].map(({ key, label, type, opts, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
                  {type === 'select' ? (
                    <select value={form[key]} onChange={(e) => set(key, e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle}>
                      {opts.map((o) => <option key={o} value={o} style={{ background: '#111' }}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                    </select>
                  ) : type === 'purity' ? (
                    form.metal === 'gold' ? (
                      <select value={form.purity} onChange={(e) => set('purity', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle}>
                        {gPurityOpts.map((o) => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
                      </select>
                    ) : form.metal === 'silver' ? (
                      <select value={form.purity} onChange={(e) => set('purity', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle}>
                        {sPurityOpts.map((o) => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.purity} onChange={(e) => set('purity', e.target.value)} placeholder="e.g. 999.5"
                        className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
                    )
                  ) : (
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => {
                        const v = e.target.value
                        if (key === 'stock_qty') {
                          setForm((p) => ({
                            ...p,
                            stock_qty: v,
                            ...(Number(v) > 0 ? { in_stock: true } : {}),
                          }))
                        } else {
                          set(key, v)
                        }
                      }}
                      placeholder={placeholder}
                      className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Product image */}
          <div>
            <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3 font-semibold">Product Image</div>
            <div className="flex items-start gap-4">
              <div
                className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer group relative"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(168,169,173,0.2)' }}
                onClick={() => imgInputRef.current?.click()}>
                {imagePreview ? (
                  <>
                    <img src={resolveCatalogPreviewUrl(imagePreview)} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload size={18} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#444] group-hover:text-[#888] transition-colors">
                    <Upload size={20} />
                    <span className="text-[10px] tracking-widest uppercase">Upload</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center gap-2 min-w-0">
                <button type="button" onClick={() => imgInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-semibold"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}>
                  {imagePreview ? 'Change file' : 'Choose file'}
                </button>
                {imageFile && (
                  <button type="button" onClick={handleUploadToServer} disabled={imageUploading}
                    className="px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                    style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: '#C9A84C' }}>
                    {imageUploading ? 'Uploading…' : 'Upload to server & verify'}
                  </button>
                )}
                {imagePreview && (
                  <button type="button" onClick={clearProductImage}
                    className="px-4 py-2 rounded-xl text-xs tracking-widest uppercase font-semibold text-red-500"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    Remove
                  </button>
                )}
                {Boolean(stagingId) && !imageFile && (
                  <p className="text-[11px] text-emerald-500/90">Image stored on server — you can save the product when ready.</p>
                )}
                {imageUploadError && (
                  <p className="text-[11px] text-red-400">{imageUploadError}</p>
                )}
                <p className="text-[11px] text-[#444]">1) Choose file → 2) Upload to server &amp; check preview → 3) Save product. Max 5MB, JPG/PNG/WebP.</p>
              </div>
            </div>
            <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
          </div>

          {/* Metal rate */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3 font-semibold">Metal Rate</div>
            <Toggle field="use_live_rate" label="Use live rate from Pricing section (recommended)" />
            {form.use_live_rate ? (
              <div className="mt-3 px-4 py-3 rounded-xl text-sm font-bold text-[#C9A84C]"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>
                Current live rate (this purity): <span className="text-lg">AED {Number(calc.metalRatePerGram || 0).toFixed(4)}</span>/g
              </div>
            ) : (
              <div className="mt-3">
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Manual Rate (AED/g)</label>
                <input type="number" step="0.0001" value={form.manual_rate_per_gram} onChange={(e) => set('manual_rate_per_gram', e.target.value)}
                  placeholder="Enter rate per gram" className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
              </div>
            )}
            <div className="mt-3">
              {form.use_live_rate ? (
                <div>
                  <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Effective Buyback Rate</label>
                  <div className="px-4 py-3 rounded-xl text-sm font-bold text-emerald-400 flex items-center justify-between"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <span>AED {calc.effectiveBuyback.toFixed(4)}/g</span>
                    <span className="text-[10px] text-[#444] font-normal text-right max-w-[180px]">Pricing → per fineness</span>
                  </div>
                  <p className="text-[11px] text-[#444] mt-1.5">Managed in the Pricing section → Buyback Deduction.</p>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Buyback Rate (AED/g)</label>
                  <input type="number" step="0.0001" value={form.buyback_per_gram} onChange={(e) => set('buyback_per_gram', e.target.value)}
                    placeholder="Manual buyback price per gram" className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
                </div>
              )}
            </div>
          </div>

          {/* Fees */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3 font-semibold">Additional Fees (fixed per order)</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'packaging_fee', label: 'Packaging Fee (AED)' },
                { key: 'storage_fee', label: 'Storage Fee (AED)' },
                { key: 'insurance_fee', label: 'Insurance Fee (AED)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
                  <input type="number" step="0.01" min="0" value={form[key]} onChange={(e) => set(key, e.target.value)}
                    placeholder="0.00" className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">VAT Rate (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={form.vat_pct} onChange={(e) => set('vat_pct', e.target.value)}
                  placeholder="5.00" className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
              </div>
            </div>
            <div className="mt-3">
              <Toggle field="vat_inclusive" label="Price is VAT-inclusive (VAT already included in the displayed price)" />
            </div>
          </div>

          {/* Price breakdown preview */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <div className="text-[10px] tracking-widest uppercase text-[#555] mb-3 font-semibold flex items-center gap-2">
              <BarChart2 size={11} className="text-emerald-400" /> Live Price Preview
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {/* Metal rate row */}
              <div className="flex justify-between text-[#666]">
                <span>Metal rate/g</span>
                <span>AED {calc.metalRatePerGram.toFixed(4)}/g</span>
              </div>
              {/* Metal cost */}
              <div className="flex justify-between text-[#666]">
                <span>Metal cost ({form.weight || 0}g × AED {calc.metalRatePerGram.toFixed(4)})</span>
                <span>AED {calc.metalCost.toFixed(2)}</span>
              </div>
              {/* Per-product fees */}
              <div className="flex justify-between text-[#666]">
                <span>Per-product fees <span className="text-[9px] text-[#444]">(pkg + storage + insurance)</span></span>
                <span>AED {calc.fees.toFixed(2)}</span>
              </div>
              {/* Subtotal */}
              <div className="flex justify-between text-[#666]">
                <span>Subtotal</span>
                <span>AED {calc.subtotal.toFixed(2)}</span>
              </div>
              {/* VAT on subtotal */}
              <div className="flex justify-between text-[#666]">
                <span>VAT {form.vat_pct || 0}% on subtotal{form.vat_inclusive ? ' (already included)' : ''}</span>
                <span>AED {calc.vatAmount.toFixed(2)}</span>
              </div>
              {/* Final price */}
              <div className="flex justify-between pt-2 mt-1 font-black text-[#F5F0E8] text-sm"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Final Price (per product)</span>
                <span className="text-emerald-400">AED {calc.finalPrice.toFixed(2)}</span>
              </div>
              {/* Buyback */}
              <div className="flex justify-between text-[10px] text-emerald-500/70">
                <span>Effective buyback rate</span>
                <span>AED {calc.effectiveBuyback.toFixed(4)}/g</span>
              </div>
            </div>
          </div>

          {/* Visibility toggles */}
          <div className="flex gap-6">
            <Toggle field="in_stock" label="In Stock" />
            <Toggle field="visible" label="Visible on Marketplace" />
          </div>
        </div>

        {/* Footer */}
        {saveError && (
          <div className="mx-7 mb-0 px-4 py-2.5 rounded-xl text-xs text-red-400 flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={12} /> {saveError}
          </div>
        )}
        <div className="sticky bottom-0 flex gap-3 px-7 py-5"
          style={{ background: '#0F0F0F', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs tracking-widest uppercase font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 btn-gold py-3 rounded-xl text-xs tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={12} /> {saving ? 'Saving…' : isNew ? 'Add Product' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function VendorDashboard() {
  const { authFetch, user, refreshUser, getToken } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('desk')
  const [pendingOrders, setPendingOrders] = useState([])
  const [acceptedOrders, setAcceptedOrders] = useState([])
  const [rejectedOrders, setRejectedOrders] = useState([])
  const [vendorOrderBusy, setVendorOrderBusy] = useState({})
  const [pendingSellOrders, setPendingSellOrders] = useState([])
  const [sellOrderBusy, setSellOrderBusy] = useState({})
  const [acceptedSells, setAcceptedSells] = useState([])
  const [rejectedSells, setRejectedSells] = useState([])
  const [acceptedNeedsPayment, setAcceptedNeedsPayment] = useState([])
  const [approvedSB, setApprovedSB] = useState([])
  const [rejectedSB, setRejectedSB] = useState([])
  const [catalog, setCatalog] = useState([])
  const [liveRates, setLiveRates] = useState({ gold: 0, silver: 0, platinum: 0, palladium: 0 })
  const [vendorPricing, setVendorPricing] = useState(null)
  const [pubSpot, setPubSpot] = useState(null)
  const [liveDeductions, setLiveDeductions] = useState({ gold: 0, silver: 0, platinum: 0, palladium: 0 })
  const [purityOptions, setPurityOptions] = useState({ gold: [], silver: [] })
  const [catalogModal, setCatalogModal] = useState(null)
  const [teamModal, setTeamModal] = useState(false)
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'Sales Staff' })
  const [catalogMsg, setCatalogMsg] = useState({ text: '', type: 'ok' })

  useEffect(() => {
    if (data?.compliance?.trading_allowed === true) return
    setPendingOrders([])
    setPendingSellOrders([])
    setAcceptedNeedsPayment([])
  }, [data?.compliance?.trading_allowed])

  const usedMetals = useMemo(() => {
    const s = new Set(catalog.map((p) => p.metal))
    return METALS.filter((m) => s.has(m.key))
  }, [catalog])

  const loadCatalog = async () => {
    const r = await fetch(`${API_BASE}/vendor/catalog/`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (r.ok) {
      const data = await r.json()
      setCatalog(Array.isArray(data) ? data.map(withResolvedCatalogImage) : data)
    }
  }

  const loadPricing = async () => {
    const r = await fetch(`${API_BASE}/vendor/pricing/`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (r.ok) {
      const d = await r.json()
      setVendorPricing(d)
      setLiveRates({ gold: d.gold_rate, silver: d.silver_rate, platinum: d.platinum_rate, palladium: d.palladium_rate })
      setLiveDeductions({ gold: d.gold_buyback_deduction, silver: d.silver_buyback_deduction, platinum: d.platinum_buyback_deduction, palladium: d.palladium_buyback_deduction })
      setPurityOptions({
        gold: d.gold_purity_options && d.gold_purity_options.length
          ? d.gold_purity_options
          : ['24K', '22K', '21K', '18K', '999.9', '999', '916'],
        silver: d.silver_purity_options && d.silver_purity_options.length
          ? d.silver_purity_options
          : ['999', '999.9', '925', '958'],
      })
    }
  }

  useEffect(() => {
    fetch(API_SPOT_PRICES, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setPubSpot(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshUser()
    authFetch(`${API_BASE}/dashboard/vendor/`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
    loadCatalog()
    loadPricing()
  }, [authFetch])

  usePoll(() => {
    authFetch(`${API_BASE}/dashboard/vendor/`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setData(d)
      })
      .catch(() => {})
    loadCatalog()
    loadPricing()
  }, VENDOR_DASH_POLL_MS, true)

  useEffect(() => {
    if (section !== 'desk') return
    if (data?.compliance?.trading_allowed !== true) {
      setPendingOrders([])
      setPendingSellOrders([])
      return
    }
    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const [rBuy, rSell] = await Promise.all([
          authFetch(`${API_BASE}/vendor/pending-orders/`, { cache: 'no-store' }),
          authFetch(`${API_BASE}/vendor/sell-orders/`, { cache: 'no-store' }),
        ])
        if (rBuy.ok) setPendingOrders(await rBuy.json())
        if (rSell.ok) setPendingSellOrders(await rSell.json())
      } catch {}
    }
    poll()
    const interval = setInterval(poll, VENDOR_DESK_POLL_MS)
    const onVis = () => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [section, authFetch, data?.compliance?.trading_allowed])

  const handleVendorOrder = async (orderId, action) => {
    setVendorOrderBusy((p) => ({ ...p, [orderId]: true }))
    try {
      await authFetch(`${API_BASE}/vendor/orders/${orderId}/${action}/`, { method: 'POST' })
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId))
      if (action === 'accept') setAcceptedOrders((p) => [...p, orderId])
      else setRejectedOrders((p) => [...p, orderId])
    } catch {}
    setVendorOrderBusy((p) => ({ ...p, [orderId]: false }))
  }

  const handleSellOrder = async (sellOrderId, action) => {
    setSellOrderBusy((p) => ({ ...p, [sellOrderId]: true }))
    try {
      const res = await authFetch(`${API_BASE}/vendor/sell-orders/${sellOrderId}/${action}/`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setPendingSellOrders((prev) => prev.filter((o) => o.id !== sellOrderId))
        setData((prev) => prev ? {
          ...prev,
          sellback_queue: (prev.sellback_queue || []).filter((o) => o.id !== sellOrderId),
        } : prev)
        if (action === 'accept') {
          setAcceptedSells((p) => [...p, sellOrderId])
          if (!updated.vendor_balance_used) {
            setAcceptedNeedsPayment((p) => [...p, updated])
          }
        } else {
          setRejectedSells((p) => [...p, sellOrderId])
        }
      }
    } catch {}
    setSellOrderBusy((p) => ({ ...p, [sellOrderId]: false }))
  }


  if (loading) return (
    <DashboardLayout navItems={NAV} title="Vendor Dashboard" activeSection={section} onSectionChange={setSection}>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(168,169,173,0.2)', borderTopColor: '#A8A9AD' }} />
      </div>
    </DashboardLayout>
  )

  const stats = data?.stats || {}
  const vendorAcceptTtl = data?.config?.vendor_accept_ttl_seconds || 60
  const sellbackQueue = (data?.sellback_queue || []).filter(
    (r) => !approvedSB.includes(r.id) && !rejectedSB.includes(r.id)
  )
  const inventory = data?.inventory || {}
  const fin = data?.financials || {}
  const statements = data?.statements || []
  const vendorTransactions = data?.transactions || []
  const team = data?.team || []
  const compliance = (data?.compliance && data.compliance.status != null)
    ? data.compliance
    : {
        status: user?.kyc_status === 'verified' ? 'verified' : user?.kyc_status === 'rejected' ? 'rejected' : 'pending',
        pending_items: [],
        trading_allowed: false,
      }

  const deskLocked = compliance.trading_allowed !== true

  const navWithBadge = NAV.map((n) => ({
    ...n,
    badge: n.sectionKey === 'desk' ? pendingOrders.length + pendingSellOrders.length
         : n.sectionKey === 'sellback' ? sellbackQueue.length
         : 0,
  }))

  const SECTION_TITLES = {
    desk: 'Live Sales Desk',
    sellback: 'Sell-back Queue',
    catalog: 'Catalog Management',
    inventory: 'Inventory',
    financials: 'Financials',
    statements: 'Statements',
    team: 'Team Management',
  }

  const TABS = navWithBadge.filter((n) => n.sectionKey)

  return (
    <DashboardLayout navItems={navWithBadge} title={`${user?.vendor_company || 'Vendor'} Dashboard`}
      activeSection={section} onSectionChange={setSection}>

      {/* KYB — live desk locked until verified; catalog/pricing/inventory stay available */}
      {compliance.trading_allowed !== true && compliance.status !== 'rejected' && (
        <div className="mb-6 px-5 py-4 rounded-2xl flex items-start gap-4"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <span className="text-base">⏳</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#f59e0b] mb-0.5">KYB incomplete — live trading desk locked</p>
            <p className="text-xs text-[#888] mb-2">
              Incoming buy orders and sell-backs stay disabled until Cridora approves KYB and all required documents are verified.
              You can still add, edit, or delete catalog products, pricing, and schedule; listings go live on the marketplace only after KYB is approved.
            </p>
            {(compliance.pending_items && compliance.pending_items.length > 0) ? (
              <ul className="text-xs text-[#b5b5b5] space-y-1.5 list-disc pl-4">
                {compliance.pending_items.map((item, idx) => (
                  <li key={idx}>
                    <span className="font-semibold text-[#ccc]">{item.label}</span>
                    {item.detail ? <span> — {item.detail}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#888]">Complete all items under KYB Docs.</p>
            )}
          </div>
        </div>
      )}
      {compliance.status === 'rejected' && (
        <div className="mb-6 px-5 py-4 rounded-2xl flex items-start gap-4"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(239,68,68,0.15)' }}>
            <span className="text-base">❌</span>
          </div>
          <div>
            <p className="text-sm font-bold text-red-400 mb-0.5">KYB Application Rejected</p>
            <p className="text-xs text-[#888]">
              Your vendor application was not approved. Please contact our team at <span className="text-[#C9A84C]">vendors@cridora.com</span> for assistance.
            </p>
          </div>
        </div>
      )}


      {/* ─── LIVE SALES DESK ──────────────────────────── */}
      {section === 'desk' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left: Controls (1/3) ── */}
          <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col gap-4">
            <LiveMetalRateControls
              vendorPricing={vendorPricing}
              usedMetals={usedMetals}
              catalog={catalog}
              getToken={getToken}
              onSaved={() => { loadPricing(); loadCatalog() }}
            />
            <LiveProductControls
              catalog={catalog}
              getToken={getToken}
              onUpdate={loadCatalog}
              onProductUpdated={(updated) =>
                setCatalog((prev) => prev.map((p) => (
                  p.id === updated.id ? withResolvedCatalogImage({ ...p, ...updated }) : p
                )))
              }
            />
          </div>

          {/* ── Right: Live Orders (2/3) ── */}
          <div className="flex-1 min-w-0">
            {deskLocked ? (
              <div className="rounded-2xl p-8 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Lock size={28} className="mx-auto text-[#f59e0b] mb-3 opacity-80" />
                <p className="text-sm font-bold text-[#f59e0b] mb-1">Live trading desk is locked</p>
                <p className="text-xs text-[#666] max-w-md mx-auto leading-relaxed">
                  Complete KYB under <strong className="text-[#888]">KYB Docs</strong>. Until then you will not receive buy or sell-back requests here.
                  Pricing and product controls on the left still update your catalog for when you go live.
                </p>
              </div>
            ) : (
              <>
            <p className="text-xs text-[#555] mb-4 tracking-wide">
              Incoming buy requests expire in {vendorAcceptTtl} seconds. Accept or reject promptly.
            </p>
            {pendingOrders.length === 0 ? (
              <div className="text-center py-16 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Zap size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-sm text-[#444]">No pending orders right now</p>
                <p className="text-[11px] text-[#333] mt-1">New requests will appear here in real time</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {pendingOrders.map((order) => (
                    <motion.div key={order.id} layout
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
                      style={{ background: 'rgba(168,169,173,0.05)', border: '1px solid rgba(168,169,173,0.15)' }}>
                      <div className="flex items-center gap-4">
                        <OrderTimer seconds={order.expires_in} max={vendorAcceptTtl} />
                        <div>
                          <div className="text-sm font-bold text-[#F5F0E8] font-mono">{order.order_ref}</div>
                          <div className="text-xs text-[#666] mt-0.5">
                            {order.customer} · {order.product} · {Number(order.qty_grams).toFixed(2)}g
                          </div>
                          <div className="text-[10px] text-[#444] mt-0.5 capitalize">{order.metal} · {order.qty_units} unit{order.qty_units !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-black" style={{ color: '#C9A84C' }}>
                          AED {order.price_aed?.toLocaleString()}
                        </div>
                        <div className="flex gap-2">
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => handleVendorOrder(order.id, 'accept')}
                            disabled={!!vendorOrderBusy[order.id]}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                            <CheckCircle size={13} /> Accept
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => handleVendorOrder(order.id, 'reject')}
                            disabled={!!vendorOrderBusy[order.id]}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                            <XCircle size={13} /> Reject
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            {(acceptedOrders.length > 0 || rejectedOrders.length > 0) && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs text-[#555] mb-2 tracking-widest uppercase">Buy orders actioned this session</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400 font-semibold">{acceptedOrders.length} accepted</span>
                  <span className="text-red-400 font-semibold">{rejectedOrders.length} rejected</span>
                </div>
              </div>
            )}

            {/* ── Pending Sell Requests ── */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8]">Sell Requests</h3>
                {pendingSellOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {pendingSellOrders.length}
                  </span>
                )}
              </div>
              {pendingSellOrders.length === 0 ? (
                <div className="text-center py-10 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-sm text-[#333]">No pending sell requests</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence>
                    {pendingSellOrders.map((so) => {
                      const profitPos = so.profit_aed >= 0
                      return (
                        <motion.div key={so.id} layout
                          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          className="rounded-2xl p-5"
                          style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="text-sm font-bold text-[#F5F0E8] font-mono">{so.order_ref}</div>
                              <div className="text-xs text-[#666] mt-0.5">
                                {so.customer_name} · {so.product_name} · {so.purity} · {Number(so.qty_grams).toFixed(4)}g
                              </div>
                              <div className="text-[10px] text-[#444] mt-0.5 capitalize">{so.metal}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-black" style={{ color: '#C9A84C' }}>
                                Payout: AED {Number(so.net_payout_aed).toFixed(2)}
                              </div>
                              <div className={`text-xs font-semibold mt-0.5 ${profitPos ? 'text-emerald-400' : 'text-red-400'}`}>
                                Customer {profitPos ? 'profit' : 'loss'}: {profitPos ? '+' : ''}AED {Number(so.profit_aed).toFixed(2)}
                              </div>
                            </div>
                          </div>
                          {/* Mini breakdown */}
                          <div className="mt-3 grid grid-cols-3 gap-2 p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                            {[
                              ['Buy rate', `AED ${Number(so.purchase_rate_per_gram).toFixed(4)}/g`],
                              ['Buyback rate', `AED ${Number(so.buyback_rate_per_gram).toFixed(4)}/g`],
                              ['Qty', `${Number(so.qty_grams).toFixed(4)}g`],
                            ].map(([k, v]) => (
                              <div key={k}>
                                <div className="text-[10px] text-[#444]">{k}</div>
                                <div className="text-xs font-semibold text-[#888]">{v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => handleSellOrder(so.id, 'accept')}
                              disabled={!!sellOrderBusy[so.id]}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                              <CheckCircle size={12} /> Accept
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => handleSellOrder(so.id, 'reject')}
                              disabled={!!sellOrderBusy[so.id]}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                              <XCircle size={12} /> Reject
                            </motion.button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
              {(acceptedSells.length > 0 || rejectedSells.length > 0) && (
                <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs text-[#555] mb-2 tracking-widest uppercase">Sell requests actioned this session</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-400 font-semibold">{acceptedSells.length} accepted</span>
                    <span className="text-red-400 font-semibold">{rejectedSells.length} rejected</span>
                  </div>
                </div>
              )}

              {/* ── Accepted sell orders needing manual bank payment ── */}
              {acceptedNeedsPayment.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-xs font-bold tracking-widest uppercase text-[#f59e0b]">Pending Bank Transfer</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {acceptedNeedsPayment.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#555] mb-3">
                    Your pool balance was insufficient for these payouts. Transfer the amount to Cridora's account and notify admin.
                  </p>
                  <div className="flex flex-col gap-3">
                    {acceptedNeedsPayment.map((so) => (
                      <div key={so.id} className="rounded-xl p-4"
                        style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                          <div>
                            <div className="text-xs font-bold font-mono text-[#F5F0E8]">{so.order_ref}</div>
                            <div className="text-[11px] text-[#666] mt-0.5">
                              {so.customer_name} · {so.product_name} · {Number(so.qty_grams).toFixed(4)}g
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-[#f59e0b]">
                              AED {Number(so.net_payout_aed).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-[#555]">
                              Pool at accept: AED {Number(so.vendor_pool_balance_at_accept).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-lg"
                          style={{ background: 'rgba(0,0,0,0.3)' }}>
                          <AlertTriangle size={11} className="text-amber-400 flex-shrink-0" />
                          <p className="text-[11px] text-amber-400/80">
                            Transfer <strong>AED {Number(so.net_payout_aed).toFixed(2)}</strong> to Cridora bank account and notify admin with reference <strong>{so.order_ref}</strong>.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ─── PORTFOLIO ────────────────────────────────── */}
      {section === 'portfolio' && <PortfolioSection />}

      {/* ─── SCHEDULE & HOURS ─────────────────────────── */}
      {section === 'schedule' && <ScheduleSection />}

      {/* ─── SELL-BACK QUEUE ──────────────────────────── */}
      {section === 'sellback' && (
        <div>
          {deskLocked ? (
            <div className="rounded-2xl p-10 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Lock size={28} className="mx-auto text-[#f59e0b] mb-3 opacity-80" />
              <p className="text-sm font-bold text-[#f59e0b] mb-1">Sell-back queue requires KYB</p>
              <p className="text-xs text-[#666] max-w-md mx-auto">
                Complete verification in <strong className="text-[#888]">KYB Docs</strong> to approve or reject customer sell-backs.
              </p>
            </div>
          ) : (
            <>
          <p className="text-xs text-[#555] mb-4 tracking-wide">
            Customer sell-back requests. Approve only if your pool balance is sufficient.
          </p>
          {sellbackQueue.length === 0 ? (
            <div className="text-center py-16 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <CheckCircle size={32} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-sm text-[#444]">All sell-back requests resolved</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {sellbackQueue.map((req) => (
                <div key={req.id} className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
                  style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-[#F5F0E8] font-mono">{req.id}</span>
                    </div>
                    <div className="text-xs text-[#666]">
                      {req.customer} · {req.product} · {req.qty_grams}g
                    </div>
                    <div className="text-[10px] text-[#444] mt-0.5">
                      Requested: {req.requested_at?.slice(0, 10)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[10px] tracking-widest uppercase text-[#555]">Payout Required</div>
                      <div className="text-lg font-black text-red-400">AED {req.payout_aed}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleSellOrder(req.id, 'accept')} disabled={sellOrderBusy[req.id]}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                        <CheckCircle size={12} /> {sellOrderBusy[req.id] ? '…' : 'Accept'}
                      </button>
                      <button onClick={() => handleSellOrder(req.id, 'reject')} disabled={sellOrderBusy[req.id]}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-50"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        <XCircle size={12} /> {sellOrderBusy[req.id] ? '…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* ─── CATALOG ──────────────────────────────────── */}
      {section === 'catalog' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs text-[#555]">{catalog.length} products listed</p>
              {catalogMsg.text && (
                <p className={`text-xs mt-0.5 ${catalogMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {catalogMsg.text}
                </p>
              )}
            </div>
            <button onClick={() => setCatalogModal({})}
              className="btn-gold px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold flex items-center gap-1.5">
              <Plus size={12} /> Add Product
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(168,169,173,0.12)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(168,169,173,0.05)', borderBottom: '1px solid rgba(168,169,173,0.08)' }}>
                    {['', 'Product', 'Metal', 'Weight', 'Final Price', 'Metal Rate/g', 'Buyback/g', 'Fees', 'VAT', 'Stock', 'Visible', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-10 text-[#444] text-xs">No products yet. Click "Add Product" to get started.</td></tr>
                  )}
                  {catalog.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td className="px-3 py-2">
                        <CatalogImage
                          url={item.image_url}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover"
                          fallback={(
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <Package size={14} className="text-[#444]" />
                            </div>
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#F5F0E8] font-medium max-w-[160px] truncate">
                        <div>{item.name}</div>
                        <div className="text-[10px] text-[#444]">{item.purity} · {item.use_live_rate ? <span className="text-[#C9A84C]">Live rate</span> : 'Manual'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm font-semibold"
                          style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{item.metal}</span>
                      </td>
                      <td className="px-4 py-3 text-[#888] text-xs">{item.weight}g</td>
                      <td className="px-4 py-3 text-[#F5F0E8] font-bold">AED {Number(item.final_price ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#888] font-semibold text-xs">
                        AED {Number(item.effective_rate ?? 0).toFixed(4)}
                        {item.use_live_rate && <span className="block text-[9px] text-[#444]">live</span>}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold text-xs">
                        AED {Number(item.effective_buyback_per_gram ?? item.buyback_per_gram ?? 0).toFixed(4)}
                        {item.use_live_rate && <span className="block text-[9px] text-[#444]">live</span>}
                      </td>
                      <td className="px-4 py-3 text-[#666] text-xs">
                        {(Number(item.packaging_fee) + Number(item.storage_fee) + Number(item.insurance_fee)) > 0
                          ? `AED ${(Number(item.packaging_fee) + Number(item.storage_fee) + Number(item.insurance_fee)).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#666] text-xs">
                        {Number(item.vat_pct) > 0 ? `${item.vat_pct}%${item.vat_inclusive ? ' incl.' : ' excl.'}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] tracking-widest uppercase font-bold ${item.in_stock ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.in_stock ? `In Stock (${item.stock_qty})` : 'Out'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: item.visible ? '#10b981' : '#555' }}>
                          {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                          {item.visible ? 'Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCatalogModal(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                            style={{ background: 'rgba(168,169,173,0.08)', border: '1px solid rgba(168,169,173,0.15)', color: '#A8A9AD' }}>
                            <Edit2 size={10} /> Edit
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm('Delete this product?')) return
                            const dr = await fetch(`${API_BASE}/vendor/catalog/${item.id}/`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } })
                            if (dr.ok) {
                              setCatalog((p) => p.filter((c) => c.id !== item.id))
                              broadcastPricesRefresh({ source: 'vendor-catalog-delete' })
                            }
                          }}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <AnimatePresence>
            {catalogModal !== null && (
              <CatalogModal
                key={catalogModal?.id ?? 'new'}
                item={catalogModal?.id ? catalogModal : null}
                getToken={getToken}
                vendorPricing={vendorPricing}
                spotPreview={pubSpot}
                liveDeductions={liveDeductions}
                goldPurityOptions={purityOptions.gold}
                silverPurityOptions={purityOptions.silver}
                onClose={() => setCatalogModal(null)}
                onSave={async (form, imageFile, stagingIdFromModal) => {
                  const isEdit = Boolean(form.id)
                  const url = isEdit
                    ? `${API_BASE}/vendor/catalog/${form.id}/`
                    : `${API_BASE}/vendor/catalog/`
                  const method = isEdit ? 'PUT' : 'POST'
                  const headers = { Authorization: `Bearer ${getToken()}` }
                  if (imageFile) {
                    throw new Error('Image must be uploaded to the server first (use Upload to server & verify).')
                  }
                  const sid = Number(stagingIdFromModal) || 0
                  const payload = {
                    name: form.name,
                    metal: form.metal,
                    purity: form.purity,
                    weight: Number(form.weight ?? form.weight_grams ?? 0),
                    weight_grams: Number(form.weight ?? form.weight_grams ?? 0),
                    use_live_rate: Boolean(form.use_live_rate),
                    manual_rate_per_gram: Number(form.manual_rate_per_gram ?? 0),
                    buyback_per_gram: Number(form.buyback_per_gram ?? 0),
                    packaging_fee: Number(form.packaging_fee ?? 0),
                    storage_fee: Number(form.storage_fee ?? 0),
                    insurance_fee: Number(form.insurance_fee ?? 0),
                    vat_pct: Number(form.vat_pct ?? 0),
                    vat_inclusive: Boolean(form.vat_inclusive),
                    in_stock: Boolean(form.in_stock),
                    visible: Boolean(form.visible),
                    stock_qty: Number(form.stock_qty ?? 0),
                    ...(sid > 0 ? { staging_id: sid } : {}),
                  }
                  headers['Content-Type'] = 'application/json'
                  const body = JSON.stringify(payload)

                  const r = await fetch(url, { method, headers, body })
                  const resp = await r.json().catch(() => ({}))
                  if (r.ok) {
                    setCatalogModal(null)
                    setCatalogMsg({ text: isEdit ? 'Product updated.' : 'Product added.', type: 'ok' })
                    setTimeout(() => setCatalogMsg({ text: '', type: 'ok' }), 4000)
                    loadCatalog()
                    broadcastPricesRefresh({ source: 'vendor-catalog-modal' })
                  } else {
                    throw new Error(resp.detail || `Server error ${r.status}. Check all required fields.`)
                  }
                }}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── PRICING ──────────────────────────────────── */}
      {section === 'pricing' && (
        <PricingSection
          catalog={catalog}
          onRatesUpdated={(rates) => {
            setLiveRates(rates)
            loadPricing()
            loadCatalog()
          }}
        />
      )}

      {/* ─── INVENTORY ────────────────────────────────── */}
      {section === 'inventory' && (
        <div>
          {/* Alerts */}
          {inventory.alerts?.length > 0 && (
            <div className="flex flex-col gap-2 mb-6">
              {inventory.alerts.map((a) => (
                <div key={a.product} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: a.level === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${a.level === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
                  }}>
                  <AlertTriangle size={14} style={{ color: a.level === 'critical' ? '#ef4444' : '#f59e0b' }} />
                  <span className="text-xs" style={{ color: a.level === 'critical' ? '#ef4444' : '#f59e0b' }}>
                    {a.product}: {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Gold (Available)', value: `${inventory.summary?.total_gold_grams?.toLocaleString()}g`, color: '#C9A84C' },
              { label: 'Gold (Reserved)', value: `${inventory.summary?.reserved_gold_grams?.toLocaleString()}g`, color: '#888' },
              { label: 'Silver (Available)', value: `${inventory.summary?.total_silver_grams?.toLocaleString()}g`, color: '#A8A9AD' },
              { label: 'Silver (Reserved)', value: `${inventory.summary?.reserved_silver_grams?.toLocaleString()}g`, color: '#888' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18` }}>
                <div className="text-[10px] tracking-widest uppercase text-[#555] mb-2">{s.label}</div>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Inventory table — sourced from live catalog state */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                    {['Product', 'Metal', 'Weight/Unit', 'Stock Units', 'Stock (g)', 'Status', 'Final Price'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-[#444] text-xs">No catalog products. Add products in the Catalog section.</td></tr>
                  )}
                  {catalog.map((item, i) => {
                    const stockGrams = ((item.in_stock ? item.stock_qty : 0) * (item.weight || 0)).toFixed(2)
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td className="px-4 py-3 text-[#F5F0E8] font-medium">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-[#444]">{item.purity}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] tracking-widest uppercase px-2 py-1 rounded-sm font-semibold"
                            style={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C' }}>{item.metal}</span>
                        </td>
                        <td className="px-4 py-3 text-[#888] text-xs">{item.weight}g</td>
                        <td className="px-4 py-3 text-emerald-400 font-semibold">{item.in_stock ? item.stock_qty : 0}</td>
                        <td className="px-4 py-3 text-[#F5F0E8]">{stockGrams}g</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] tracking-widest uppercase font-bold ${item.in_stock ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.in_stock ? 'In Stock' : 'Out'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#C9A84C] font-semibold text-xs">
                          AED {Number(item.final_price ?? 0).toFixed(2)}
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

      {/* ─── FINANCIALS ───────────────────────────────── */}
      {section === 'financials' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Pool Balance', value: `AED ${fin.pool_balance_aed?.toLocaleString()}`, color: '#C9A84C', icon: DollarSign },
            { label: 'Available Balance', value: `AED ${fin.available_balance_aed?.toLocaleString()}`, color: '#10b981', icon: CheckCircle },
            { label: 'Pending Debits (Sell-backs)', value: `AED ${fin.pending_debits_aed?.toLocaleString()}`, color: '#ef4444', icon: AlertTriangle },
            { label: 'Credits Today', value: `AED ${fin.credits_today_aed?.toLocaleString()}`, color: '#A8A9AD', icon: TrendingUp },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl p-6"
              style={{ background: `${item.color}06`, border: `1px solid ${item.color}20` }}>
              <item.icon size={20} style={{ color: item.color }} className="mb-3 opacity-80" />
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#555] mb-2">{item.label}</div>
              <div className="text-2xl font-black text-[#F5F0E8]">{item.value}</div>
            </div>
          ))}
          <div className="md:col-span-2 p-5 rounded-xl"
            style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <p className="text-xs text-[#666] leading-relaxed">
              <span className="font-semibold" style={{ color: '#C9A84C' }}>Per-Vendor Isolation: </span>
              Your pool balance is held in strict isolation. Cridora does not pool or mix funds across vendors.
              All debit obligations (sell-backs) are tracked separately per vendor.
            </p>
          </div>
        </div>
      )}

      {/* ─── STATEMENTS ───────────────────────────────── */}
      {section === 'statements' && (
        <div>
          {/* Recent Transactions */}
          <div className="mb-10">
            <h3 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8] mb-4">Recent Transactions</h3>
            {vendorTransactions.length === 0 ? (
              <div className="text-center py-12 rounded-2xl text-[#444] text-sm"
                style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                No transactions yet
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(168,169,173,0.12)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Ref', 'Date', 'Type', 'Customer', 'Product', 'Grams', 'Amount (AED)', 'Net (AED)'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vendorTransactions.map((tx, i) => {
                        const isBuy = tx.type === 'BUY'
                        return (
                          <tr key={`${tx.ref}-${i}`}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td className="px-4 py-3 text-[#C9A84C] font-mono text-xs">{tx.ref}</td>
                            <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">{tx.date}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-sm"
                                style={isBuy
                                  ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
                                  : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#888] whitespace-nowrap">{tx.customer}</td>
                            <td className="px-4 py-3 text-xs text-[#F5F0E8] whitespace-nowrap">{tx.product}</td>
                            <td className="px-4 py-3 text-xs tabular-nums text-[#888]">{Number(tx.qty_grams).toFixed(4)}g</td>
                            <td className="px-4 py-3 text-xs tabular-nums text-[#F5F0E8] font-semibold">
                              AED {Number(tx.amount_aed).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums font-bold"
                              style={{ color: isBuy ? '#10b981' : '#ef4444' }}>
                              {isBuy ? '+' : '−'} AED {Math.abs(Number(tx.net_aed)).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* EOD Reports */}
          <p className="text-xs text-[#555] mb-4 tracking-wide">
            End-of-day (EOD) settlement reports. Final reports are available the next business day.
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.1)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                    {['Report ID', 'Date', 'Sales (AED)', 'Sell-backs (AED)', 'Net (AED)', 'Transactions', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase text-[#555] font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td className="px-4 py-3 text-[#C9A84C] font-mono text-xs">{s.id}</td>
                      <td className="px-4 py-3 text-[#888] text-xs">{s.date}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">AED {s.total_sales_aed?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-red-400 font-semibold">AED {s.total_sellbacks_aed?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[#F5F0E8] font-bold">AED {s.net_aed?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[#888]">{s.transactions}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] tracking-widest uppercase font-semibold text-emerald-400">{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TEAM ─────────────────────────────────────── */}
      {section === 'team' && (
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <p className="text-xs text-[#555]">{team.length} team members</p>
            <button onClick={() => setTeamModal(true)}
              className="btn-gold px-4 py-2 rounded-lg text-[10px] tracking-widest uppercase font-bold flex items-center gap-1.5">
              <UserPlus size={12} /> Add Staff
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {team.map((member) => (
              <div key={member.id} className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                    style={{ background: 'rgba(168,169,173,0.12)', color: '#A8A9AD' }}>
                    {member.name?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#F5F0E8]">{member.name}</span>
                      {member.role === 'Owner' && <Shield size={11} className="text-amber-400" />}
                    </div>
                    <div className="text-xs text-[#666] mt-0.5">{member.email}</div>
                    <div className="text-[10px] text-[#444] mt-0.5">
                      {member.role} · Joined {member.joined} · Last active {member.last_active}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] tracking-widest uppercase font-bold px-2 py-1 rounded-sm"
                    style={{
                      background: member.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                      color: member.status === 'active' ? '#10b981' : '#555',
                    }}>
                    {member.status}
                  </span>
                  {member.role !== 'Owner' && (
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      <RotateCcw size={10} /> Reset Password
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Role guide */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { role: 'Owner', desc: 'Full control: KYB, banking, team management, all operations', color: '#C9A84C' },
              { role: 'Sales Staff', desc: 'Operate live desk, manage catalog & prices, handle sell-backs', color: '#A8A9AD' },
            ].map((r) => (
              <div key={r.role} className="p-4 rounded-xl"
                style={{ background: `${r.color}06`, border: `1px solid ${r.color}15` }}>
                <div className="text-xs font-bold mb-1" style={{ color: r.color }}>{r.role}</div>
                <div className="text-[11px] text-[#555] leading-relaxed">{r.desc}</div>
              </div>
            ))}
          </div>

          {/* Add staff modal */}
          <AnimatePresence>
            {teamModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6"
                style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
                onClick={() => setTeamModal(false)}>
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-2xl p-7 w-full max-w-sm"
                  style={{ background: '#0F0F0F', border: '1px solid rgba(168,169,173,0.2)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-[#F5F0E8]">Add Staff Member</h3>
                    <button onClick={() => setTeamModal(false)} className="text-[#555] hover:text-[#888]"><X size={16} /></button>
                  </div>
                  <div className="flex flex-col gap-4 mb-5">
                    {[
                      { key: 'name', label: 'Full Name', placeholder: 'Staff Name' },
                      { key: 'email', label: 'Email', placeholder: 'staff@yourcompany.com' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">{label}</label>
                        <input value={newMember[key]} onChange={(e) => setNewMember((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8]"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,169,173,0.15)', outline: 'none' }} />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] tracking-widest uppercase text-[#555] mb-1.5 block">Role</label>
                      <select value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-[#F5F0E8]"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,169,173,0.15)', outline: 'none' }}>
                        <option value="Sales Staff" style={{ background: '#111' }}>Sales Staff</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => setTeamModal(false)}
                    className="btn-gold w-full py-3.5 rounded-xl text-xs tracking-widest uppercase font-bold">
                    Send Invitation
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── KYB DOCUMENTS ────────────────────────────── */}
      {section === 'kyb' && <KYBDocumentUploader />}

      {/* ─── SETTINGS ──────────────────────────────── */}
      {section === 'settings' && (
        <div className="max-w-2xl">
          <h2 className="text-sm font-bold tracking-widest uppercase text-[#F5F0E8] mb-6">Settings</h2>
          <VendorLogoSection />
          <VendorPublicIntroSection />
          <VendorChangePasswordSection />
        </div>
      )}
    </DashboardLayout>
  )
}
