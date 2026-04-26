/**
 * Custody: paid orders with remaining grams. Sell ref = current effective_rate (AED/g);
 * sell-back / g = customer payout if they sell now (effective_buyback_per_gram);
 * spread / g = product-level deduction below sell (live only, when not overridden by per-purity map).
 */
export function custodyTotals(rows) {
  const list = rows ?? []
  let grams = 0
  let exposure = 0
  let market = 0
  for (const h of list) {
    grams += Number(h.grams_remaining) || 0
    exposure += Number(h.customer_sell_back_value_aed ?? h.buyback_exposure_aed) || 0
    market += Number(h.market_value_aed ?? 0) || 0
  }
  return { grams, exposure, market }
}

function SkuListingCell({ h }) {
  const hasFlags = typeof h.product_visible === 'boolean' && typeof h.product_in_stock === 'boolean'
  if (!hasFlags) {
    return <span className="text-[9px] text-[#666]" title="Listing flags not on this row">—</span>
  }
  const listed = h.product_visible && h.product_in_stock
  if (listed) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
        Listed
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-0.5">
      {!h.product_visible && (
        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
          Hidden
        </span>
      )}
      {!h.product_in_stock && (
        <span className="inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
          Out of stock
        </span>
      )}
    </div>
  )
}

export default function CustodyHoldingsTable({ rows, idPrefix = 'custody' }) {
  const list = rows ?? []
  const { grams, exposure, market } = custodyTotals(list)

  return (
    <div className="overflow-x-auto max-h-[min(28rem,70vh)] overflow-y-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 z-[1]" style={{ background: 'rgba(20,20,20,0.98)' }}>
          <tr className="text-[#555] text-left">
            <th className="py-2 px-2 whitespace-nowrap">Order</th>
            <th className="py-2 px-2 whitespace-nowrap">Customer</th>
            <th className="py-2 px-2 min-w-[100px]">Product</th>
            <th className="py-2 px-2 whitespace-nowrap">Listing</th>
            <th className="py-2 px-2">Metal</th>
            <th className="py-2 px-2">Purity</th>
            <th className="py-2 px-2 whitespace-nowrap">g held</th>
            <th className="py-2 px-2 whitespace-nowrap" title="Current sell reference AED/g">Sell ref / g</th>
            <th className="py-2 px-2 whitespace-nowrap" title="Deduction below sell (live catalog spread; N/A if map/manual)">Spread / g</th>
            <th className="py-2 px-2 whitespace-nowrap" title="Customer AED/g if they sell back now">Sell-back / g</th>
            <th className="py-2 px-2 whitespace-nowrap" title="grams × sell ref">Sell value</th>
            <th className="py-2 px-2 whitespace-nowrap" title="grams × sell-back rate">Sell-back Σ</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h, i) => (
            <tr key={`${idPrefix}-${h.order_id}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <td className="py-1.5 px-2 font-mono text-[#C9A84C] whitespace-nowrap">{h.order_ref}</td>
              <td className="py-1.5 px-2 text-[#ccc] max-w-[140px]">
                <div className="truncate font-medium" title={h.customer}>{h.customer || '—'}</div>
                {h.customer_email ? (
                  <div className="truncate text-[9px] text-[#666]" title={h.customer_email}>{h.customer_email}</div>
                ) : null}
              </td>
              <td className="py-1.5 px-2 text-[#ddd]">{h.product_name}</td>
              <td className="py-1.5 px-2"><SkuListingCell h={h} /></td>
              <td className="py-1.5 px-2">{h.metal}</td>
              <td className="py-1.5 px-2">{h.purity}</td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">{Number(h.grams_remaining).toFixed(4)}</td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap">{Number(h.effective_rate_per_gram_aed ?? 0).toFixed(4)}</td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap text-[#888]">
                {h.buyback_spread_per_gram_aed != null && h.buyback_spread_per_gram_aed !== ''
                  ? Number(h.buyback_spread_per_gram_aed).toFixed(4)
                  : '—'}
              </td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap text-emerald-400/85">{Number(h.buyback_per_gram_aed).toFixed(4)}</td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap text-[#A8A9AD]">
                {Number(h.market_value_aed ?? (Number(h.grams_remaining) * Number(h.effective_rate_per_gram_aed || 0))).toFixed(2)}
              </td>
              <td className="py-1.5 px-2 tabular-nums whitespace-nowrap text-emerald-400/90">
                {Number(h.customer_sell_back_value_aed ?? h.buyback_exposure_aed).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        {list.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(201,168,76,0.2)' }}>
              <td colSpan={6} className="py-2 px-2 text-[10px] uppercase tracking-widest text-[#888] font-bold">Totals</td>
              <td className="py-2 px-2 tabular-nums font-bold text-[#F5F0E8] whitespace-nowrap">{grams.toFixed(4)}</td>
              <td colSpan={3} className="py-2 px-2 text-[#555] text-[10px]">—</td>
              <td className="py-2 px-2 tabular-nums font-bold text-[#A8A9AD] whitespace-nowrap">{market.toFixed(2)}</td>
              <td className="py-2 px-2 tabular-nums font-bold text-emerald-400/90 whitespace-nowrap">{exposure.toFixed(2)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
