import { useCallback, useEffect, useMemo, useRef, useState, createElement } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion as Motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calculator,
  Coins,
  Gem,
  Landmark,
  LineChart as LineChartIcon,
  Minus,
  Plus,
  Printer,
  Scale,
  Shield,
  Smartphone,
  Sparkles,
  Store,
  Table2,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SpotPriceTicker from '../components/SpotPriceTicker'
import SeoHead from '../components/SeoHead'
import FadeIn from '../components/FadeIn'
import { API_METAL_HISTORY, SITE_ORIGIN } from '../config'
import { STATIC_COMPETITORS } from '../features/tools/comparisonPlatforms.js'
import {
  computeRows,
  mergeCridoraPlatform,
  summariesFromRows,
} from '../features/tools/comparisonCalculations.js'
import { cacheAge, readCache, writeCache } from '../lib/apiCache'
import { readSpotPriceCache, useTickerSpotPrices } from '../lib/spotPriceCache'
import {
  fetchPlatformFees,
  PLATFORM_FEE_FRESH_MS as FEES_FRESH_MS,
  platformFeeCacheAge,
  readCachedPlatformFees,
} from '../lib/platformFees'

const TROY_OZ_GRAMS = 31.1035
const AVDP_OZ_GRAMS = 28.349523125
const GRAM_PRESETS = [1, 5, 10, 31.1, 100]

// Client-side freshness window for history — skip a network round-trip entirely when the
// cached value is still within this threshold (backend caches history for 24h).
const HIST_FRESH_MS = 6 * 60 * 60 * 1000
const HIST_DAYS = 365

function formatAed(n, digits = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-AE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function parseAlertSearchParams(searchParams) {
  if (searchParams.get('source') !== 'price-alert') return null
  const metalRaw = String(searchParams.get('metal') || 'gold').toLowerCase()
  const metal = metalRaw === 'silver' ? 'silver' : 'gold'
  const purityDefault = metal === 'silver' ? '999' : '24K'
  const purity = String(searchParams.get('purity') || purityDefault).trim() || purityDefault
  const directionRaw = String(searchParams.get('direction') || '').toLowerCase()
  const previous = Number(searchParams.get('previous'))
  const current = Number(searchParams.get('current'))
  const pct = Number(searchParams.get('pct'))
  const grams = Number(searchParams.get('grams'))
  let direction = directionRaw === 'up' || directionRaw === 'down' ? directionRaw : null
  if (!direction && Number.isFinite(previous) && Number.isFinite(current)) {
    direction = current >= previous ? 'up' : 'down'
  }
  return {
    metal,
    purity,
    direction,
    previous: Number.isFinite(previous) ? previous : null,
    current: Number.isFinite(current) ? current : null,
    pct: Number.isFinite(pct) ? pct : null,
    grams: Number.isFinite(grams) && grams > 0 ? grams : null,
    manual: searchParams.get('manual') === '1',
  }
}

function historyCacheKey(metal, purity) {
  return `metal_history_v1:${metal}:${purity}:${HIST_DAYS}`
}

function platformIcon(pid) {
  const c = 'w-9 h-9 rounded-xl flex items-center justify-center shrink-0'
  if (pid === 'cridora') {
    return (
      <div className={c} style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
        <Sparkles size={18} />
      </div>
    )
  }
  const map = {
    enbd: Landmark,
    mashreq: Smartphone,
    mintjewels: Store,
    mygoldwallet: Coins,
    izabullion: Gem,
    rakbank: Building2,
    adcb: Building2,
  }
  const Ic = map[pid] || Building2
  return (
    <div className={c} style={{ background: '#1a1d22', color: '#9ca3af' }}>
      <Ic size={18} />
    </div>
  )
}

function catLabel(cat) {
  if (cat === 'retail') return 'Retail-style composite'
  if (cat === 'banks') return 'Bank-style composite'
  return 'Cridora'
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

/** @param hist {{ dates: string[], values: number[] }} */
function nearestHistoryValue(hist, isoDate) {
  if (!hist?.dates?.length || hist.dates.length !== hist.values?.length) {
    return null
  }
  let best = null
  let bestD = Infinity
  for (let i = 0; i < hist.dates.length; i += 1) {
    const d0 = hist.dates[i]
    const diff = Math.abs(new Date(`${d0}T12:00:00Z`).getTime() - new Date(`${isoDate}T12:00:00Z`).getTime())
    if (diff < bestD) {
      bestD = diff
      best = hist.values[i]
    }
  }
  return best
}

function spotAedFromPayload(payload, metal, purityKey) {
  if (!payload) return null
  if (metal === 'gold' && payload.gold && purityKey && payload.gold[purityKey] != null) {
    return Number(payload.gold[purityKey])
  }
  if (metal === 'silver' && payload.silver && purityKey && payload.silver[purityKey] != null) {
    return Number(payload.silver[purityKey])
  }
  return null
}

export default function UaeDigitalGoldComparison() {
  const [searchParams] = useSearchParams()
  const alertCtx = useMemo(() => parseAlertSearchParams(searchParams), [searchParams])
  const [alertBannerOpen, setAlertBannerOpen] = useState(() => Boolean(alertCtx))
  const spotManualEditRef = useRef(false)
  const alertBannerKeyRef = useRef(searchParams.toString())

  const [grams, setGrams] = useState(() => alertCtx?.grams || 1)
  const [troyOz, setTroyOz] = useState(((alertCtx?.grams || 1) / TROY_OZ_GRAMS).toFixed(5))
  const [spotInput, setSpotInput] = useState(() => {
    if (alertCtx?.current != null) return String(Number(alertCtx.current).toFixed(2))
    const cached = readSpotPriceCache()?.data
    const live = spotAedFromPayload(
      cached,
      alertCtx?.metal === 'silver' ? 'silver' : 'gold',
      alertCtx?.metal === 'silver' ? alertCtx?.purity || '999' : alertCtx?.purity || '24K',
    )
    if (live != null && live > 0) return String(Number(live).toFixed(2))
    const g24 = cached?.gold?.['24K']
    return typeof g24 === 'number' && g24 > 0 ? String(g24.toFixed(2)) : ''
  })
  const [baselineSpot24k, setBaselineSpot24k] = useState(() => {
    const g24 = readSpotPriceCache()?.data?.gold?.['24K']
    return typeof g24 === 'number' && g24 > 0 ? g24 : null
  })
  const { data: tickerSpot } = useTickerSpotPrices()
  const [spotPayload, setSpotPayload] = useState(() => readSpotPriceCache()?.data ?? null)
  const [spotNote, setSpotNote] = useState(() => {
    const n = readSpotPriceCache()?.data?.note
    return typeof n === 'string' && n.trim() ? n.trim() : ''
  })
  const [holdingYears, setHoldingYears] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [buyFeePct, setBuyFeePct] = useState(() => {
    const cached = readCachedPlatformFees()
    return cached?.buy_fee_pct != null ? Number(cached.buy_fee_pct) : 0.5
  })
  const [sellSharePct, setSellSharePct] = useState(() => {
    const cached = readCachedPlatformFees()
    return cached?.sell_share_pct != null ? Number(cached.sell_share_pct) : 5
  })

  const initialMetal = alertCtx?.metal === 'silver' ? 'silver' : 'gold'
  const [histMetalView, setHistMetalView] = useState(initialMetal)
  const [histViewMode, setHistViewMode] = useState('chart')
  const [histSeries, setHistSeries] = useState(() => {
    const cached = readCache(historyCacheKey(initialMetal, initialMetal === 'silver' ? '999' : '24K'))
    return cached && !cached.error ? cached : null
  })
  const [histLoading, setHistLoading] = useState(
    () => !readCache(historyCacheKey(initialMetal, initialMetal === 'silver' ? '999' : '24K')),
  )
  const [histErrorCode, setHistErrorCode] = useState(null)

  const [calcMetal, setCalcMetal] = useState(initialMetal)
  const [calcPurityGold, setCalcPurityGold] = useState(
    alertCtx?.metal === 'gold' && alertCtx?.purity ? alertCtx.purity : '24K',
  )
  const [calcPuritySilver, setCalcPuritySilver] = useState(
    alertCtx?.metal === 'silver' && alertCtx?.purity ? alertCtx.purity : '999',
  )
  const [calcGrams, setCalcGrams] = useState(alertCtx?.grams || 10)
  const [calcStart, setCalcStart] = useState('')
  const [calcHist, setCalcHist] = useState(() => {
    const cached = readCache(historyCacheKey(initialMetal, initialMetal === 'silver' ? '999' : '24K'))
    return cached && !cached.error ? cached : null
  })
  const historyRequestsRef = useRef(new Map())

  // Re-open the alert banner when a new price-alert deep link arrives.
  useEffect(() => {
    const key = searchParams.toString()
    if (searchParams.get('source') !== 'price-alert') return
    if (alertBannerKeyRef.current === key) return
    alertBannerKeyRef.current = key
    queueMicrotask(() => setAlertBannerOpen(true))
  }, [searchParams])

  const mergedPlatforms = useMemo(
    () => mergeCridoraPlatform(STATIC_COMPETITORS, buyFeePct, sellSharePct),
    [buyFeePct, sellSharePct],
  )

  const spotNumeric = Number(spotInput) || 0
  const gramSafe = grams > 0 ? grams : 1
  const spotForCalc = spotNumeric > 0 ? spotNumeric : (baselineSpot24k ?? 0)

  const calculatedRows = useMemo(
    () => computeRows(mergedPlatforms, gramSafe, spotForCalc, holdingYears),
    [mergedPlatforms, gramSafe, spotForCalc, holdingYears],
  )

  const summary = useMemo(() => summariesFromRows(calculatedRows), [calculatedRows])

  const displayedRows = useMemo(() => {
    if (categoryFilter === 'banks') {
      return calculatedRows.filter((p) => p.id === 'cridora' || p.category === 'banks')
    }
    if (categoryFilter === 'retail') {
      return calculatedRows.filter((p) => p.id === 'cridora' || p.category === 'retail')
    }
    return calculatedRows
  }, [calculatedRows, categoryFilter])

  const maxRoundtripDisplayed = Math.max(...displayedRows.map((r) => r.roundtripCost), 0.01)
  const maxVsBuyDisplayed = Math.max(...displayedRows.map((r) => r.vsCridoraBuyAed || 0), 0.01)
  const rankedBuyRows = useMemo(
    () => [...displayedRows].sort((a, b) => a.totalBuyCost - b.totalBuyCost),
    [displayedRows],
  )
  const liveSpotReady = spotForCalc > 0

  const histPurity = histMetalView === 'gold' ? '24K' : histMetalView === 'silver' ? '999' : '999'

  const calcPurityKey = useMemo(
    () => (calcMetal === 'silver' ? calcPuritySilver : calcPurityGold),
    [calcMetal, calcPurityGold, calcPuritySilver],
  )

  /** Mirror the on-page ticker — never fetch spot independently. */
  useEffect(() => {
    const data = tickerSpot || readSpotPriceCache()?.data
    if (!data) return
    setSpotPayload(data)
    const compareMetal = alertCtx?.metal === 'silver' ? 'silver' : 'gold'
    const comparePurity =
      compareMetal === 'silver'
        ? alertCtx?.purity || '999'
        : alertCtx?.purity || '24K'
    const liveTier = spotAedFromPayload(data, compareMetal, comparePurity)
    const g24 = data.gold && typeof data.gold['24K'] === 'number' ? data.gold['24K'] : null
    if (g24 != null && g24 > 0) setBaselineSpot24k(g24)
    if (liveTier != null && liveTier > 0 && !spotManualEditRef.current) {
      setSpotInput((prevInput) => {
        if (!prevInput || prevInput === '') return String(liveTier.toFixed(2))
        // Keep following ticker while user has not manually edited the field.
        return String(liveTier.toFixed(2))
      })
    }
    const n = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : ''
    setSpotNote(n)
  }, [tickerSpot, alertCtx])

  useEffect(() => {
    let cancelled = false
    if (platformFeeCacheAge() < FEES_FRESH_MS) {
      // Fee % changes rarely — a recent cached value is good enough, skip the request.
      return
    }
    fetchPlatformFees()
      .then((data) => {
        if (!data || cancelled) return
        if (data.buy_fee_pct != null) setBuyFeePct(Number(data.buy_fee_pct))
        if (data.sell_share_pct != null) setSellSharePct(Number(data.sell_share_pct))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Shared, deduped metal-history loader used by both the benchmark chart and the
   * value calculator. When both want the same metal+purity (the common case on first
   * load — both default to gold/24K), only one network request is made; the second
   * caller reuses the in-flight promise instead of firing a duplicate fetch.
   */
  const loadHistory = useCallback((metal, purity) => {
    const key = historyCacheKey(metal, purity)
    const cached = readCache(key)
    if (cached && cacheAge(key) < HIST_FRESH_MS) {
      return Promise.resolve(cached)
    }
    const inFlight = historyRequestsRef.current.get(key)
    if (inFlight) return inFlight
    const u = `${API_METAL_HISTORY}?metal=${encodeURIComponent(metal)}&purity=${encodeURIComponent(purity)}&days=${HIST_DAYS}`
    const p = fetch(u, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) writeCache(key, data)
        return data
      })
      .finally(() => {
        historyRequestsRef.current.delete(key)
      })
    historyRequestsRef.current.set(key, p)
    return p
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- history panel init + fetch */
  useEffect(() => {
    let cancelled = false
    const key = historyCacheKey(histMetalView, histPurity)
    const cached = readCache(key)
    if (cached && !cached.error) {
      setHistSeries(cached)
      setHistErrorCode(null)
      if (cacheAge(key) < HIST_FRESH_MS) {
        setHistLoading(false)
        return () => {
          cancelled = true
        }
      }
    } else {
      setHistLoading(true)
      setHistErrorCode(null)
    }
    loadHistory(histMetalView, histPurity)
      .then((data) => {
        if (!cancelled) {
          const err = data && data.error ? data.error : null
          setHistErrorCode(err)
          setHistSeries(err ? null : data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistSeries(null)
          setHistErrorCode('fetch_failed')
        }
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [histMetalView, histPurity, loadHistory])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    let cancelled = false
    const pkey = calcPurityKey
    const key = historyCacheKey(calcMetal, pkey)
    const cached = readCache(key)
    if (cached && !cached.error) {
      setCalcHist(cached)
      if (cacheAge(key) < HIST_FRESH_MS) {
        return () => {
          cancelled = true
        }
      }
    }
    loadHistory(calcMetal, pkey)
      .then((data) => {
        if (!cancelled) setCalcHist(data?.error ? null : data)
      })
      .catch(() => {
        if (!cancelled) setCalcHist(null)
      })
    return () => {
      cancelled = true
    }
  }, [calcMetal, calcPurityKey, loadHistory])

  const chartPoints = useMemo(() => {
    if (!histSeries?.dates?.length || histSeries.dates.length !== histSeries.values?.length) {
      return []
    }
    return histSeries.dates.map((d, i) => ({
      iso: d,
      label: d.slice(5),
      v: histSeries.values[i],
    }))
  }, [histSeries])

  const growthNarrative = useMemo(() => {
    if (!histSeries?.values?.length) return null
    const vs = histSeries.values
    const a = vs[0]
    const b = vs[vs.length - 1]
    if (!(a > 0) || !(b >= 0)) return null
    const pct = ((b - a) / a) * 100
    return { a, b, pct, label: histMetalView === 'silver' ? 'Silver' : 'Gold' }
  }, [histSeries, histMetalView])

  const calcPastValue = nearestHistoryValue(calcHist, calcStart)
  const calcNowSpot = spotAedFromPayload(spotPayload, calcMetal, calcPurityKey)
  const calcResult = useMemo(() => {
    if (!calcStart || !(calcPastValue > 0) || !(calcNowSpot > 0) || !(calcGrams > 0)) {
      return null
    }
    const pastTotal = calcGrams * calcPastValue
    const nowTotal = calcGrams * calcNowSpot
    const chgPct = pastTotal > 0 ? ((nowTotal - pastTotal) / pastTotal) * 100 : null
    return { pastTotal, nowTotal, chgPct }
  }, [calcStart, calcPastValue, calcNowSpot, calcGrams])

  function syncGrams(g) {
    const gg = clamp(g, 0.05, 10000)
    setGrams(Number(gg.toFixed(4)))
    setTroyOz((gg / TROY_OZ_GRAMS).toFixed(5))
  }

  const stdOz = gramSafe > 0 ? (gramSafe / AVDP_OZ_GRAMS).toFixed(5) : '0'

  const toolJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'UAE Digital Gold Platform Comparison',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    url: `${SITE_ORIGIN}/tools/uae-digital-gold-comparison`,
    description:
      'Interactive UAE digital gold comparison showing Cridora’s lowest modeled metal buy cost against illustrative bank and retail composites on a shared AED spot reference.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'AED',
    },
  }

  return (
    <>
      <SeoHead
        title="UAE Gold Price Comparison — Lowest Modeled Buy Cost | Cridora"
        description="Compare live Cridora ticker rates with illustrative UAE bank and retail composites. See Cridora’s lowest modeled metal buy cost on the same live rate — educational only."
        path="/tools/uae-digital-gold-comparison"
        jsonLd={toolJsonLd}
      />
      <main className="min-w-0 w-full max-w-[100vw] overflow-x-hidden box-border overscroll-x-contain">
      <div className="pt-4 md:pt-[calc(5.5rem+env(safe-area-inset-top,0px))]">
        <SpotPriceTicker />
      </div>

      <section className="relative pt-8 pb-12 overflow-hidden" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-7xl mx-auto px-3 min-[400px]:px-4 sm:px-6 lg:px-8 min-w-0">
          <FadeIn>
            <div className="mb-8 max-w-3xl">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-3">
                Live UAE gold compare
              </p>
              <h1 className="text-[1.35rem] min-[390px]:text-2xl sm:text-3xl md:text-4xl font-black text-[var(--text-primary)] leading-tight mb-4 hyphens-auto">
                Compare gold costs on the{' '}
                <span className="gradient-gold-text">same live rate</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-lg">
                Same ticker AED/g as the header. Peers are illustrative composites — not binding quotes.
              </p>
            </div>
          </FadeIn>

          {alertBannerOpen && alertCtx ? (
            <FadeIn delay={0.02}>
              <div
                className="mb-6 rounded-2xl p-4 sm:p-5 relative"
                style={{
                  border: '1px solid rgba(232,195,74,0.4)',
                  background: 'linear-gradient(135deg, rgba(232,195,74,0.12), rgba(16,185,129,0.06))',
                }}
                role="status"
              >
                <button
                  type="button"
                  aria-label="Dismiss alert context"
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  onClick={() => setAlertBannerOpen(false)}
                >
                  <X size={16} />
                </button>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--gold)] pr-8">
                  Price alert · you&apos;re viewing the move that triggered it
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-black tabular-nums"
                    style={{ color: alertCtx.direction === 'down' ? '#34d399' : '#fbbf24' }}
                  >
                    {alertCtx.direction === 'down' ? (
                      <ArrowDownRight size={18} aria-hidden />
                    ) : (
                      <ArrowUpRight size={18} aria-hidden />
                    )}
                    {(alertCtx.purity || (alertCtx.metal === 'silver' ? '999' : '24K'))}{' '}
                    {alertCtx.metal}
                    {alertCtx.direction ? ` ${alertCtx.direction}` : ''}
                  </span>
                  {alertCtx.previous != null && alertCtx.current != null ? (
                    <span className="text-sm text-[var(--text-soft)] tabular-nums">
                      AED {formatAed(alertCtx.previous)}/g →{' '}
                      <strong className="text-[var(--text-primary)]">
                        AED {formatAed(
                          liveSpotReady ? spotForCalc : alertCtx.current,
                        )}/g
                      </strong>
                      {alertCtx.pct != null ? (
                        <span className="text-[var(--text-dim)]">
                          {' '}
                          ({alertCtx.pct >= 0 ? '+' : ''}
                          {alertCtx.pct.toFixed(2)}%)
                        </span>
                      ) : null}
                    </span>
                  ) : alertCtx.current != null ? (
                    <span className="text-sm text-[var(--text-soft)] tabular-nums">
                      Alert rate AED {formatAed(alertCtx.current)}/g
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed max-w-3xl">
                  Cridora currently has the <strong className="text-emerald-300">lowest modeled buy cost</strong>{' '}
                  in this like-for-like comparison (illustrative composites; processing excluded on both sides).
                  {liveSpotReady && alertCtx.current != null && Math.abs(spotForCalc - alertCtx.current) > 0.02 ? (
                    <span className="text-[var(--text-dim)]">
                      {' '}
                      Live ticker may differ slightly from the alert snapshot (AED {formatAed(alertCtx.current)}/g).
                    </span>
                  ) : null}
                </p>
              </div>
            </FadeIn>
          ) : null}

          {/* Live winner banner */}
          <FadeIn delay={0.04}>
            <div
              className="mb-8 rounded-2xl p-4 sm:p-6 border-2 relative overflow-hidden"
              style={{
                borderColor: 'rgba(16,185,129,0.4)',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(232,195,74,0.06))',
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="p-2.5 rounded-xl shrink-0"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}
                  >
                    <Sparkles size={22} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                      Lowest modeled buy cost on this page
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] mt-1 tabular-nums">
                      {liveSpotReady
                        ? `AED ${formatAed(summary.cridoraCalc?.totalBuyCost)} for ${gramSafe}g`
                        : 'Waiting for live ticker…'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 tabular-nums">
                      {liveSpotReady
                        ? `AED ${formatAed(summary.cridoraCalc?.buyCostPerGram)}/g · ${
                            alertCtx?.metal === 'silver'
                              ? `${alertCtx?.purity || '999'} silver`
                              : `${alertCtx?.purity || '24K'} gold`
                          } ticker`
                        : 'Rates update when the header ticker refreshes'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:min-w-[320px]">
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Modeled gap vs cheapest composite</p>
                    <p className="text-sm font-black text-emerald-300 tabular-nums mt-0.5">
                      {summary.buySavingsVsCheapestPeer > 0
                        ? `−AED ${formatAed(summary.buySavingsVsCheapestPeer)}`
                        : 'Lowest modeled'}
                    </p>
                  </div>
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">vs avg composite</p>
                    <p className="text-sm font-black text-[var(--gold)] tabular-nums mt-0.5">
                      {summary.buySavingsVsAvg > 0
                        ? `−AED ${formatAed(summary.buySavingsVsAvg)}`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl px-3 py-2.5 col-span-2 sm:col-span-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Live spot</p>
                    <p className="text-sm font-black text-[var(--text-primary)] tabular-nums mt-0.5">
                      {liveSpotReady ? `AED ${formatAed(spotForCalc)}/g` : '—'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-[var(--text-dim)] leading-relaxed">
                Metal-only · Assurance &amp; peer processing omitted · {summary.competitors?.length || 0} illustrative peers ·
                ticker refreshes with the header
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/marketplace?metal=${encodeURIComponent(alertCtx?.metal === 'silver' ? 'silver' : 'gold')}&grams=${encodeURIComponent(String(gramSafe))}&sort=price${alertCtx ? '&source=price-alert' : ''}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide"
                  style={{ background: 'var(--gold)', color: '#0a0a0a' }}
                >
                  Buy at this rate <ArrowRight size={14} />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border text-[var(--text-muted)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  How quotes work
                </Link>
              </div>
            </div>
          </FadeIn>

          {/* Controls + ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 min-w-0">
            <div
              className="lg:col-span-4 rounded-2xl p-4 sm:p-5 min-w-0 max-w-full"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                border: '1px solid var(--border)',
              }}
            >
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Scale size={16} className="text-[var(--gold)]" aria-hidden /> Compare amount
              </h2>

              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] mb-2 font-bold">
                Quick grams
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {GRAM_PRESETS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => syncGrams(g)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold tabular-nums"
                    style={
                      Math.abs(gramSafe - g) < 0.001
                        ? { background: 'rgba(232,195,74,0.25)', color: 'var(--text-primary)', border: '1px solid var(--gold)' }
                        : { background: '#121519', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                    }
                  >
                    {g}g
                  </button>
                ))}
              </div>

              <div className="mb-4 p-3 rounded-xl" style={{ background: '#0f1114', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border text-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => syncGrams(Math.max(0.1, gramSafe - 1))}
                    aria-label="Decrease grams"
                  >
                    <Minus size={16} aria-hidden />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    className="flex-1 min-w-0 text-center py-2 rounded-lg bg-[#121519] border text-[var(--text-primary)] font-bold text-lg tabular-nums"
                    style={{ borderColor: 'var(--border)' }}
                    value={grams}
                    onChange={(e) => syncGrams(Number(e.target.value))}
                    aria-label="Grams"
                  />
                  <button
                    type="button"
                    className="p-1.5 rounded-lg border text-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => syncGrams(gramSafe + 1)}
                    aria-label="Increase grams"
                  >
                    <Plus size={16} aria-hidden />
                  </button>
                </div>
                <p className="text-center text-[10px] text-[var(--text-dim)] mt-2 tabular-nums">
                  ≈ {troyOz} troy oz · {stdOz} avdp oz
                </p>
                <input
                  type="range"
                  min={1}
                  max={300}
                  value={clamp(Math.round(gramSafe), 1, 300)}
                  onChange={(e) => syncGrams(Number(e.target.value))}
                  className="w-full accent-[var(--gold)] mt-3"
                  aria-label="Grams slider"
                />
              </div>

              <label className="block mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-[var(--text-soft)]">
                    {alertCtx?.metal === 'silver'
                      ? `${alertCtx?.purity || '999'} silver reference (AED/g)`
                      : `${alertCtx?.purity || '24K'} gold reference (AED/g)`}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]"
                    onClick={() => {
                      const data = tickerSpot || readSpotPriceCache()?.data
                      if (!data) return
                      setSpotPayload(data)
                      spotManualEditRef.current = false
                      const compareMetal = alertCtx?.metal === 'silver' ? 'silver' : 'gold'
                      const comparePurity =
                        compareMetal === 'silver'
                          ? alertCtx?.purity || '999'
                          : alertCtx?.purity || '24K'
                      const liveTier = spotAedFromPayload(data, compareMetal, comparePurity)
                      const g24 = data.gold && typeof data.gold['24K'] === 'number' ? data.gold['24K'] : null
                      if (g24 != null && g24 > 0) setBaselineSpot24k(g24)
                      if (liveTier != null && liveTier > 0) {
                        setSpotInput(String(liveTier.toFixed(2)))
                      }
                    }}
                  >
                    Sync ticker
                  </button>
                </div>
                <input
                  type="number"
                  className="w-full py-2.5 px-3 rounded-xl bg-[#121519] border text-right text-base font-bold text-[var(--text-primary)] tabular-nums"
                  style={{ borderColor: 'var(--border)' }}
                  value={spotInput}
                  onChange={(e) => {
                    spotManualEditRef.current = true
                    setSpotInput(e.target.value)
                  }}
                />
              </label>

              <label className="block mb-3">
                <div className="flex justify-between text-xs font-semibold text-[var(--text-soft)] mb-2">
                  <span>Hold period (for round-trip below)</span>
                  <span className="text-[var(--gold)]">{holdingYears} yr</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={holdingYears}
                  onChange={(e) => setHoldingYears(Number(e.target.value))}
                  className="w-full accent-[var(--gold)]"
                />
              </label>

              <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
                Fair compare: peer processing &amp; Cridora Assurance omitted. Checkout adds{' '}
                <strong className="text-[var(--text-muted)]">{buyFeePct}%</strong> buy fee ·{' '}
                <strong className="text-[var(--text-muted)]">{sellSharePct}%</strong> of profit on sell-back.
              </p>
              {spotNote ? (
                <p className="text-[10px] text-[var(--text-dim)] mt-2 leading-snug">{spotNote}</p>
              ) : null}
            </div>

            <div className="lg:col-span-8 min-w-0 max-w-full">
              <div
                className="rounded-2xl p-4 sm:p-5 h-full"
                style={{ background: '#0e1014', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <BarChart3 size={18} className="text-[var(--gold)]" aria-hidden />
                      Who costs more to buy?
                    </h2>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Extra AED vs Cridora for the same {gramSafe}g · updates with the live ticker
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'banks', 'retail'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setCategoryFilter(k)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                        style={
                          categoryFilter === k
                            ? { background: 'rgba(232,195,74,0.25)', color: 'var(--text-primary)', border: '1px solid var(--gold)' }
                            : { background: '#121519', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                        }
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="space-y-2.5" aria-label="Buy cost ranking">
                  {rankedBuyRows.map((c) => {
                    const isCridora = c.id === 'cridora'
                    const barPct = isCridora
                      ? 8
                      : Math.min(100, Math.max(12, ((c.vsCridoraBuyAed || 0) / maxVsBuyDisplayed) * 100))
                    return (
                      <li
                        key={c.id}
                        className="rounded-xl px-3 py-2.5"
                        style={
                          isCridora
                            ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)' }
                            : { background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }
                        }
                      >
                        <div className="flex items-center gap-3 mb-1.5">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                            style={
                              isCridora
                                ? { background: 'rgba(16,185,129,0.25)', color: '#34d399' }
                                : { background: '#1a1d22', color: '#9ca3af' }
                            }
                          >
                            {c.buyRank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                                {c.name}
                                {isCridora ? (
                                  <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                    Lowest modeled
                                  </span>
                                ) : null}
                              </span>
                              <span className="tabular-nums text-sm font-black text-[var(--text-primary)] shrink-0">
                                AED {formatAed(c.totalBuyCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className="text-[10px] text-[var(--text-dim)] tabular-nums">
                                AED {formatAed(c.buyCostPerGram)}/g
                              </span>
                              <span
                                className="text-[10px] font-bold tabular-nums"
                                style={{ color: isCridora ? '#34d399' : '#f87171' }}
                              >
                                {isCridora
                                  ? 'Baseline'
                                  : `+AED ${formatAed(c.vsCridoraBuyAed)} · +${(c.vsCridoraBuyPct || 0).toFixed(1)}%`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <Motion.div
                            className="h-full rounded-full"
                            initial={false}
                            animate={{ width: `${barPct}%` }}
                            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                            style={{
                              background: isCridora
                                ? 'linear-gradient(90deg, #34d399, var(--gold))'
                                : 'linear-gradient(90deg, rgba(248,113,113,0.55), rgba(248,113,113,0.9))',
                            }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Detail table */}
          <FadeIn delay={0.06}>
            <section
              className="rounded-2xl overflow-hidden mb-12 min-w-0 max-w-full"
              style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border)' }}
            >
              <div className="px-5 py-4 border-b flex flex-col lg:flex-row gap-4 lg:items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Table2 size={20} className="text-[var(--gold)]" aria-hidden /> Full breakdown
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Buy cost first — then optional hold/sell friction. Illustrative composites only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase border flex items-center gap-2 self-start"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  <Printer size={14} /> Export
                </button>
              </div>
              <div className="overflow-x-auto overflow-y-hidden scroll-smooth [-webkit-overflow-scrolling:touch] touch-pan-x">
                <table className="min-w-[960px] w-full text-left text-xs md:text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-[var(--text-dim)] border-b" style={{ borderColor: 'var(--border)' }}>
                      <th className="py-3 px-4 font-bold">#</th>
                      <th className="py-3 px-2 font-bold">Platform</th>
                      <th className="py-3 px-2 text-right font-bold text-emerald-300">Buy total</th>
                      <th className="py-3 px-2 text-right font-bold text-[var(--gold)]">AED/g</th>
                      <th className="py-3 px-2 text-right font-bold text-red-300">vs Cridora</th>
                      <th className="py-3 px-2 text-right font-bold text-amber-300">Custody</th>
                      <th className="py-3 px-2 text-right font-bold text-red-300">Sell friction</th>
                      <th className="py-3 px-3 text-right font-bold text-[var(--text-muted)]">Round-trip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedBuyRows.map((c) => (
                      <tr
                        key={c.id}
                        style={
                          c.highlight
                            ? { background: 'rgba(16,185,129,0.06)', borderLeft: '4px solid #34d399' }
                            : { borderBottom: '1px solid var(--border)' }
                        }
                      >
                        <td className="py-3.5 px-4 tabular-nums font-black text-[var(--text-dim)]">
                          {c.buyRank}
                        </td>
                        <td className="py-3.5 px-2">
                          <div className="flex items-start gap-3">
                            {platformIcon(c.id)}
                            <div>
                              <div className="font-bold text-[var(--text-primary)]">{c.name}</div>
                              <div className="text-[10px] text-[var(--text-dim)]">
                                {catLabel(c.category)} · {c.badge}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-2 text-right font-black tabular-nums text-emerald-300">
                          {formatAed(c.totalBuyCost)}
                        </td>
                        <td className="py-3.5 px-2 text-right tabular-nums text-[var(--gold)]">
                          {formatAed(c.buyCostPerGram)}
                        </td>
                        <td className="py-3.5 px-2 text-right tabular-nums font-semibold" style={{ color: c.id === 'cridora' ? '#34d399' : '#f87171' }}>
                          {c.id === 'cridora' ? '—' : `+${formatAed(c.vsCridoraBuyAed)}`}
                        </td>
                        <td className="py-3.5 px-2 text-right tabular-nums text-amber-100/90">
                          {formatAed(c.compoundCustodyAED)}
                        </td>
                        <td className="py-3.5 px-2 text-right tabular-nums text-red-200">
                          {formatAed(c.sellMarkdownAED + c.sellExitFeeAED + c.sellFeeOnBase)}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums text-[var(--text-muted)]">
                          {formatAed(c.roundtripCost)}
                          <div className="text-[10px]">{c.roundtripPct.toFixed(2)}%</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </FadeIn>

          {/* History + friction bars */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-12 min-w-0">
            <section className="xl:col-span-7 rounded-2xl p-4 sm:p-6 min-w-0 max-w-full" style={{ background: '#0e1014', border: '1px solid var(--border)' }}>
              <div className="flex flex-col lg:flex-row gap-4 justify-between mb-6">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--gold)]">
                    Benchmark history
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] flex items-center gap-2 mt-1">
                    <LineChartIcon className="text-[var(--gold)]" /> AED per gram ({histPurity})
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                    Daily series proxied via Gold API (requires{' '}
                    <code className="text-[var(--text-soft)]">GOLD_API_KEY</code>). USD→AED uses the same peg-aware helper as spot.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['gold', 'silver'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setHistMetalView(m)}
                      className="px-3 py-2 rounded-xl text-[11px] font-bold capitalize"
                      style={
                        histMetalView === m
                          ? { background: 'rgba(232,195,74,0.25)', color: 'var(--text-primary)', border: '1px solid var(--gold)' }
                          : { background: '#121519', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {m}
                    </button>
                  ))}
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      className={`px-3 py-2 text-[11px] font-bold flex items-center gap-1 ${histViewMode === 'chart' ? 'bg-[rgba(232,195,74,0.2)] text-[var(--text-primary)]' : 'bg-[#121519] text-[var(--text-dim)]'}`}
                      onClick={() => setHistViewMode('chart')}
                    >
                      <LineChartIcon size={14} /> Chart
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 text-[11px] font-bold flex items-center gap-1 ${histViewMode === 'table' ? 'bg-[rgba(232,195,74,0.2)] text-[var(--text-primary)]' : 'bg-[#121519] text-[var(--text-dim)]'}`}
                      onClick={() => setHistViewMode('table')}
                    >
                      <Table2 size={14} /> Table
                    </button>
                  </div>
                </div>
              </div>

              {histLoading && <p className="text-[var(--text-muted)] text-sm mb-4">Loading history…</p>}
              {!histLoading && !histSeries && (
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  History unavailable
                  {histErrorCode === 'missing_api_key'
                    ? ': set GOLD_API_KEY on the API server.'
                    : histErrorCode
                      ? `: ${histErrorCode.replace(/_/g, ' ')}`
                      : '.'}
                </p>
              )}
              {!histLoading && histSeries?.values?.length > 0 && histViewMode === 'chart' && (
                <div className="h-[240px] min-[767px]:h-[280px] w-full min-w-0 max-w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints} margin={{ left: 4, right: 12, bottom: 0, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2f36" opacity={0.5} />
                      <XAxis dataKey="label" stroke="#8892a6" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#8892a6" tick={{ fontSize: 10 }} width={48} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          background: '#121519',
                          border: '1px solid rgba(232,195,74,0.35)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(_, payload) =>
                          payload && payload[0] ? String(payload[0].payload.iso) : ''
                        }
                        formatter={(v) =>
                          `${Number(v).toLocaleString('en-AE', { minimumFractionDigits: histMetalView === 'silver' ? 3 : 2 })} AED/g`
                        }
                      />
                      <Line type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!histLoading && histSeries?.values?.length > 0 && histViewMode === 'table' && (
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[var(--text-dim)] border-b" style={{ borderColor: 'var(--border)' }}>
                        <th className="text-left py-2">Date</th>
                        <th className="text-right py-2">Indicative AED/g</th>
                        <th className="text-right py-2">100 g illustration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histSeries.dates.slice(-56).map((d, idx) => {
                        const sliceStart = histSeries.dates.length - 56
                        const i = sliceStart + idx
                        const v = histSeries.values[i]
                        return (
                          <tr key={`${d}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td className="py-2 text-[var(--text-soft)]">{d}</td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-primary)]">
                              {typeof v === 'number' ? v.toLocaleString('en-AE') : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                              {typeof v === 'number' ? (v * 100).toLocaleString('en-AE', { maximumFractionDigits: 2 }) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="xl:col-span-5 flex flex-col gap-4 min-w-0 max-w-full">
              <div className="rounded-2xl p-5 flex-1" style={{ border: '1px solid var(--border)', background: '#101318' }}>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Growth</span>
                {growthNarrative ? (
                  <>
                    <h3 className="text-lg font-black text-[var(--text-primary)] mt-1">
                      {growthNarrative.label} moved {growthNarrative.pct >= 0 ? '+' : ''}
                      {growthNarrative.pct.toFixed(1)}% over displayed window
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
                      Window start <strong>{growthNarrative.a.toFixed(4)}</strong> → latest{' '}
                      <strong>{growthNarrative.b.toFixed(4)}</strong> AED/g (converted benchmark; not checkout price).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] mt-3">Charts load when history is configured.</p>
                )}
              </div>
              <div
                className="rounded-2xl p-5"
                style={{ border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.06)' }}
              >
                <div className="flex items-center gap-2 mb-2 text-emerald-300">
                  <Shield size={16} aria-hidden /> <span className="text-xs font-black uppercase tracking-wider">Reminder</span>
                </div>
                <p className="text-[11px] text-emerald-100/95 leading-relaxed">
                  Ranking above uses the live ticker metal rate. Peer premiums are educational composites —
                  Cridora is modeled as the lowest metal buy cost on this page. Checkout shows vendor quotes + Assurance on{' '}
                  <Link
                    to={`/marketplace?metal=${encodeURIComponent(alertCtx?.metal === 'silver' ? 'silver' : 'gold')}&grams=${encodeURIComponent(String(gramSafe))}&sort=price${alertCtx ? '&source=price-alert' : ''}`}
                    className="underline"
                  >
                    Marketplace
                  </Link>
                  .
                </p>
              </div>
            </aside>
          </div>

          {/* Friction bar chart + break-even */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 min-w-0">
            <section className="lg:col-span-7 rounded-2xl p-4 sm:p-6 min-w-0 max-w-full" style={{ border: '1px solid var(--border)', background: '#0f1115' }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <BarChart3 className="text-[var(--gold)]" /> If you buy &amp; sell later (lower is better)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mb-6">
                Extra costs over a {holdingYears}-year hold — Cridora stays at the bottom of the stack.
              </p>
              <div className="space-y-5">
                {displayedRows.map((calc) => {
                  const pct = (calc.roundtripCost / maxRoundtripDisplayed) * 100
                  return (
                    <div key={`bar-${calc.id}`}>
                      <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between gap-1 text-xs mb-1 min-w-0">
                        <span className="text-[var(--text-soft)] font-semibold min-w-0 break-words pr-2">{calc.name}</span>
                        <span className="text-[var(--text-primary)] font-bold tabular-nums shrink-0 text-right">
                          {calc.roundtripCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                          <span className={`ml-2 ${calc.highlight ? 'text-emerald-400' : 'text-red-300'}`}>
                            ({calc.roundtripPct.toFixed(2)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-6 rounded-lg overflow-hidden border flex bg-[#121519]" style={{ borderColor: 'var(--border)' }}>
                        <div
                          className="h-full transition-all rounded-md"
                          style={{
                            width: `${pct}%`,
                            background: calc.highlight
                              ? 'linear-gradient(90deg,#059669,#34d399)'
                              : 'linear-gradient(90deg,#3f1720,#991b1b)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
            <section className="lg:col-span-5 rounded-2xl p-4 sm:p-6 min-w-0 max-w-full" style={{ border: '1px solid var(--border)', background: '#0f1115' }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Coins className="text-[var(--gold)]" /> Break-even hurdle (same reference price)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-5">
                How much pure reference price appreciation is needed vs the modeled stacks (not legal or tax advice).
              </p>
              <div className="space-y-3">
                {displayedRows.map((calc) => {
                  const target = spotForCalc > 0 ? spotForCalc * (1 + calc.breakEvenPct / 100) : 0
                  return (
                    <div
                      key={`be-${calc.id}`}
                      className={`p-3.5 rounded-xl border flex gap-3 items-center justify-between ${
                        calc.highlight ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-[var(--border)] bg-[#121519]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {platformIcon(calc.id)}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">{calc.name}</div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            Target AED/g&nbsp;
                            <span className={`font-semibold ${calc.highlight ? 'text-emerald-300' : 'text-[var(--text-soft)]'}`}>
                              {target.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-black px-2 py-1 rounded-lg border ${calc.highlight ? 'text-emerald-400 border-emerald-500/30' : 'text-red-300 border-red-500/25'}`}
                      >
                        +{calc.breakEvenPct.toFixed(2)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Value calculator */}
          <FadeIn delay={0.06}>
            <section className="rounded-2xl p-4 sm:p-6 lg:p-8 mb-12 min-w-0 max-w-full" style={{ background: 'var(--section-wash-b)', border: '1px solid var(--border)' }}>
              <h2 className="text-xl font-black text-[var(--text-primary)] mb-6 flex flex-wrap items-center gap-2">
                <Calculator className="text-[var(--gold)]" />
                Holding value estimator (benchmark → today)
              </h2>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <select
                  className="py-3 px-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                  style={{ borderColor: 'var(--border)' }}
                  value={calcMetal}
                  onChange={(e) => setCalcMetal(e.target.value)}
                >
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                </select>
                {calcMetal === 'gold' && (
                  <select
                    value={calcPurityGold}
                    onChange={(e) => setCalcPurityGold(e.target.value)}
                    className="py-3 px-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {['24K', '22K', '21K', '18K'].map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                )}
                {calcMetal === 'silver' && (
                  <select
                    value={calcPuritySilver}
                    onChange={(e) => setCalcPuritySilver(e.target.value)}
                    className="py-3 px-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <option value="999">999</option>
                    <option value="925">925</option>
                  </select>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <label className="block">
                  <span className="text-[11px] text-[var(--text-dim)] font-bold uppercase">Grams fine</span>
                  <input
                    type="number"
                    step="any"
                    className="mt-1 w-full py-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                    value={calcGrams}
                    onChange={(e) => setCalcGrams(Number(e.target.value))}
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="text-[11px] text-[var(--text-dim)] font-bold uppercase">Start date</span>
                  <input
                    type="date"
                    className="mt-1 w-full py-3 px-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                    value={calcStart}
                    onChange={(e) => setCalcStart(e.target.value)}
                  />
                </label>
              </div>
              {calcResult ? (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border bg-[#121519]" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">Past reference AED</div>
                    <div className="text-lg font-black text-[var(--text-primary)] tabular-nums">
                      {calcResult.pastTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border bg-[#121519]" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-[10px] uppercase text-[var(--text-dim)] font-bold">
                      Today indicative AED (ticker payload)
                    </div>
                    <div className="text-lg font-black text-emerald-300 tabular-nums">
                      {calcResult.nowTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-[rgba(232,195,74,0.35)] bg-[rgba(232,195,74,0.06)]">
                    <div className="text-[10px] uppercase text-[var(--gold)] font-bold">Reference move</div>
                    <div className="text-lg font-black gradient-gold-text tabular-nums">
                      {calcResult.chgPct != null ? `${calcResult.chgPct >= 0 ? '+' : ''}${calcResult.chgPct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Pick dates within the fetched history window, ensure live spot exposes this metal purity, and set{' '}
                  <code className="text-[var(--text-soft)]">GOLD_API_KEY</code> so history resolves.
                </p>
              )}
            </section>
          </FadeIn>

          {/* Education */}
          <FadeIn delay={0.06}>
            <section className="rounded-2xl p-6 lg:p-8 mb-20" style={{ border: '1px solid var(--border)', background: '#0e1116' }}>
              <h3 className="text-lg font-black text-[var(--text-primary)] mb-6 flex items-center gap-2">
                <Shield className="text-[var(--gold)]" />
                Modeling notes
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-xs text-[var(--text-muted)] leading-relaxed">
                <EducationCard title="Premium vs spot" icon={Store}>
                  Illustrative retail composites often bury making charges inside “spot-priced” storefronts — we surface them as modeled buy-side premiums.
                </EducationCard>
                <EducationCard title="Sell liquidity" icon={Scale}>
                  Buyback markdowns consume returns on exit — especially when benchmark prices rise and percentage haircuts widen in absolute AED.
                </EducationCard>
                <EducationCard title="Cridora disclosures" icon={Sparkles}>
                  Platform fees publish from live config alongside vendor quotes — see Marketplace + How It Works rather than unnamed bank PDFs.
                </EducationCard>
              </div>
              <p className="mt-10 text-[10px] md:text-[11px] leading-relaxed text-[var(--text-dim)] max-w-4xl mx-auto text-center pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
                <strong>Disclaimer:</strong> Illustrative composites only — not advertisements for any UAE bank/app. History requires server{' '}
                <code className="text-[var(--text-soft)]">GOLD_API_KEY</code>; spot/ticker pulls from Gold API benchmarks + AED conversion. Metals remain with UAE vendors — Cridora is not a custodian &amp;
                none of this constitutes investment advice.
              </p>
            </section>
          </FadeIn>
        </div>
      </section>
    </main>
    </>
  )
}

function EducationCard({ title, icon, children }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#13161c', border: '1px solid var(--border)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-red-300 border border-red-500/30">
        {createElement(icon, { size: 18, 'aria-hidden': true })}
      </div>
      <h4 className="font-bold text-[var(--text-primary)] mb-2">{title}</h4>
      <p>{children}</p>
    </div>
  )
}
