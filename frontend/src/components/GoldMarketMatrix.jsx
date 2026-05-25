import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Gem, Landmark, LineChart, Smartphone, Store } from 'lucide-react'
import { API_MARKET_MATRIX } from '../config'
import { usePoll } from '../hooks/usePoll'
import { MARKET_MATRIX_POLL_MS } from '../config/pollIntervals'
import { subscribePricesRefresh } from '../lib/pricesRefresh'

const SEGMENT_ICONS = {
  cridora: Gem,
  global_spot: LineChart,
  mks_pamp: Landmark,
  mint_jewels: Store,
  malabar: Store,
  sky_jewellery: Store,
  joyalukkas: Store,
  enbd: Building2,
  adcb: Building2,
  cbd: Building2,
  mashreq: Building2,
  emoney: Smartphone,
  mgw: Smartphone,
  ogold: Smartphone,
  isa: Landmark,
}

function formatAed(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function availabilityLabel(code) {
  if (code === 'live') return 'Live'
  if (code === 'cached') return 'Last saved'
  return code || '—'
}

function availabilityClass(code) {
  if (code === 'live') {
    return 'text-emerald-400/90 border-emerald-500/25 bg-emerald-500/10'
  }
  if (code === 'cached') {
    return 'text-amber-300/90 border-amber-500/25 bg-amber-500/10'
  }
  return 'text-[var(--text-dim)] border-[var(--silver-12)] bg-[var(--silver-05)]'
}

function formatUpdatedAt(value) {
  if (!value) return null
  const asDate = Date.parse(value)
  if (!Number.isNaN(asDate)) {
    try {
      return new Date(asDate).toLocaleString('en-AE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function deltaClass(delta) {
  if (delta == null) return 'text-[var(--text-dim)]'
  if (delta > 0) return 'text-amber-300/90'
  if (delta < 0) return 'text-emerald-400/90'
  return 'text-[var(--text-muted)]'
}

function formatDelta(delta, pct) {
  if (delta == null) return '—'
  const sign = delta > 0 ? '+' : ''
  const pctPart = pct != null ? ` (${sign}${pct}%)` : ''
  return `${sign}${formatAed(delta)}${pctPart}`
}

/** Non-Cridora rows shown as Retailer 1…N — no third-party business names on this page. */
function retailerIndexMap(rows) {
  const m = new Map()
  let n = 0
  for (const r of rows) {
    if (r?.is_cridora === true) continue
    const id = r?.id
    if (id == null || m.has(id)) continue
    n += 1
    m.set(id, n)
  }
  return m
}

function anonymizedMatrixName(row, indices) {
  if (row?.is_cridora === true) return row?.name ?? 'Cridora'
  const i = indices.get(row?.id)
  return i != null ? `Retailer ${i}` : 'Retailer'
}

function anonymizedMatrixSegment(row) {
  if (row?.is_cridora === true) return row?.segment ?? ''
  return 'UAE market · illustrative reference'
}

export default function GoldMarketMatrix() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchMatrix = useCallback(async (isInitial) => {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch(API_MARKET_MATRIX, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(false)
    } catch {
      if (isInitial) {
        setData(null)
        setError(true)
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMatrix(true)
  }, [fetchMatrix])

  useEffect(() => subscribePricesRefresh(() => { void fetchMatrix(false) }), [fetchMatrix])

  usePoll(() => fetchMatrix(false), MARKET_MATRIX_POLL_MS, true)

  const rows = useMemo(
    () => (Array.isArray(data?.rows) ? data.rows : []),
    [data],
  )

  const retailerIndices = useMemo(() => retailerIndexMap(rows), [rows])

  const updatedLabel = useMemo(() => {
    if (!data?.updated_at) return null
    try {
      return new Date(data.updated_at).toLocaleString('en-AE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return null
    }
  }, [data?.updated_at])

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

      <div className="max-w-7xl mx-auto w-full min-w-0 px-3 min-[400px]:px-4 sm:px-6 relative z-10">
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
            Only published rates from public sources are shown — no estimates. When a source
            is temporarily down, the last saved rate appears with its update time. Only channels
            priced above Cridora&apos;s reference 24K are listed.
          </p>
        </div>

        <div
          className="rounded-xl border overflow-hidden min-w-0 max-w-full w-full"
          style={{
            background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)',
            borderColor: 'var(--silver-12)',
          }}
        >
          <div
            className="px-3 sm:px-5 py-3 sm:py-4 border-b flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 min-w-0 w-full"
            style={{ borderColor: 'var(--silver-12)' }}
          >
            <div className="flex items-start sm:items-center gap-2 min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse shrink-0 mt-1 sm:mt-0" />
              <span className="text-sm font-semibold text-[var(--text-primary)] leading-snug break-words text-left">
                Market price comparison
              </span>
            </div>
            {updatedLabel && !loading && (
              <span className="text-[10px] text-[var(--text-dim)] tracking-wide leading-snug break-words text-left sm:text-right max-w-full min-w-0 pl-7 sm:pl-0">
                Matrix refreshed {updatedLabel}
              </span>
            )}
          </div>

          {loading && (
            <p className="text-center text-sm text-[var(--text-muted)] py-12">
              Loading market comparison…
            </p>
          )}

          {!loading && error && (
            <p className="text-center text-sm text-[var(--text-muted)] py-12 px-6">
              Market comparison is temporarily unavailable. Please try again shortly.
            </p>
          )}

          {!loading && !error && rows.length === 1 && rows[0]?.is_cridora && (
            <p className="text-center text-sm text-[var(--text-muted)] py-12 px-6">
              No other published rates are currently above Cridora&apos;s reference. Check back
              after the next market refresh.
            </p>
          )}

          {!loading && !error && rows.length > 0 && !(rows.length === 1 && rows[0]?.is_cridora) && (
            <div className="overflow-x-auto overflow-y-hidden w-full max-w-full min-w-0 scroll-smooth [-webkit-overflow-scrolling:touch] touch-pan-x">
              <table className="w-full min-w-full sm:min-w-[560px] md:min-w-[640px] text-left border-collapse">
                <thead>
                  <tr
                    className="text-[10px] uppercase tracking-wider font-bold"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    <th className="py-2.5 sm:py-3 pl-3 sm:pl-6 pr-2 sm:pr-3">Entity</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-3 hidden sm:table-cell">Segment</th>
                    <th className="py-2.5 sm:py-3 px-2 text-right whitespace-nowrap">24K</th>
                    <th className="py-2.5 sm:py-3 px-2 text-right whitespace-nowrap">22K</th>
                    <th className="py-2.5 sm:py-3 px-2 text-right whitespace-nowrap hidden md:table-cell">vs Cridora</th>
                    <th className="py-2.5 sm:py-3 px-2 hidden lg:table-cell">Source updated</th>
                    <th className="py-2.5 sm:py-3 pr-3 sm:pr-6 pl-2 text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const Icon = SEGMENT_ICONS[row.id] || LineChart
                    const isCridora = row.is_cridora === true
                    return (
                      <tr
                        key={row.id}
                        className="border-t transition-colors hover:bg-[var(--silver-05)]"
                        style={{
                          borderColor: 'var(--silver-08)',
                          background: isCridora
                            ? 'color-mix(in srgb, var(--gold) 8%, transparent)'
                            : undefined,
                        }}
                      >
                        <td className="py-3 sm:py-4 pl-3 sm:pl-6 pr-2 align-top">
                          <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                            <div
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: isCridora
                                  ? 'color-mix(in srgb, var(--gold) 15%, transparent)'
                                  : 'var(--silver-05)',
                                border: `1px solid ${isCridora ? 'color-mix(in srgb, var(--gold) 30%, transparent)' : 'var(--silver-12)'}`,
                              }}
                            >
                              <Icon
                                size={16}
                                style={{ color: isCridora ? 'var(--gold)' : 'var(--text-muted)' }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-xs sm:text-sm font-semibold break-words"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {anonymizedMatrixName(row, retailerIndices)}
                                {isCridora && (
                                  <span className="ml-2 text-[9px] uppercase tracking-wider text-[var(--gold)] font-bold whitespace-normal">
                                    You are here
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-[var(--text-dim)] mt-0.5 sm:hidden">
                                {anonymizedMatrixSegment(row)}
                              </p>
                              {isCridora && row.note && (
                                <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug max-w-[min(100%,20rem)] break-words md:max-w-md">
                                  {row.note}
                                </p>
                              )}
                              {row.source_updated_at && (
                                <p className="text-[10px] text-[var(--text-dim)] mt-1 lg:hidden">
                                  Updated {formatUpdatedAt(row.source_updated_at)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 sm:py-4 px-2 hidden sm:table-cell align-top">
                          <span className="text-xs text-[var(--text-muted)] break-words">
                            {anonymizedMatrixSegment(row)}
                          </span>
                        </td>
                        <td className="py-3 sm:py-4 px-2 text-right tabular-nums align-top whitespace-nowrap">
                          <span
                            className="text-xs sm:text-sm font-bold inline-block leading-snug"
                            style={{ color: isCridora ? 'var(--gold)' : 'var(--text-primary)' }}
                          >
                            {row.rate_24k != null ? (
                              <>
                                <span className="text-[var(--text-dim)] font-semibold mr-0.5 sm:mr-1 text-[10px] sm:text-xs">
                                  AED
                                </span>
                                {formatAed(row.rate_24k)}
                              </>
                            ) : (
                              '—'
                            )}
                          </span>
                        </td>
                        <td className="py-3 sm:py-4 px-2 text-right tabular-nums align-top whitespace-nowrap">
                          <span className="inline-block text-xs sm:text-sm font-medium leading-snug text-[var(--text-soft)]">
                            {row.rate_22k != null ? (
                              <>
                                <span className="text-[var(--text-dim)] font-semibold mr-0.5 sm:mr-1 text-[10px] sm:text-xs">
                                  AED
                                </span>
                                {formatAed(row.rate_22k)}
                              </>
                            ) : (
                              '—'
                            )}
                          </span>
                        </td>
                        <td
                          className={`py-3 sm:py-4 px-2 text-right text-[11px] sm:text-xs font-semibold tabular-nums whitespace-nowrap hidden md:table-cell align-top ${deltaClass(row.delta_vs_cridora_aed)}`}
                        >
                          {formatDelta(row.delta_vs_cridora_aed, row.delta_vs_cridora_pct)}
                        </td>
                        <td className="py-3 sm:py-4 px-2 hidden lg:table-cell align-top">
                          <span className="text-[10px] text-[var(--text-dim)] break-words">
                            {formatUpdatedAt(row.source_updated_at) || '—'}
                          </span>
                        </td>
                        <td className="py-3 sm:py-4 pr-3 sm:pr-6 pl-2 text-center align-top">
                          <span
                            className={`inline-block max-w-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-1 rounded-full border leading-tight break-words text-center whitespace-normal hyphens-auto ${availabilityClass(row.availability)}`}
                          >
                            {availabilityLabel(row.availability)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data?.disclaimer && !loading && !error && (
            <p className="text-[10px] text-[var(--text-dim)] leading-relaxed px-3 sm:px-6 py-4 border-t break-words hyphens-auto" style={{ borderColor: 'var(--silver-08)' }}>
              {data.disclaimer}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
