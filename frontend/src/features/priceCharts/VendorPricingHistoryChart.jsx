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

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function RatesTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: 'rgba(15,15,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="text-[var(--text-dim)] mb-1">{row.label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {p.value != null && p.value !== '' && !Number.isNaN(Number(p.value)) ? Number(p.value).toFixed(4) : '—'}
        </div>
      ))}
    </div>
  )
}

/**
 * @param {{ series: Array<{ t: number, label: string, spot: number | null, sell: number }>, previousSell: number | null }} props
 */
export default function VendorPricingHistoryChart({ series, previousSell }) {
  const prev = previousSell != null && !Number.isNaN(Number(previousSell)) ? Number(previousSell) : null

  return (
    <div className="rounded-xl p-4 mt-4" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-dim)] mb-2">
        Live rate trace (AED/g)
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mb-3 leading-relaxed">
        Same math as the preview table: unmarginated spot tier vs your effective sell for this SKU. Step shape reflects ticker-style updates.
      </p>
      <div className="h-[220px] w-full">
        {series.length < 2 ? (
          <div
            className="h-full flex items-center justify-center text-xs text-[var(--text-faint)] rounded-lg"
            style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
          >
            Sampling on each pricing refresh…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) => fmtTime(ts)}
                stroke="#666"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} width={54} domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(2)} />
              <Tooltip content={<RatesTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {prev != null ? (
                <ReferenceLine
                  y={prev}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{ value: 'Previous sell / g', fill: '#94a3b8', fontSize: 10 }}
                />
              ) : null}
              <Line type="monotone" dataKey="spot" name="Spot tier ref / g" stroke="#60a5fa" dot={false} strokeWidth={1.5} connectNulls isAnimationActive={false} />
              <Line type="stepAfter" dataKey="sell" name="Your live sell / g" stroke="#C9A84C" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
