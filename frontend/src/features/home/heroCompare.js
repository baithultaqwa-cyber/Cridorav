/**
 * Illustrative competitor buy costs for the home hero panel.
 * Not live scrapes — directional premiums + typical processing stacks vs Cridora ticker rate.
 * Brand names are field peers for shopping comparison education only.
 */

export const HERO_GOLD_COMPARISON = [
  {
    id: 'ogold',
    name: 'OGold',
    short: 'OGold',
    category: 'digital',
    buyPremiumPct: 0.032,
    processingFeePct: 0.005,
    processingFixedAed: 0,
    processingLabel: 'App spread / vault processing',
    note: 'Illustrative digital-gold app buy stack',
  },
  {
    id: 'savegold',
    name: 'SaveGold',
    short: 'SaveGold',
    category: 'digital',
    buyPremiumPct: 0.03,
    processingFeePct: 0.006,
    processingFixedAed: 0,
    processingLabel: 'Platform processing on top',
    note: 'Illustrative digital-gold savings stack',
  },
  {
    id: 'mygold_wallet',
    name: 'Digital gold wallets',
    short: 'Gold wallets',
    category: 'digital',
    buyPremiumPct: 0.028,
    processingFeePct: 0.004,
    processingFixedAed: 0,
    processingLabel: 'Wallet / vault processing',
    note: 'Composite of similar UAE digital-gold apps',
  },
  {
    id: 'bank_gold_a',
    name: 'Major UAE bank gold',
    short: 'Bank gold',
    category: 'bank',
    buyPremiumPct: 0.025,
    processingFeePct: 0.01,
    processingFixedAed: 15,
    processingLabel: 'Bank processing + fixed charges',
    note: 'Typical bank gold-account buy friction',
  },
  {
    id: 'bank_gold_b',
    name: 'Digital bank gold',
    short: 'Digital bank',
    category: 'bank',
    buyPremiumPct: 0.027,
    processingFeePct: 0.008,
    processingFixedAed: 0,
    processingLabel: 'Bank processing fees',
    note: 'Illustrative neobank-style gold product',
  },
  {
    id: 'noon',
    name: 'Noon',
    short: 'Noon',
    category: 'marketplace',
    buyPremiumPct: 0.045,
    processingFeePct: 0.0,
    processingFixedAed: 12,
    processingLabel: 'Checkout / delivery add-ons',
    note: 'Illustrative jewellery / coin market markup',
  },
  {
    id: 'amazon',
    name: 'Amazon.ae',
    short: 'Amazon',
    category: 'marketplace',
    buyPremiumPct: 0.05,
    processingFeePct: 0.0,
    processingFixedAed: 10,
    processingLabel: 'Seller / fulfilment add-ons',
    note: 'Illustrative marketplace jewellery markup',
  },
  {
    id: 'retail_chain',
    name: 'Retail jewellery',
    short: 'Retail',
    category: 'retail',
    buyPremiumPct: 0.06,
    processingFeePct: 0.0,
    processingFixedAed: 0,
    processingLabel: 'Making & retail charges in price',
    note: 'High-street premium band',
  },
  {
    id: 'bullion_app',
    name: 'Bullion investment apps',
    short: 'Bullion apps',
    category: 'digital',
    buyPremiumPct: 0.035,
    processingFeePct: 0.003,
    processingFixedAed: 5,
    processingLabel: 'Mint / processing surcharge',
    note: 'Illustrative app + physical premium',
  },
]

/** Silver peers — same premium math, silver-relevant labels (no gold-only brands). */
export const HERO_SILVER_COMPARISON = [
  {
    id: 'digital_silver',
    name: 'Digital silver apps',
    short: 'Silver apps',
    category: 'digital',
    buyPremiumPct: 0.04,
    processingFeePct: 0.006,
    processingFixedAed: 0,
    processingLabel: 'App spread / vault processing',
    note: 'Illustrative digital-silver buy stack',
  },
  {
    id: 'bank_silver',
    name: 'Bank silver accounts',
    short: 'Bank silver',
    category: 'bank',
    buyPremiumPct: 0.035,
    processingFeePct: 0.01,
    processingFixedAed: 12,
    processingLabel: 'Bank processing + fixed charges',
    note: 'Typical bank precious-metal account friction',
  },
  {
    id: 'noon_silver',
    name: 'Noon',
    short: 'Noon',
    category: 'marketplace',
    buyPremiumPct: 0.055,
    processingFeePct: 0.0,
    processingFixedAed: 12,
    processingLabel: 'Checkout / delivery add-ons',
    note: 'Illustrative marketplace silver markup',
  },
  {
    id: 'amazon_silver',
    name: 'Amazon.ae',
    short: 'Amazon',
    category: 'marketplace',
    buyPremiumPct: 0.06,
    processingFeePct: 0.0,
    processingFixedAed: 10,
    processingLabel: 'Seller / fulfilment add-ons',
    note: 'Illustrative marketplace silver markup',
  },
  {
    id: 'retail_silver',
    name: 'Retail silver / jewellery',
    short: 'Retail',
    category: 'retail',
    buyPremiumPct: 0.08,
    processingFeePct: 0.0,
    processingFixedAed: 0,
    processingLabel: 'Making & retail charges in price',
    note: 'High-street silver premium band',
  },
  {
    id: 'bullion_silver',
    name: 'Bullion dealers / apps',
    short: 'Bullion apps',
    category: 'digital',
    buyPremiumPct: 0.045,
    processingFeePct: 0.004,
    processingFixedAed: 5,
    processingLabel: 'Mint / processing surcharge',
    note: 'Illustrative silver bullion premium',
  },
]

/** @deprecated Use HERO_GOLD_COMPARISON — kept for older imports. */
export const HERO_RETAIL_COMPARISON = HERO_GOLD_COMPARISON

function peersForMetal(metal) {
  return String(metal || '').toLowerCase() === 'silver'
    ? HERO_SILVER_COMPARISON
    : HERO_GOLD_COMPARISON
}

/**
 * @param {number} grams
 * @param {number} ratePerGram Live ticker AED/g for the selected metal + purity
 * @param {number} buyFeePct Cridora secure-purchase service %
 * @param {'gold'|'silver'} [metal='gold'] Selects which competitor peer set to scale
 */
export function heroCompareRows(grams, ratePerGram, buyFeePct, metal = 'gold') {
  const g = Math.max(0.1, Number(grams) || 1)
  const rate = Math.max(0, Number(ratePerGram) || 0)
  const servicePct = Math.max(0, Number(buyFeePct) || 0)
  const metalValue = g * rate
  const cridoraService = metalValue * (servicePct / 100)
  const cridoraTotal = metalValue + cridoraService
  const peers = peersForMetal(metal)

  const competitors = peers.map((c) => {
    const premium = Math.max(0.01, Number(c.buyPremiumPct) || 0)
    const procPct = Math.max(0, Number(c.processingFeePct) || 0)
    const procFixed = Math.max(0, Number(c.processingFixedAed) || 0)

    const listedMetal = metalValue * (1 + premium)
    const processingAed = listedMetal * procPct + procFixed
    let total = listedMetal + processingAed

    // Always show higher all-in than Cridora for clear shopping contrast.
    if (total <= cridoraTotal) {
      total = cridoraTotal * (1 + premium * 0.5 + 0.01) + processingAed
    }

    const ratePerGramEst = g > 0 ? listedMetal / g : 0

    return {
      ...c,
      listedMetalAed: listedMetal,
      processingAed,
      hasProcessing: processingAed > 0.01 || procPct > 0 || Boolean(c.processingLabel),
      ratePerGramEst,
      totalAed: total,
      vsCridoraAed: total - cridoraTotal,
      vsCridoraPct: cridoraTotal > 0 ? ((total - cridoraTotal) / cridoraTotal) * 100 : 0,
    }
  }).sort((a, b) => b.vsCridoraAed - a.vsCridoraAed)

  return {
    grams: g,
    metal: String(metal || 'gold').toLowerCase() === 'silver' ? 'silver' : 'gold',
    ratePerGram: rate,
    metalSubtotal: metalValue,
    cridoraFee: cridoraService,
    cridoraService,
    cridoraFeePct: servicePct,
    cridoraServicePct: servicePct,
    cridoraTotal,
    competitors,
  }
}
