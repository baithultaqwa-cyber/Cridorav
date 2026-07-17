import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Sparkles, Store } from 'lucide-react'
import { API_SPOT_PRICES } from '../config'
import { STATIC_COMPETITORS } from '../features/tools/comparisonPlatforms.js'
import {
  computeRows,
  mergeCridoraPlatform,
  summaryByCategory,
} from '../features/tools/comparisonCalculations.js'
import {
  readSpotPriceCache,
  SPOT_FRESH_MS,
  spotPriceCacheAge,
  writeSpotPriceCache,
} from '../lib/spotPriceCache'
import {
  fetchPlatformFees,
  PLATFORM_FEE_FRESH_MS,
  platformFeeCacheAge,
  readCachedPlatformFees,
} from '../lib/platformFees'

/**
 * Minimalised, instant-loading homepage teaser for the full comparison tool
 * (`/tools/uae-digital-gold-comparison`). Reuses the same illustrative
 * composite math + shared localStorage caches (spot, platform fees) as the
 * full tool — no live scraping, so it renders from cache on every visit
 * instead of blocking on a network round-trip.
 */

const REFERENCE_GRAMS = 1
const HOLDING_YEARS = 1

const CATEGORY_META = {
  banks: { label: 'Bank-style gold accounts', icon: Building2 },
  retail: { label: 'Retail & jewellers', icon: Store },
}

function formatAed(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function GoldMarketMatrix() {
  const [buyFeePct, setBuyFeePct] = useState(() => {
    const cached = readCachedPlatformFees()
    return cached?.buy_fee_pct != null ? Number(cached.buy_fee_pct) : 0.5
  })
  const [sellSharePct, setSellSharePct] = useState(() => {
    const cached = readCachedPlatformFees()
    return cached?.sell_share_pct != null ? Number(cached.sell_share_pct) : 5
  })
  const [spot24k, setSpot24k] = useState(() => {
    const g24 = readSpotPriceCache()?.data?.gold?.['24K']
    return typeof g24 === 'number' && g24 > 0 ? g24 : null
  })

  useEffect(() => {
    let cancelled = false
    if (platformFeeCacheAge() < PLATFORM_FEE_FRESH_MS) return
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

  useEffect(() => {
    let cancelled = false
    if (spotPriceCacheAge() < SPOT_FRESH_MS) return
    fetch(API_SPOT_PRICES, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return
        writeSpotPriceCache(data)
        const g24 = data.gold && typeof data.gold['24K'] === 'number' ? data.gold['24K'] : null
        if (g24 != null && g24 > 0) setSpot24k(g24)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const mergedPlatforms = useMemo(
    () => mergeCridoraPlatform(STATIC_COMPETITORS, buyFeePct, sellSharePct),
    [buyFeePct, sellSharePct],
  )

  const calculatedRows = useMemo(
    () => computeRows(mergedPlatforms, REFERENCE_GRAMS, spot24k ?? 0, HOLDING_YEARS),
    [mergedPlatforms, spot24k],
  )

  const { cridoraCalc, byCategory } = useMemo(
    () => summaryByCategory(calculatedRows),
    [calculatedRows],
  )

  const ready = spot24k != null

  const maxPct = Math.max(
    cridoraCalc?.roundtripPct ?? 0,
    ...byCategory.map((c) => c.avgRoundtripPct),
    0.01,
  )

  return (
    <section
      className="py-14 sm:py-16 md:py-20 relative w-full max-w-[100vw] min-w-0 overflow-x-hidden box-border"
      style={{ background: 'var(--section-wash-b, var(--section-wash-a))' }}
      aria-labelledby="gold-market-matrix-heading"
    >
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, var(--gold) 6%, transparent), transparent 70%)',
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto w-full min-w-0 px-3 min-[400px]:px-4 sm:px-6 relative z-10">
        <div className="mb-8 md:mb-10 text-center max-w-3xl mx-auto min-w-0 px-1">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-3">
            UAE gold landscape
          </p>
          <h2
            id="gold-market-matrix-heading"
            className="text-xl sm:text-2xl md:text-4xl font-black leading-tight mb-4 px-1 break-words"
          >
            <span style={{ color: 'var(--text-primary)' }}>How rates compare</span>{' '}
            <span className="gradient-gold-text">across the market</span>
          </h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed px-1 break-words">
            A quick illustrative snapshot of Cridora&apos;s live platform fee against modeled
            bank and retail friction &mdash; same math as the{' '}
            <Link to="/tools/uae-digital-gold-comparison" className="underline text-[var(--gold)]">
              full comparison tool
            </Link>
            . Composites only, not offers from any named institution.
          </p>
        </div>

        <div
          className="rounded-xl border overflow-hidden min-w-0 max-w-full w-full p-4 sm:p-6"
          style={{
            background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
            borderColor: 'var(--silver-12)',
          }}
        >
          {!ready ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-10">
              Loading comparison&hellip;
            </p>
          ) : (
            <div className="space-y-4">
              <MiniFrictionRow
                icon={Sparkles}
                label="Cridora (marketplace)"
                badge={`Live fee: ${buyFeePct}% buy · ${sellSharePct}% of profit on sell-back`}
                pct={cridoraCalc?.roundtripPct ?? 0}
                aed={cridoraCalc?.roundtripCost ?? 0}
                maxPct={maxPct}
                highlight
              />
              {byCategory.map((c) => {
                const meta = CATEGORY_META[c.category] || { label: c.category, icon: Store }
                return (
                  <MiniFrictionRow
                    key={c.category}
                    icon={meta.icon}
                    label={meta.label}
                    badge={`Avg. of ${c.count} illustrative composites`}
                    pct={c.avgRoundtripPct}
                    aed={c.avgRoundtripCost}
                    maxPct={maxPct}
                  />
                )
              })}
            </div>
          )}

          <div
            className="mt-6 pt-5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            style={{ borderColor: 'var(--silver-08)' }}
          >
            <p className="text-[10px] text-[var(--text-dim)] leading-relaxed max-w-md">
              Round-trip friction on a 1g reference at the current AED spot, held {HOLDING_YEARS} yr.
              Illustrative only &mdash; checkout always reflects each vendor&apos;s disclosed quote.
            </p>
            <Link
              to="/tools/uae-digital-gold-comparison"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--gold)] whitespace-nowrap"
            >
              Full matrix &amp; calculator <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function MiniFrictionRow({ icon: Icon, label, badge, pct, aed, maxPct, highlight = false }) {
  const width = maxPct > 0 ? Math.min(100, (pct / maxPct) * 100) : 0
  return (
    <div
      className="rounded-xl border p-3.5 sm:p-4"
      style={
        highlight
          ? { borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.06)' }
          : { borderColor: 'var(--silver-12)', background: 'var(--silver-05)' }
      }
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: highlight ? 'rgba(16,185,129,0.15)' : 'var(--silver-08)',
              color: highlight ? '#34d399' : 'var(--text-muted)',
            }}
          >
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">{label}</p>
            <p className="text-[10px] text-[var(--text-dim)] truncate">{badge}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="text-sm sm:text-base font-black tabular-nums"
            style={{ color: highlight ? '#34d399' : 'var(--text-primary)' }}
          >
            {pct.toFixed(2)}%
          </div>
          <div className="text-[10px] text-[var(--text-dim)] tabular-nums">{formatAed(aed)} AED</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--silver-08)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${width}%`,
            background: highlight ? 'linear-gradient(90deg,#059669,#34d399)' : 'linear-gradient(90deg,#78350f,#d97706)',
          }}
        />
      </div>
    </div>
  )
}
