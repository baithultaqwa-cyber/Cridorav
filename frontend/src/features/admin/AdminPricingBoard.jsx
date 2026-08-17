import { useState } from 'react'
import { CheckCircle, TrendingUp } from 'lucide-react'

function fmt(v, digits = 2) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—'
  return Number(v).toFixed(digits)
}

function RateCol({ title, subtitle, color, rows, digits = 2 }) {
  return (
    <div className="rounded-xl p-3 min-w-0" style={{ background: 'rgba(0,0,0,0.22)', border: `1px solid ${color}33` }}>
      <div className="text-[10px] tracking-widest uppercase font-bold" style={{ color }}>{title}</div>
      {subtitle ? <div className="text-[9px] text-[var(--text-faint)] mb-2 leading-snug mt-0.5">{subtitle}</div> : <div className="mb-2" />}
      <div className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-[var(--text-dim)]">{label}</span>
            <span className="font-bold tabular-nums text-[var(--text-primary)]">{fmt(value, digits)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Dubai three-rate board + Cridora customer ticker controls (Admin → Fees & Config).
 * Bases: international | dubai_retail | vendor → ticker = base × (1 + markup%).
 */
export default function AdminPricingBoard({
  feesConfig,
  feeEdit,
  setFeeEdit,
  feeSaving,
  saveFee,
  onPatch,
  feeMsg,
}) {
  const board = feesConfig?.pricing_board || null
  const base = feesConfig?.ticker_base || board?.ticker_base || 'international'
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [baseSaving, setBaseSaving] = useState(false)

  const goldIntl = board?.gold?.international || {}
  const goldRetail = board?.gold?.dubai_retail || {}
  const goldVendor = board?.gold?.vendor_rates || {}
  const goldTicker = board?.gold?.cridora_ticker || {}
  const silverIntl = board?.silver?.international || {}
  const silverRetail = board?.silver?.dubai_retail || {}
  const silverVendor = board?.silver?.vendor_rates || {}
  const silverTicker = board?.silver?.cridora_ticker || {}
  const retailSource = board?.gold?.preview?.['24K']?.rate_b_source
    || board?.silver?.preview?.['999']?.rate_b_source
    || null

  const setTickerBase = async (next) => {
    if (next === base || baseSaving) return
    setBaseSaving(true)
    await onPatch({ ticker_base: next })
    setBaseSaving(false)
  }

  const markupDesc = {
    international: 'Cridora ticker = International × (1 + this%). International is also the vendor-facing Cridora rate.',
    dubai_retail: 'Cridora ticker = Dubai retail × (1 + this%). Use negative to undercut retail.',
    vendor: 'Cridora ticker = best vendor rate × (1 + this%). Vendor rate = international + vendor markup.',
  }

  const primaryFees = [
    {
      label: 'Gold markup %',
      key: 'wallet_markup_pct_gold',
      value: feesConfig.wallet_markup_pct_gold ?? feesConfig.home_spot_display_margin_pct ?? 0,
      color: '#8b5cf6',
      unit: '%',
      desc: markupDesc[base] || markupDesc.international,
    },
    {
      label: 'Silver markup %',
      key: 'wallet_markup_pct_silver',
      value: feesConfig.wallet_markup_pct_silver ?? 0,
      color: '#a78bfa',
      unit: '%',
      desc: 'Same formula for silver.',
    },
    {
      label: 'Min profit floor (gold)',
      key: 'min_profit_floor_aed_per_g_gold',
      value: feesConfig.min_profit_floor_aed_per_g_gold ?? 3,
      color: '#14b8a6',
      unit: 'AED',
      desc: 'Blocks publishing a new ticker if (ticker − best vendor cost) < this AED/g. Does not add itself into the ticker — it only holds the last valid ticker when markup is too low.',
    },
    {
      label: 'Min profit floor (silver)',
      key: 'min_profit_floor_aed_per_g_silver',
      value: feesConfig.min_profit_floor_aed_per_g_silver ?? 0.15,
      color: '#14b8a6',
      unit: 'AED',
      desc: 'Same floor guard for silver — not a markup.',
    },
    {
      label: 'Card cost %',
      key: 'card_cost_pct',
      value: feesConfig.card_cost_pct ?? 2.5,
      color: '#3b82f6',
      unit: '%',
      desc: 'Card rate = wallet ÷ (1 − this%).',
    },
    {
      label: 'Sell-back fee %',
      key: 'sellback_convenience_fee_pct',
      value: feesConfig.sellback_convenience_fee_pct ?? 1,
      color: '#f59e0b',
      unit: '%',
      desc: '% of gross buyback (never % of profit).',
    },
  ]

  const advancedFees = [
    { label: 'Buy service fee %', key: 'buy_fee_pct', value: feesConfig.buy_fee_pct, color: '#10b981', unit: '%', desc: 'Usually 0 — spread carries revenue' },
    { label: 'Sell-back flat AED', key: 'sellback_convenience_fee_flat_aed', value: feesConfig.sellback_convenience_fee_flat_aed ?? 0, color: '#f59e0b', unit: 'AED', desc: 'Flat add-on to sell-back fee' },
    { label: 'Ceiling epsilon AED/g', key: 'ceiling_epsilon_aed_per_g', value: feesConfig.ceiling_epsilon_aed_per_g ?? 0.5, color: '#f472b6', unit: 'AED', desc: 'When base = international/vendor: ceiling = Dubai retail − epsilon' },
    { label: 'Dubai retail gold 24K override', key: 'rate_b_manual_override_gold_24k_aed_per_g', value: feesConfig.rate_b_manual_override_gold_24k_aed_per_g ?? '', color: '#fb7185', unit: 'AED', desc: 'Manual Dubai retail if scrape is down' },
    { label: 'Dubai retail silver 999 override', key: 'rate_b_manual_override_silver_999_aed_per_g', value: feesConfig.rate_b_manual_override_silver_999_aed_per_g ?? '', color: '#fb7185', unit: 'AED', desc: 'Manual silver retail fallback' },
    { label: 'Retail staleness (min)', key: 'rate_b_staleness_max_minutes', value: feesConfig.rate_b_staleness_max_minutes ?? 15, color: '#fb7185', unit: 'min', desc: 'Treat scraped retail as stale after this' },
    { label: 'PSP fee estimate %', key: 'psp_fee_pct', value: feesConfig.psp_fee_pct ?? 2.6, color: '#3b82f6', unit: '%', desc: 'Checkout disclosure only' },
    { label: 'PSP fee estimate flat', key: 'psp_fee_flat_aed', value: feesConfig.psp_fee_flat_aed ?? 0.5, color: '#3b82f6', unit: 'AED', desc: 'Checkout disclosure only' },
    { label: 'EOD holding %', key: 'eod_holding_pct', value: feesConfig.eod_holding_pct ?? 0, color: '#14b8a6', unit: '%', desc: 'Retained from vendor daily net at EOD' },
    { label: 'Sell profit share (legacy)', key: 'sell_share_pct', value: feesConfig.sell_share_pct, color: 'var(--gold)', unit: '%', desc: 'Historical only' },
    { label: 'Sell fee (unused)', key: 'sell_fee_pct', value: feesConfig.sell_fee_pct, color: '#ef4444', unit: '%', desc: 'Not applied today' },
  ]

  const renderFeeRow = (fee) => {
    const isEditing = fee.key in feeEdit
    const isSaving = feeSaving[fee.key]
    return (
      <div key={fee.key} className="flex items-center justify-between gap-4 flex-wrap py-2 border-b border-white/5 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{fee.label}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{fee.desc}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <div className="flex items-center gap-1">
                {fee.unit === 'AED' && <span className="text-xs text-[var(--text-dim)]">AED</span>}
                <input
                  type="number"
                  step="0.01"
                  min={['wallet_markup_pct_gold', 'wallet_markup_pct_silver'].includes(fee.key) ? -100 : 0}
                  max={fee.unit === '%' ? (['wallet_markup_pct_gold', 'wallet_markup_pct_silver'].includes(fee.key) ? 500 : 100) : undefined}
                  value={feeEdit[fee.key]}
                  onChange={(e) => setFeeEdit((p) => ({ ...p, [fee.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveFee(fee.key, { unit: fee.unit })
                    }
                  }}
                  className="w-24 px-2 py-1.5 rounded-lg text-xs text-center font-bold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${fee.color}40`, color: fee.color, outline: 'none' }}
                  autoFocus
                />
                {fee.unit === '%' && <span className="text-xs text-[var(--text-dim)]">%</span>}
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveFee(fee.key, { unit: fee.unit })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-bold disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}
              >
                {isSaving ? '…' : <><CheckCircle size={9} /> Save</>}
              </button>
              <button
                type="button"
                onClick={() => setFeeEdit((p) => { const n = { ...p }; delete n[fee.key]; return n })}
                className="px-2.5 py-1.5 rounded-lg text-[10px] text-[var(--text-dim)]"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <div className="text-xl font-black" style={{ color: fee.color }}>
                {fee.unit === 'AED'
                  ? (fee.value === '' || fee.value == null ? '—' : `AED ${Number(fee.value).toFixed(2)}`)
                  : fee.unit === 'min'
                    ? `${fee.value ?? '—'} min`
                    : `${fee.value ?? '—'}%`}
              </div>
              <button
                type="button"
                onClick={() => setFeeEdit((p) => ({ ...p, [fee.key]: String(fee.value ?? '') }))}
                className="px-2.5 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold)' }}
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-primary)] mb-2 flex items-center gap-2">
        <TrendingUp size={14} style={{ color: '#a78bfa' }} /> Cridora ticker
      </h3>
      <p className="text-[11px] text-[var(--text-dim)] mb-4 leading-relaxed">
        Dubai has three rates: <span className="text-[var(--text-soft)]">international</span> (vendor-facing Cridora),
        {' '}<span className="text-[var(--text-soft)]">Dubai retail</span>, and{' '}
        <span className="text-[var(--text-soft)]">vendor rates</span> (international + vendor markup).
        Pick a base and markup — candidate ticker = base × (1 + markup%).
        The <span className="text-[var(--text-soft)]">min profit floor</span> is a separate guard:
        publish only if ticker − best vendor cost ≥ floor (AED/g); otherwise the live board holds the last valid ticker.
      </p>

      {feeMsg && (
        <div
          className={`mb-4 px-3 py-2.5 rounded-xl text-xs flex items-center gap-2 ${feeMsg.includes('updated') || feeMsg.includes('saved') ? 'text-emerald-400' : 'text-red-400'}`}
          style={{
            background: feeMsg.includes('updated') || feeMsg.includes('saved') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${feeMsg.includes('updated') || feeMsg.includes('saved') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          {feeMsg}
        </div>
      )}

      <div className="mb-5">
        <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-2">
          Live rates (AED/g){board?.server_time ? ` · ${String(board.server_time).slice(0, 19)}` : ''}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
          <RateCol
            title="1. International"
            subtitle="Vendor-facing Cridora · former ticker"
            color="#60a5fa"
            rows={[
              ['Au 24K', goldIntl['24K']],
              ['Au 22K', goldIntl['22K']],
              ['Au 21K', goldIntl['21K']],
              ['Ag 999', silverIntl['999']],
            ]}
          />
          <RateCol
            title="2. Dubai retail"
            subtitle={retailSource ? `Official board · ${retailSource}` : 'Official Dubai board'}
            color="#fb7185"
            rows={[
              ['Au 24K', goldRetail['24K']],
              ['Au 22K', goldRetail['22K']],
              ['Au 21K', goldRetail['21K']],
              ['Ag 999', silverRetail['999']],
            ]}
          />
          <RateCol
            title="3. Vendor rates"
            subtitle="Best landed = intl + vendor markup"
            color="#f59e0b"
            rows={[
              ['Au 24K', goldVendor['24K']?.best_landed],
              ['Au 22K', goldVendor['22K']?.best_landed],
              ['Au 21K', goldVendor['21K']?.best_landed],
              ['Ag 999', silverVendor['999']?.best_landed],
            ]}
          />
          <RateCol
            title="→ Cridora ticker"
            subtitle="Customer-facing (live)"
            color="#c4b5fd"
            rows={[
              ['Au 24K', goldTicker['24K']],
              ['Au 22K', goldTicker['22K']],
              ['Au 21K', goldTicker['21K']],
              ['Ag 999', silverTicker['999']],
            ]}
          />
        </div>
        {board?.wallet_note ? (
          <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">{board.wallet_note}</p>
        ) : null}
        {(feesConfig.pricing_alerts || []).length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 max-h-24 overflow-y-auto">
            {(feesConfig.pricing_alerts || []).slice(0, 4).map((a, i) => (
              <li key={`${a.at}-${i}`} className="text-[10px] text-amber-300/90">
                [{a.code}] {a.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-5">
        <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-2">Ticker base (markup applies to)</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { v: 'international', l: 'International', hint: 'Vendor-facing Cridora reference' },
            { v: 'dubai_retail', l: 'Dubai retail', hint: 'Official retail board' },
            { v: 'vendor', l: 'Vendor rates', hint: 'Best vendor landed cost' },
          ].map((opt) => {
            const active = base === opt.v
            return (
              <button
                key={opt.v}
                type="button"
                disabled={baseSaving}
                onClick={() => setTickerBase(opt.v)}
                className="text-left rounded-xl px-3 py-3 transition-opacity disabled:opacity-50"
                style={{
                  background: active ? 'rgba(167,139,250,0.18)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="text-xs font-bold" style={{ color: active ? '#ddd6fe' : 'var(--text-primary)' }}>{opt.l}</div>
                <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{opt.hint}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1 mb-4">
        {primaryFees.map(renderFeeRow)}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[10px] tracking-widest uppercase font-bold text-[var(--text-dim)] hover:text-[var(--text-soft)] mb-2"
      >
        {showAdvanced ? 'Hide advanced' : 'Show advanced'}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-1 pt-2 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {[
              { label: 'Ceiling cross policy', key: 'ceiling_cross_policy', options: [
                { v: 'warn_only', l: 'Warn only (publish)' },
                { v: 'clamp_to_ceiling', l: 'Clamp to ceiling' },
              ]},
              { label: 'Retail stale policy', key: 'rate_b_stale_policy', options: [
                { v: 'hold_last_warn', l: 'Hold last ticker + warn' },
                { v: 'halt_quotes', l: 'Halt new quotes' },
              ]},
            ].map((sel) => (
              <div key={sel.key} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-2">{sel.label}</div>
                <select
                  value={feesConfig[sel.key] || sel.options[0].v}
                  onChange={(e) => onPatch({ [sel.key]: e.target.value })}
                  className="w-full px-2 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd', outline: 'none' }}
                >
                  {sel.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
          {advancedFees.map(renderFeeRow)}
        </div>
      )}
    </div>
  )
}
