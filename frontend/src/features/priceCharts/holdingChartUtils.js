/**
 * Normalize dashboard holdings to a flat list (real API rows vs demo nested shape).
 */
export function normalizeHoldings(holdings) {
  if (!Array.isArray(holdings) || holdings.length === 0) return []
  const first = holdings[0]
  if (first && Array.isArray(first.products)) {
    const out = []
    for (const bag of holdings) {
      const vMetal = bag.metal
      for (const pr of bag.products || []) {
        const grams = Number(pr.grams) || 0
        const buy = Number(pr.avg_buy_price) || 0
        const bb = Number(pr.buyback_price) || 0
        const pnl = pr.pnl_aed != null ? Number(pr.pnl_aed) : Math.round((bb - buy) * grams * 100) / 100
        out.push({
          order_ref: String(pr.id ?? ''),
          order_id: pr.id,
          date: pr.date || '',
          vendor: bag.vendor || '',
          vendor_verified: !!bag.vendor_verified,
          metal: pr.metal || vMetal || 'gold',
          product_name: pr.name || '',
          purity: pr.purity || '—',
          grams,
          purchase_rate: buy,
          current_rate: bb,
          current_sell_ref_per_gram: bb,
          current_buyback: bb,
          customer_sell_back_rate_per_gram: bb,
          pnl_aed: pnl,
          sell_order_id: null,
        })
      }
    }
    return out
  }
  return holdings.filter((h) => h && (h.order_ref != null || h.order_id != null))
}

export function holdingLotKey(row) {
  return String(row.order_ref ?? row.order_id ?? '')
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))]
}

export function filterRowsByMetal(rows, metal) {
  if (!metal || metal === 'all') return rows
  return rows.filter((r) => r.metal === metal)
}

export function filterRowsByPurity(rows, purity) {
  if (!purity || purity === 'all') return rows
  return rows.filter((r) => String(r.purity) === String(purity))
}

export function filterRowsByVendor(rows, vendor) {
  if (!vendor || vendor === 'all') return rows
  return rows.filter((r) => r.vendor === vendor)
}

export function metalOptionsFromRows(rows) {
  return uniq(rows.map((r) => r.metal)).sort()
}

export function purityOptionsForMetal(rows, metal) {
  return uniq(filterRowsByMetal(rows, metal).map((r) => String(r.purity))).sort()
}

export function vendorOptionsForMetalPurity(rows, metal, purity) {
  let r = filterRowsByMetal(rows, metal)
  if (purity && purity !== 'all') r = filterRowsByPurity(r, purity)
  return uniq(r.map((x) => x.vendor)).sort()
}

export function lotsForSelection(rows, metal, purity, vendor) {
  let r = filterRowsByMetal(rows, metal)
  if (purity && purity !== 'all') r = filterRowsByPurity(r, purity)
  if (vendor && vendor !== 'all') r = filterRowsByVendor(r, vendor)
  return r
}
