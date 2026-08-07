/**
 * Illustrative competitor buy costs for the home hero panel.
 * Not live scrapes — directional metal premiums vs Cridora ticker rate.
 *
 * Comparison is metal-only (no Cridora Assurance / processing on either side):
 * peer “processing” fees are not reliably known, so Cridora’s buy fee is
 * excluded from the compared total too. Checkout still adds Assurance.
 */

export const HERO_GOLD_COMPARISON = [
  {
    id: 'ogold',
    name: 'OGold',
    short: 'OGold',
    category: 'digital',
    buyPremiumPct: 0.032,
    note: 'Illustrative digital-gold app buy stack',
  },
  {
    id: 'savegold',
    name: 'SaveGold',
    short: 'SaveGold',
    category: 'digital',
    buyPremiumPct: 0.03,
    note: 'Illustrative digital-gold savings stack',
  },
  {
    id: 'mygold_wallet',
    name: 'Digital gold wallets',
    short: 'Gold wallets',
    category: 'digital',
    buyPremiumPct: 0.028,
    note: 'Composite of similar UAE digital-gold apps',
  },
  {
    id: 'bank_gold_a',
    name: 'Major UAE bank gold',
    short: 'Bank gold',
    category: 'bank',
    buyPremiumPct: 0.025,
    note: 'Typical bank gold-account buy friction',
  },
  {
    id: 'bank_gold_b',
    name: 'Digital bank gold',
    short: 'Digital bank',
    category: 'bank',
    buyPremiumPct: 0.027,
    note: 'Illustrative neobank-style gold product',
  },
  {
    id: 'noon',
    name: 'Noon',
    short: 'Noon',
    category: 'marketplace',
    buyPremiumPct: 0.045,
    note: 'Illustrative jewellery / coin market markup',
  },
  {
    id: 'amazon',
    name: 'Amazon.ae',
    short: 'Amazon',
    category: 'marketplace',
    buyPremiumPct: 0.05,
    note: 'Illustrative marketplace jewellery markup',
  },
  {
    id: 'retail_chain',
    name: 'Retail jewellery',
    short: 'Retail',
    category: 'retail',
    buyPremiumPct: 0.06,
    note: 'High-street premium band',
  },
  {
    id: 'bullion_app',
    name: 'Bullion investment apps',
    short: 'Bullion apps',
    category: 'digital',
    buyPremiumPct: 0.035,
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
    note: 'Illustrative digital-silver buy stack',
  },
  {
    id: 'bank_silver',
    name: 'Bank silver accounts',
    short: 'Bank silver',
    category: 'bank',
    buyPremiumPct: 0.035,
    note: 'Typical bank precious-metal account friction',
  },
  {
    id: 'noon_silver',
    name: 'Noon',
    short: 'Noon',
    category: 'marketplace',
    buyPremiumPct: 0.055,
    note: 'Illustrative marketplace silver markup',
  },
  {
    id: 'amazon_silver',
    name: 'Amazon.ae',
    short: 'Amazon',
    category: 'marketplace',
    buyPremiumPct: 0.06,
    note: 'Illustrative marketplace silver markup',
  },
  {
    id: 'retail_silver',
    name: 'Retail silver / jewellery',
    short: 'Retail',
    category: 'retail',
    buyPremiumPct: 0.08,
    note: 'High-street silver premium band',
  },
  {
    id: 'bullion_silver',
    name: 'Bullion dealers / apps',
    short: 'Bullion apps',
    category: 'digital',
    buyPremiumPct: 0.045,
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
 * @param {number} [_buyFeePct] Ignored — kept for call-site compat. Comparison is metal-only.
 * @param {'gold'|'silver'} [metal='gold'] Selects which competitor peer set to scale
 */
export function heroCompareRows(grams, ratePerGram, _buyFeePct = 0, metal = 'gold') {
  const g = Math.max(0.1, Number(grams) || 1)
  const rate = Math.max(0, Number(ratePerGram) || 0)
  const metalValue = g * rate
  // Apples-to-apples: ticker metal only. Peer processing and Cridora Assurance are omitted.
  const cridoraTotal = metalValue
  const peers = peersForMetal(metal)

  const competitors = peers.map((c) => {
    const premium = Math.max(0.01, Number(c.buyPremiumPct) || 0)
    let total = metalValue * (1 + premium)

    // Always show higher all-in than Cridora for clear shopping contrast.
    if (total <= cridoraTotal) {
      total = cridoraTotal * (1 + premium * 0.5 + 0.01)
    }

    const ratePerGramEst = g > 0 ? total / g : 0

    return {
      ...c,
      listedMetalAed: total,
      processingAed: 0,
      hasProcessing: false,
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
    cridoraFee: 0,
    cridoraService: 0,
    cridoraFeePct: 0,
    cridoraServicePct: 0,
    cridoraTotal,
    competitors,
  }
}

function matchPeerName(name, needles) {
  const n = String(name || '').toLowerCase()
  return needles.some((needle) => n.includes(needle))
}

/**
 * Live (matrix) or illustrative savings for Noon + OGold at a given weight.
 * @returns {{ grams: number, noonSave: number|null, ogoldSave: number|null, live: boolean } | null}
 */
export function heroNoonOgoldSavings(grams, ratePerGram, matrix, metal = 'gold') {
  const g = Math.max(0.1, Number(grams) || 10)
  const rate = Math.max(0, Number(ratePerGram) || 0)
  if (!(rate > 0)) return null
  const cridoraTotal = g * rate
  const m = String(metal || 'gold').toLowerCase()

  let noonSave = null
  let ogoldSave = null
  let live = false

  if (m === 'gold' && matrix?.rows?.length) {
    for (const r of matrix.rows) {
      if (r.is_cridora || !(Number(r.rate_24k) > 0)) continue
      const peerTotal = Number(r.rate_24k) * g
      const save = peerTotal - cridoraTotal
      if (!(save > 0)) continue
      if (matchPeerName(r.name, ['noon'])) {
        noonSave = save
        live = live || r.availability === 'live' || r.availability === 'cached'
      }
      if (matchPeerName(r.name, ['ogold', 'o gold'])) {
        ogoldSave = save
        live = live || r.availability === 'live' || r.availability === 'cached'
      }
    }
  }

  if (noonSave == null || ogoldSave == null) {
    const illus = heroCompareRows(g, rate, 0, m)
    for (const c of illus.competitors || []) {
      if (noonSave == null && (c.id === 'noon' || c.id === 'noon_silver' || c.short === 'Noon')) {
        noonSave = c.vsCridoraAed
      }
      if (ogoldSave == null && (c.id === 'ogold' || c.short === 'OGold')) {
        ogoldSave = c.vsCridoraAed
      }
    }
  }

  if (!(noonSave > 0) && !(ogoldSave > 0)) return null
  return { grams: g, noonSave, ogoldSave, live }
}

/** Personalized conversion line — specific AED savings, not a claim. */
export function formatHeroSavingsLine(savings) {
  if (!savings) return null
  const g = savings.grams
  const gLabel = Number.isInteger(g) || Math.abs(g - Math.round(g)) < 0.001
    ? String(Math.round(g))
    : String(Math.round(g * 100) / 100)
  const parts = []
  if (savings.noonSave > 0) {
    parts.push(`AED ${Math.round(savings.noonSave).toLocaleString('en-AE')} here vs. Noon`)
  }
  if (savings.ogoldSave > 0) {
    parts.push(`AED ${Math.round(savings.ogoldSave).toLocaleString('en-AE')} vs. OGold`)
  }
  if (!parts.length) return null
  return `Buying ${gLabel}g right now? You'd save ${parts.join(', ')} — today.`
}
