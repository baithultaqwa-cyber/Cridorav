import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Activity, Info } from 'lucide-react'
import {
  normalizeHoldings,
  holdingLotKey,
  metalOptionsFromRows,
  purityOptionsForMetal,
  vendorOptionsForMetalPurity,
  lotsForSelection,
  filterRowsByMetal,
} from './holdingChartUtils'

const MAX_POINTS_PER_SERIES = 150

function pushPoint(arr, pt) {
  const next = [...arr, pt]
  if (next.length > MAX_POINTS_PER_SERIES) next.splice(0, next.length - MAX_POINTS_PER_SERIES)
  return next
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(15,15,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-[var(--text-dim)] mb-1">{row.timeLabel}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {p.value != null && p.value !== '' ? Number(p.value).toFixed(4) : '—'}
        </div>
      ))}
    </div>
  )
}

function PnlTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(15,15,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-[var(--text-dim)] mb-1">{row.timeLabel}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}:{' '}
          {p.value != null && p.value !== '' ? `${Number(p.value) >= 0 ? '+' : ''}${Number(p.value).toFixed(2)}` : '—'}
        </div>
      ))}
    </div>
  )
}

export default function CustomerPortfolioCharts({ holdings }) {
  const rows = useMemo(() => normalizeHoldings(holdings || []), [holdings])
  const metals = useMemo(() => metalOptionsFromRows(rows), [rows])

  const [metal, setMetal] = useState(() => metals[0] || '')
  const [purity, setPurity] = useState('all')
  const [vendor, setVendor] = useState('all')
  const [lotKey, setLotKey] = useState('')

  const [lotSeriesByKey, setLotSeriesByKey] = useState({})
  const [portfolioPts, setPortfolioPts] = useState([])

  useEffect(() => {
    if (metals.length && !metal) setMetal(metals[0])
    if (metals.length && metal && !metals.includes(metal)) setMetal(metals[0])
  }, [metals, metal])

  const rowsForMetal = useMemo(() => filterRowsByMetal(rows, metal), [rows, metal])

  const purities = useMemo(() => purityOptionsForMetal(rowsForMetal, metal), [rowsForMetal, metal])

  const vendors = useMemo(
    () => vendorOptionsForMetalPurity(rowsForMetal, metal, purity),
    [rowsForMetal, metal, purity],
  )

  const lots = useMemo(
    () => lotsForSelection(rows, metal, purity, vendor),
    [rows, metal, purity, vendor],
  )

  useEffect(() => {
    if (purities.length === 1 && purity === 'all') setPurity(purities[0])
  }, [purities, purity])

  useEffect(() => {
    if (vendors.length === 1 && vendor === 'all') setVendor(vendors[0])
  }, [vendors, vendor])

  useEffect(() => {
    if (lots.length === 0) {
      setLotKey('')
      return
    }
    const keys = lots.map(holdingLotKey).filter(Boolean)
    if (!keys.includes(lotKey)) setLotKey(keys[0])
  }, [lots, lotKey])

  const recordSamples = useCallback(() => {
    const now = Date.now()
    const timeLabel = fmtTime(now)

    setLotSeriesByKey((prev) => {
      let changed = false
      const next = { ...prev }
      for (const row of rows) {
        const k = holdingLotKey(row)
        if (!k) continue
        const sell = Number(row.current_rate ?? row.current_sell_ref_per_gram ?? 0)
        const buy = Number(row.purchase_rate ?? 0)
        const pnl = Number(row.pnl_aed ?? 0)
        const old = next[k] || []
        const last = old[old.length - 1]
        const same =
          last &&
          Math.abs(last.sell - sell) < 1e-9 &&
          Math.abs(last.buy - buy) < 1e-9 &&
          Math.abs(last.pnl - pnl) < 1e-6
        if (same) continue
        next[k] = pushPoint(old, { t: now, timeLabel, sell, buy, pnl })
        changed = true
      }
      return changed ? next : prev
    })

    const totalPnl = Math.round(rows.reduce((s, r) => s + Number(r.pnl_aed ?? 0), 0) * 100) / 100
    setPortfolioPts((prev) => {
      const last = prev[prev.length - 1]
      if (last && Math.abs(last.pnl - totalPnl) < 1e-6) return prev
      return pushPoint(prev, { t: now, timeLabel, pnl: totalPnl })
    })
  }, [rows])

  useEffect(() => {
    recordSamples()
  }, [recordSamples])

  const selectedRow = useMemo(() => lots.find((r) => holdingLotKey(r) === lotKey), [lots, lotKey])

  const lotKeySel = selectedRow ? holdingLotKey(selectedRow) : ''
  const lotData = lotKeySel ? lotSeriesByKey[lotKeySel] || [] : []

  const crossingCount = useMemo(() => {
    let c = 0
    for (let i = 1; i < lotData.length; i++) {
      const a = lotData[i - 1].pnl
      const b = lotData[i].pnl
      if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) c += 1
    }
    return c
  }, [lotData])

  if (rows.length === 0) return null

  const selectCls =
    'px-2 py-1.5 rounded-lg text-[10px] font-semibold max-w-[200px] sm:max-w-none truncate'
  const selectStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const purchaseY = Number(selectedRow?.purchase_rate ?? 0)

  return (
    <section className="mb-8 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(201,168,76,0.15)' }}>
      <div className="px-5 py-4 flex flex-wrap items-center gap-2" style={{ background: 'rgba(201,168,76,0.06)' }}>
        <Activity size={16} className="text-[var(--gold)] flex-shrink-0" />
        <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)]">Live charts</h2>
        <span className="text-[10px] text-[var(--text-dim)] hidden sm:inline">Vendor quote moves; dashed line is your purchase basis</span>
      </div>

      <div className="p-5 flex flex-col gap-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <p className="text-[11px] text-[var(--text-muted)] flex gap-2 items-start">
          <Info size={14} className="text-[var(--gold)] flex-shrink-0 mt-0.5" />
          <span>
            Select a lot you own (metal, fineness, vendor). Charts fill as this page refreshes — the same rates as the holdings table. Totals include every open lot.
          </span>
        </p>

        <div className="flex flex-col gap-3">
          <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] font-bold">Holding</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className={selectCls}
              style={selectStyle}
              value={metal}
              onChange={(e) => {
                setMetal(e.target.value)
                setPurity('all')
                setVendor('all')
                setLotKey('')
              }}
            >
              {metals.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              style={selectStyle}
              value={purity}
              onChange={(e) => {
                setPurity(e.target.value)
                setVendor('all')
                setLotKey('')
              }}
            >
              <option value="all">All fineness</option>
              {purities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              style={selectStyle}
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value)
                setLotKey('')
              }}
            >
              <option value="all">All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              style={{ ...selectStyle, maxWidth: '300px' }}
              value={lotKey}
              onChange={(e) => setLotKey(e.target.value)}
            >
              {lots.map((r) => (
                <option key={holdingLotKey(r)} value={holdingLotKey(r)}>
                  {r.order_ref} · {r.purity} · {Number(r.grams).toFixed(3)}g
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedRow && (
          <>
            <div>
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <span className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] font-bold">
                  Live sell reference (AED/g) vs your purchase rate
                </span>
                {lotData.length > 2 && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    P&amp;L sign changes (approx.): <strong className="text-[var(--text-soft)]">{crossingCount}</strong>
                  </span>
                )}
              </div>
              <div className="h-[260px] w-full">
                {lotData.length < 2 ? (
                  <div
                    className="h-full flex items-center justify-center text-xs text-[var(--text-faint)] rounded-xl"
                    style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
                  >
                    Collecting points… keep the dashboard open to see the curve.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lotData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(ts) => fmtTime(ts)}
                        stroke="#666"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        stroke="#666"
                        tick={{ fontSize: 10 }}
                        width={56}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => Number(v).toFixed(2)}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine
                        y={purchaseY}
                        stroke="#94a3b8"
                        strokeDasharray="5 5"
                        label={{ value: 'Your buy / g', fill: '#94a3b8', fontSize: 10 }}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="sell"
                        name="Live sell ref / g"
                        stroke="#C9A84C"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] font-bold mb-2">
                Unrealized P&amp;L for this lot (AED)
              </div>
              <div className="h-[200px] w-full">
                {lotData.length < 2 ? (
                  <div
                    className="h-full flex items-center justify-center text-xs text-[var(--text-faint)] rounded-xl"
                    style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
                  >
                    Not enough samples yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lotData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(ts) => fmtTime(ts)}
                        stroke="#666"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="#666" tick={{ fontSize: 10 }} width={52} domain={['auto', 'auto']} />
                      <Tooltip content={<PnlTooltip />} />
                      <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                      <Line
                        type="stepAfter"
                        dataKey="pnl"
                        name="P&L AED"
                        stroke={(selectedRow.pnl_aed ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}

        <div>
          <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] font-bold mb-2">
            Total unrealized P&amp;L (all open lots you hold)
          </div>
          <div className="h-[200px] w-full">
            {portfolioPts.length < 2 ? (
              <div
                className="h-full flex items-center justify-center text-xs text-[var(--text-faint)] rounded-xl"
                style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
              >
                Collecting points…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={portfolioPts} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(ts) => fmtTime(ts)}
                    stroke="#666"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis stroke="#666" tick={{ fontSize: 10 }} width={52} domain={['auto', 'auto']} />
                  <Tooltip content={<PnlTooltip />} />
                  <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
                  <Line
                    type="stepAfter"
                    dataKey="pnl"
                    name="Total P&L AED"
                    stroke="#a78bfa"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
