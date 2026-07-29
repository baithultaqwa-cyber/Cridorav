/**
 * Illustrative retail / marketplace competitor buy costs for the home hero panel.
 * Not live scrapes — directional premium assumptions vs Cridora listing rate.
 */
export const HERO_RETAIL_COMPARISON = [
  {
    id: 'noon',
    name: 'Noon',
    short: 'Noon',
    buyPremiumPct: 0.045,
    note: 'Illustrative jewellery / coin markup',
  },
  {
    id: 'amazon',
    name: 'Amazon.ae',
    short: 'Amazon',
    buyPremiumPct: 0.05,
    note: 'Illustrative marketplace jewellery markup',
  },
  {
    id: 'retail_chain',
    name: 'Retail jewellery chain',
    short: 'Retail',
    buyPremiumPct: 0.06,
    note: 'Typical high-street premium band',
  },
  {
    id: 'digital_gold',
    name: 'Digital gold apps',
    short: 'Apps',
    buyPremiumPct: 0.028,
    note: 'Illustrative spread + vault stack',
  },
]

/**
 * @param {number} grams
 * @param {number} ratePerGram Cridora cheapest listing rate AED/g
 * @param {number} buyFeePct Cridora service fee %
 */
export function heroCompareRows(grams, ratePerGram, buyFeePct) {
  const g = Math.max(0.1, Number(grams) || 1)
  const rate = Math.max(0, Number(ratePerGram) || 0)
  const feePct = Math.max(0, Number(buyFeePct) || 0)
  const metal = g * rate
  const cridoraFee = metal * (feePct / 100)
  const cridoraTotal = metal + cridoraFee

  const competitors = HERO_RETAIL_COMPARISON.map((c) => {
    // Always price above Cridora: premium applies to Cridora all-in, not bare metal.
    // Floor keeps every row strictly higher even if premiums/fees round oddly.
    const premium = Math.max(0.01, Number(c.buyPremiumPct) || 0)
    const total = Math.max(
      cridoraTotal * (1 + premium),
      metal * (1 + premium),
      cridoraTotal + 1,
    )
    return {
      ...c,
      totalAed: total,
      vsCridoraAed: total - cridoraTotal,
      vsCridoraPct: cridoraTotal > 0 ? ((total - cridoraTotal) / cridoraTotal) * 100 : 0,
    }
  })

  return {
    grams: g,
    ratePerGram: rate,
    metalSubtotal: metal,
    cridoraFee,
    cridoraFeePct: feePct,
    cridoraTotal,
    competitors,
  }
}
