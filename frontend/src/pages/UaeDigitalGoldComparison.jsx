import { useCallback, useEffect, useMemo, useRef, useState, createElement } from 'react'
import { Link } from 'react-router-dom'
import { motion as Motion, useInView } from 'framer-motion'
import {
  ArrowRight,
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
import PublicTrustBar from '../components/PublicTrustBar'
import SeoHead from '../components/SeoHead'
import { API_AUTH_BASE, API_METAL_HISTORY, API_SPOT_PRICES, SITE_ORIGIN } from '../config'
import { STATIC_COMPETITORS } from '../features/tools/comparisonPlatforms.js'
import {
  computeRows,
  mergeCridoraPlatform,
  summariesFromRows,
} from '../features/tools/comparisonCalculations.js'
import { cacheAge, readCache, writeCache } from '../lib/apiCache'
import { readSpotPriceCache, spotPriceCacheAge, writeSpotPriceCache } from '../lib/spotPriceCache'

const TROY_OZ_GRAMS = 31.1035
const AVDP_OZ_GRAMS = 28.349523125

// Client-side freshness windows — skip a network round-trip entirely when the
// cached value is still within these thresholds (kept at/under backend cache TTLs
// so we never show data older than what the server itself would return).
const SPOT_FRESH_MS = 20 * 1000
const FEES_FRESH_MS = 5 * 60 * 1000
const HIST_FRESH_MS = 6 * 60 * 60 * 1000
const FEES_CACHE_KEY = 'platform_fees_v1'
const HIST_DAYS = 365

function historyCacheKey(metal, purity) {
  return `metal_history_v1:${metal}:${purity}:${HIST_DAYS}`
}

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <Motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </Motion.div>
  )
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
  if (metal === 'copper' && payload.copper) {
    const base = payload.copper['999'] ?? payload.copper.fine
    if (base == null) return null
    let m = 1
    const p = String(purityKey || '999').trim()
    if (p.replace(/\./g, '').replace(/\s/g, '').match(/^[0-9]+$/) && Number(p) <= 1000) {
      m = Number(p) / 1000
    } else if (p === '925') {
      m = 0.925
    }
    return Number(base) * m
  }
  return null
}

export default function UaeDigitalGoldComparison() {
  const [grams, setGrams] = useState(1)
  const [troyOz, setTroyOz] = useState((1 / TROY_OZ_GRAMS).toFixed(5))
  const [spotInput, setSpotInput] = useState(() => {
    const g24 = readSpotPriceCache()?.data?.gold?.['24K']
    return typeof g24 === 'number' && g24 > 0 ? String(g24.toFixed(2)) : ''
  })
  const [baselineSpot24k, setBaselineSpot24k] = useState(() => {
    const g24 = readSpotPriceCache()?.data?.gold?.['24K']
    return typeof g24 === 'number' && g24 > 0 ? g24 : null
  })
  const [spotPayload, setSpotPayload] = useState(() => readSpotPriceCache()?.data ?? null)
  const [spotNote, setSpotNote] = useState(() => {
    const n = readSpotPriceCache()?.data?.note
    return typeof n === 'string' && n.trim() ? n.trim() : ''
  })
  const [holdingYears, setHoldingYears] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [buyFeePct, setBuyFeePct] = useState(() => {
    const cached = readCache(FEES_CACHE_KEY)
    return cached?.buy_fee_pct != null ? Number(cached.buy_fee_pct) : 0.5
  })
  const [sellFeePct, setSellFeePct] = useState(() => {
    const cached = readCache(FEES_CACHE_KEY)
    return cached?.sell_fee_pct != null ? Number(cached.sell_fee_pct) : 0.5
  })

  const [histMetalView, setHistMetalView] = useState('gold')
  const [histViewMode, setHistViewMode] = useState('chart')
  const [histSeries, setHistSeries] = useState(() => {
    const cached = readCache(historyCacheKey('gold', '24K'))
    return cached && !cached.error ? cached : null
  })
  const [histLoading, setHistLoading] = useState(() => !readCache(historyCacheKey('gold', '24K')))
  const [histErrorCode, setHistErrorCode] = useState(null)

  const [calcMetal, setCalcMetal] = useState('gold')
  const [calcPurityGold, setCalcPurityGold] = useState('24K')
  const [calcPuritySilver, setCalcPuritySilver] = useState('999')
  const [calcPurityCopper, setCalcPurityCopper] = useState('999')
  const [calcGrams, setCalcGrams] = useState(10)
  const [calcStart, setCalcStart] = useState('')
  const [calcHist, setCalcHist] = useState(() => {
    const cached = readCache(historyCacheKey('gold', '24K'))
    return cached && !cached.error ? cached : null
  })
  const historyRequestsRef = useRef(new Map())

  const mergedPlatforms = useMemo(
    () => mergeCridoraPlatform(STATIC_COMPETITORS, buyFeePct, sellFeePct),
    [buyFeePct, sellFeePct],
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

  const histPurity = histMetalView === 'gold' ? '24K' : histMetalView === 'silver' ? '999' : '999'

  const calcPurityKey = useMemo(
    () =>
      calcMetal === 'gold'
        ? calcPurityGold
        : calcMetal === 'silver'
          ? calcPuritySilver
          : calcPurityCopper,
    [calcMetal, calcPurityGold, calcPuritySilver, calcPurityCopper],
  )

  const refreshSpot = useCallback(async (force = false) => {
    if (!force && spotPriceCacheAge() < SPOT_FRESH_MS) {
      // Cache is fresh enough (ticker already fetched/polled recently) — skip the network call.
      return
    }
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error('spot')
      const data = await res.json()
      writeSpotPriceCache(data)
      setSpotPayload(data)
      const g24 = data.gold && typeof data.gold['24K'] === 'number' ? data.gold['24K'] : null
      if (g24 != null && g24 > 0) {
        setBaselineSpot24k(g24)
        setSpotInput(String(g24.toFixed(2)))
      }
      const n = typeof data.note === 'string' && data.note.trim() ? data.note.trim() : ''
      setSpotNote(n)
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    void refreshSpot(false)
  }, [refreshSpot])

  useEffect(() => {
    let cancelled = false
    if (cacheAge(FEES_CACHE_KEY) < FEES_FRESH_MS) {
      // Fee % changes rarely — a recent cached value is good enough, skip the request.
      return
    }
    fetch(`${API_AUTH_BASE}/platform-fees/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return
        writeCache(FEES_CACHE_KEY, data)
        if (data.buy_fee_pct != null) setBuyFeePct(Number(data.buy_fee_pct))
        if (data.sell_fee_pct != null) setSellFeePct(Number(data.sell_fee_pct))
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
    return { a, b, pct, label: histMetalView === 'gold' ? 'Gold' : histMetalView === 'silver' ? 'Silver' : 'Copper' }
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

  function syncTroyOz(ozStr) {
    const oz = Number(ozStr) || 0
    if (!(oz > 0)) return
    const g = oz * TROY_OZ_GRAMS
    syncGrams(g)
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
      'Interactive UAE digital gold comparison and metal value benchmarking against illustrative bank and retail composites using a shared AED spot reference.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'AED',
    },
  }

  return (
    <>
      <SeoHead
        title="UAE Digital Gold Platform Comparison"
        description="UAE digital gold comparison with indicative AED spot, live Cridora platform fee disclosure, illustrative bank versus retail composites, and historic metals charts — educational only."
        path="/tools/uae-digital-gold-comparison"
        jsonLd={toolJsonLd}
      />
      <main className="min-w-0 w-full max-w-[100vw] overflow-x-hidden box-border overscroll-x-contain">
      <div className="pt-[calc(5.5rem+env(safe-area-inset-top,0px))]">
        <SpotPriceTicker />
      </div>

      <section className="relative pt-10 pb-12 overflow-hidden" style={{ background: 'var(--section-wash-a)' }}>
        <div className="max-w-7xl mx-auto px-3 min-[400px]:px-4 sm:px-6 lg:px-8 min-w-0">
          <FadeIn>
            <div className="mb-10">
              <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-3">
                Tools · transparency
              </p>
              <h1 className="text-[1.25rem] min-[390px]:text-2xl sm:text-3xl md:text-5xl font-black text-[var(--text-primary)] leading-tight mb-4 hyphens-auto">
                UAE digital gold comparison{' '}
                <span className="gradient-gold-text">vs illustrative retail &amp; bank friction</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)] max-w-3xl leading-relaxed mb-4">
                This page uses the <strong className="text-[var(--text-soft)] font-semibold">same public AED spot payload</strong> as
                Cridora’s header ticker plus your <strong className="text-[var(--text-soft)] font-semibold">live platform fee %</strong>{' '}
                (buy/sell). Competitor profiles are composites for education only — they are{' '}
                <strong className="text-[var(--text-soft)] font-semibold">not</strong> binding quotes from any named institution.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}
                >
                  How fees &amp; quotes work <ArrowRight size={13} />
                </Link>
                <Link to="/marketplace">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.25)] text-[var(--gold)] font-semibold">
                    Live marketplace listings
                  </span>
                </Link>
                <a
                  href="/#gold-market-matrix-heading"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[var(--text-muted)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Open live rate matrix <BarChart3 size={14} />
                </a>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="mb-12 max-w-4xl">
              <PublicTrustBar />
            </div>
          </FadeIn>

          {/* Simulation + summary cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 min-w-0">
            <div
              className="lg:col-span-5 rounded-2xl p-4 sm:p-6 lg:p-7 min-w-0 max-w-full"
              style={{
                background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                border: '1px solid var(--border)',
              }}
            >
              <h2 className="text-lg font-bold text-[var(--text-primary)] mb-5 flex items-center gap-2">
                <Scale size={18} className="text-[var(--gold)]" aria-hidden /> Simulation inputs
              </h2>

              <div className="mb-5 p-4 rounded-xl" style={{ background: '#0f1114', border: '1px solid var(--border)' }}>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3 font-bold">
                  Weight (24K reference spot)
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase">Grams</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border text-[var(--text-muted)]"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => syncGrams(gramSafe - 0.5)}
                        aria-label="Decrease grams"
                      >
                        <Minus size={16} aria-hidden />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className="flex-1 min-w-0 text-center py-2 rounded-lg bg-[#121519] border text-[var(--text-primary)] font-bold"
                        style={{ borderColor: 'var(--border)' }}
                        value={grams}
                        onChange={(e) => syncGrams(Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border text-[var(--text-muted)]"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => syncGrams(gramSafe + 0.5)}
                        aria-label="Increase grams"
                      >
                        <Plus size={16} aria-hidden />
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase">
                      Troy ounces
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      className="mt-1 w-full text-center py-2 rounded-lg bg-[#121519] border text-[var(--text-primary)] font-bold"
                      style={{ borderColor: 'var(--border)' }}
                      value={troyOz}
                      onChange={(e) => syncTroyOz(e.target.value)}
                    />
                  </label>
                </div>
                <p className="text-right text-[10px] text-[var(--text-dim)] mb-4">
                  ≈ {stdOz} avdp oz
                </p>
                <input
                  type="range"
                  min={1}
                  max={300}
                  value={clamp(Math.round(gramSafe), 1, 300)}
                  onChange={(e) => syncGrams(Number(e.target.value))}
                  className="w-full accent-[var(--gold)]"
                  aria-label="Grams slider"
                />
              </div>

              <label className="block mb-5">
                <span className="text-sm font-semibold text-[var(--text-soft)] mb-2 block">
                  Reference spot AED/g · 24K (same feed as ticker; illustrative)
                </span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 py-3 px-4 rounded-xl bg-[#121519] border text-right text-lg font-bold text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                    value={spotInput}
                    onChange={(e) => setSpotInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="shrink-0 px-3 rounded-xl text-xs font-semibold uppercase tracking-wide text-[var(--gold)] border"
                    style={{ borderColor: 'rgba(201,168,76,0.35)' }}
                    onClick={() => {
                      void refreshSpot(true)
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </label>

              <label className="block mb-4">
                <div className="flex justify-between text-sm font-semibold text-[var(--text-soft)] mb-2">
                  <span>Illustrative holding period</span>
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

              <div
                className="rounded-xl p-4 text-xs leading-relaxed"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
              >
                <p className="text-emerald-200/95">
                  <strong className="text-emerald-300">Live Cridora model:</strong> buy fee{' '}
                  <strong>{buyFeePct}%</strong> · sell fee <strong>{sellFeePct}%</strong> pulled from marketplace config.
                  This is illustrative; each paid order reflects the quoted vendor metal line + disclosed platform fee at checkout.
                </p>
              </div>

              {spotNote && (
                <p className="text-[10px] text-[var(--text-dim)] mt-4 leading-snug">{spotNote}</p>
              )}
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch min-w-0 max-w-full">
              <CardStat
                eyebrow="Cridora friction"
                title="Synthetic round-trip vs same spot reference above"
                tone="good"
                value={
                  summary.cridoraCalc
                    ? `${summary.cridoraCalc.roundtripCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })} AED`
                    : '—'
                }
                foot={`${summary.cridoraCalc ? summary.cridoraCalc.roundtripPct.toFixed(2) : '—'}% of reference value`}
              />
              <CardStat
                eyebrow="Composite friction"
                title="Mean across illustrative bank / app stacks"
                tone="warn"
                value={`${summary.avgRoundtripCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })} AED`}
                foot={`Held ${holdingYears} yr`}
              />
              <div className="md:col-span-2 rounded-2xl p-6 border-2" style={{ borderColor: 'rgba(201,168,76,0.35)', background: '#101215' }}>
                <div className="flex gap-4">
                  <div
                    className="p-3 rounded-xl shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.05))' }}
                  >
                    <Calculator className="text-[var(--gold)]" size={22} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--gold)]">
                      Estimated advantage
                    </span>
                    <h3 className="text-xl font-black text-[var(--text-primary)] mt-1">
                      {summary.directCashSavings > 0
                        ? `Up to ${summary.directCashSavings.toLocaleString('en-AE', { minimumFractionDigits: 2 })} AED less friction vs composites`
                        : 'Cridora remains lower than all composites modeled here'}
                    </h3>
                    <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <MiniStat label="Δ vs avg composite (AED)" value={Math.max(summary.directCashSavings, 0)} />
                      <MiniStat label="Break-even hurdle (Cridora)" pct={summary.cridoraCalc?.breakEvenPct} />
                      <MiniStat label="Break-even hurdle (avg)" pct={summary.avgBreakeven} warn />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <FadeIn delay={0.06}>
            <section
              className="rounded-2xl overflow-hidden mb-12 min-w-0 max-w-full"
              style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border)' }}
            >
              <div className="px-5 py-4 border-b flex flex-col lg:flex-row gap-4 lg:items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Table2 size={20} className="text-[var(--gold)]" aria-hidden /> Matrix
                  </h2>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Modelled stacks using the same gram reference for buy/sell; not executable quotes from third parties.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {['all', 'banks', 'retail'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCategoryFilter(k)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide"
                      style={
                        categoryFilter === k
                          ? { background: 'rgba(201,168,76,0.25)', color: 'var(--text-primary)', border: '1px solid var(--gold)' }
                          : { background: '#121519', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase border flex items-center gap-2"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                  >
                    <Printer size={14} /> Export
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-hidden scroll-smooth [-webkit-overflow-scrolling:touch] touch-pan-x">
                <table className="min-w-[1100px] w-full text-left text-xs md:text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-[var(--text-dim)] border-b" style={{ borderColor: 'var(--border)' }}>
                      <th className="py-4 px-4 font-bold">Platform</th>
                      <th className="py-4 px-2 text-right font-bold">Metal ref</th>
                      <th className="py-4 px-2 text-right font-bold text-red-300">Buy friction</th>
                      <th className="py-4 px-2 text-right font-bold text-amber-300">Custody yr</th>
                      <th className="py-4 px-2 text-right font-bold text-red-300">Sell friction</th>
                      <th className="py-4 px-3 text-right font-bold text-emerald-300 bg-emerald-950/15">Round-trip AED</th>
                      <th className="py-4 px-4 text-right font-bold text-[var(--gold)]">Modeled keep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((c) => (
                      <tr
                        key={c.id}
                        style={
                          c.highlight
                            ? { background: 'rgba(16,185,129,0.06)', borderLeft: '4px solid #34d399' }
                            : { borderBottom: '1px solid var(--border)' }
                        }
                      >
                        <td className="py-4 px-4">
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
                        <td className="py-4 px-2 text-right tabular-nums text-[var(--text-muted)]">
                          {c.baseValue.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-2 text-right tabular-nums text-red-200">
                          {(c.buyMarkupAED + c.buyFeeAED).toLocaleString('en-AE', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-4 px-2 text-right tabular-nums text-amber-100/90">
                          {c.compoundCustodyAED.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-2 text-right tabular-nums text-red-200">
                          {(c.sellMarkdownAED + c.sellExitFeeAED + c.sellFeeOnBase).toLocaleString(
                            'en-AE',
                            { minimumFractionDigits: 2 },
                          )}
                        </td>
                        <td className="py-4 px-3 text-right font-black tabular-nums text-emerald-300 bg-emerald-950/10">
                          {c.roundtripCost.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                          <div className="text-[10px] font-normal text-emerald-200/70">
                            {c.roundtripPct.toFixed(2)}%
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right tabular-nums font-semibold">
                          {c.finalHoldKeep.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
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
                  {['gold', 'silver', 'copper'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setHistMetalView(m)}
                      className="px-3 py-2 rounded-xl text-[11px] font-bold capitalize"
                      style={
                        histMetalView === m
                          ? { background: 'rgba(201,168,76,0.25)', color: 'var(--text-primary)', border: '1px solid var(--gold)' }
                          : { background: '#121519', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {m}
                    </button>
                  ))}
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      className={`px-3 py-2 text-[11px] font-bold flex items-center gap-1 ${histViewMode === 'chart' ? 'bg-[rgba(201,168,76,0.2)] text-[var(--text-primary)]' : 'bg-[#121519] text-[var(--text-dim)]'}`}
                      onClick={() => setHistViewMode('chart')}
                    >
                      <LineChartIcon size={14} /> Chart
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-2 text-[11px] font-bold flex items-center gap-1 ${histViewMode === 'table' ? 'bg-[rgba(201,168,76,0.2)] text-[var(--text-primary)]' : 'bg-[#121519] text-[var(--text-dim)]'}`}
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
                          border: '1px solid rgba(201,168,76,0.35)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(_, payload) =>
                          payload && payload[0] ? String(payload[0].payload.iso) : ''
                        }
                        formatter={(v) =>
                          `${Number(v).toLocaleString('en-AE', { minimumFractionDigits: histMetalView === 'silver' ? 3 : histMetalView === 'copper' ? 4 : 2 })} AED/g`
                        }
                      />
                      <Line type="monotone" dataKey="v" stroke="#C9A84C" strokeWidth={2} dot={false} />
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
                  Fees on-app are flat % — they do not scale with hidden FX spreads modeled for banks here. Checkout always reflects{' '}
                  <Link to="/how-it-works" className="underline">
                    disclosed vendor quotes
                  </Link>
                  .
                </p>
              </div>
            </aside>
          </div>

          {/* Friction bar chart + break-even */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 min-w-0">
            <section className="lg:col-span-7 rounded-2xl p-4 sm:p-6 min-w-0 max-w-full" style={{ border: '1px solid var(--border)', background: '#0f1115' }}>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
                <BarChart3 className="text-[var(--gold)]" /> Round-trip friction (lower is better)
              </h3>
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
                  <option value="copper">Copper (HG benchmark)</option>
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
                {calcMetal === 'copper' && (
                  <select
                    value={calcPurityCopper}
                    onChange={(e) => setCalcPurityCopper(e.target.value)}
                    className="py-3 px-3 rounded-xl bg-[#121519] border text-[var(--text-primary)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <option value="999">999 fine (modeled)</option>
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
                  <div className="p-4 rounded-xl border border-[rgba(201,168,76,0.35)] bg-[rgba(201,168,76,0.06)]">
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

function CardStat({ eyebrow, title, tone, value, foot }) {
  const bd = tone === 'good' ? 'rgba(16,185,129,0.5)' : 'rgba(251,191,36,0.4)'
  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: '#101318', border: `2px solid ${bd}` }}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: tone === 'good' ? '#6ee7b7' : '#fcd34d' }}>
        {eyebrow}
      </p>
      <h4 className="text-xl font-black text-[var(--text-primary)] mt-2">{title}</h4>
      <p className={`text-2xl md:text-3xl font-black mt-8 ${tone === 'good' ? 'text-emerald-400' : 'text-amber-300'}`}>{value}</p>
      <p className="text-[11px] text-[var(--text-dim)] mt-3">{foot}</p>
    </div>
  )
}

function MiniStat({ label, value, pct, warn }) {
  return (
    <div>
      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-dim)] block">{label}</span>
      <span className={`text-base font-black tabular-nums ${warn ? 'text-red-400' : 'text-emerald-400'}`}>
        {pct != null ? `+${Number(pct).toFixed(2)}%` : value != null ? value.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
      </span>
    </div>
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
