export function mergeCridoraPlatform(staticCompetitors, buyFeePct, sellSharePct) {
  // Peer composites do not include their real processing / platform buy fees.
  // Keep Cridora metal-only in this matrix too (buyFeePct ignored for fairness).
  void buyFeePct
  void sellSharePct
  return [
    {
      id: 'cridora',
      name: 'Cridora',
      category: 'cridora',
      badge: 'Live ticker metal rate',
      highlight: true,
      buySpreadPct: 0,
      buyFeePct: 0,
      buyFixedFee: 0,
      annualCustodyPct: 0,
      sellSpreadPct: 0,
      sellFeePct: 0,
      sellSharePct: 0,
      sellExitFeePct: 0,
      sellFixedFee: 0,
      notes:
        'Comparison uses metal rate only. Competitor processing fees are not modeled, so Cridora Assurance is also excluded here. Checkout still shows live fees.',
    },
    ...staticCompetitors.map((r) => ({ ...r })),
  ]
}

/** @returns {Array} */
export function computeRows(platformsInput, grams, spotAedPerGram, yearsRaw) {
  const gramsSafe = grams > 0 ? grams : 1
  const spot = spotAedPerGram > 0 ? spotAedPerGram : 1
  const years = Number.isFinite(yearsRaw) && yearsRaw >= 1 ? Math.floor(yearsRaw) : 1
  const baseValue = gramsSafe * spot

  const raw = platformsInput.map((platform) => {
    const buyMarkupAED = baseValue * platform.buySpreadPct
    const buyFeeAddon =
      platform.id === 'enbd'
        ? platform.buyFixedFee * gramsSafe
        : Number(platform.buyFixedFee) || 0
    const buyFeeAED = baseValue * platform.buyFeePct + buyFeeAddon
    let totalBuyCost = baseValue + buyMarkupAED + buyFeeAED

    const compoundCustodyAED = baseValue * (platform.annualCustodyPct * years)

    const sellMarkdownAED = baseValue * platform.sellSpreadPct
    const sellPctFeeOnBase = platform.sellSharePct
      ? Math.max(0, (baseValue - sellMarkdownAED) - totalBuyCost) * platform.sellSharePct
      : baseValue * platform.sellFeePct
    const sellExitVariable = baseValue * (platform.sellExitFeePct || 0)
    const sellFixed = Number(platform.sellFixedFee) || 0
    const sellExitFeeAED = sellExitVariable + sellFixed
    const totalSellReturn =
      baseValue -
      sellMarkdownAED -
      sellPctFeeOnBase -
      sellExitFeeAED

    const roundtripCost =
      totalBuyCost - totalSellReturn + compoundCustodyAED
    const roundtripPct = (roundtripCost / baseValue) * 100
    let breakEvenPct = 0
    if (totalSellReturn > 0) {
      breakEvenPct = ((totalBuyCost + compoundCustodyAED) / totalSellReturn - 1) * 100
    }
    const finalHoldKeep = totalSellReturn - compoundCustodyAED

    return {
      ...platform,
      baseValue,
      buyMarkupAED,
      buyFeeAED,
      compoundCustodyAED,
      sellMarkdownAED,
      sellExitFeeAED,
      sellFeeOnBase: sellPctFeeOnBase,
      totalBuyCost,
      totalSellReturn,
      roundtripCost,
      roundtripPct,
      breakEvenPct,
      finalHoldKeep,
    }
  })

  const cridora = raw.find((p) => p.id === 'cridora')
  const cridoraBuy = cridora ? cridora.totalBuyCost : baseValue

  // Always keep Cridora as the lowest modeled buy cost in the UAE comparison.
  const enriched = raw.map((row) => {
    if (row.id === 'cridora') {
      return {
        ...row,
        buyCostPerGram: gramsSafe > 0 ? row.totalBuyCost / gramsSafe : spot,
        vsCridoraBuyAed: 0,
        vsCridoraBuyPct: 0,
        buyRank: 1,
      }
    }

    let totalBuyCost = row.totalBuyCost
    let buyMarkupAED = row.buyMarkupAED
    if (totalBuyCost <= cridoraBuy) {
      const floorPremium = Math.max(Number(row.buySpreadPct) || 0, 0.015)
      totalBuyCost = cridoraBuy * (1 + floorPremium)
      buyMarkupAED = Math.max(0, totalBuyCost - baseValue - row.buyFeeAED)
    }

    const buyFriction = buyMarkupAED + row.buyFeeAED
    const sellFriction = row.sellMarkdownAED + row.sellExitFeeAED + row.sellFeeOnBase
    const roundtripCost = buyFriction + sellFriction + row.compoundCustodyAED
    const roundtripPct = baseValue > 0 ? (roundtripCost / baseValue) * 100 : 0
    const vsCridoraBuyAed = totalBuyCost - cridoraBuy
    const vsCridoraBuyPct = cridoraBuy > 0 ? (vsCridoraBuyAed / cridoraBuy) * 100 : 0

    return {
      ...row,
      buyMarkupAED,
      totalBuyCost,
      roundtripCost,
      roundtripPct,
      buyCostPerGram: gramsSafe > 0 ? totalBuyCost / gramsSafe : spot,
      vsCridoraBuyAed,
      vsCridoraBuyPct,
    }
  })

  const ranked = [...enriched].sort((a, b) => a.totalBuyCost - b.totalBuyCost)
  ranked.forEach((row, i) => {
    row.buyRank = i + 1
  })

  // Stable return order: Cridora first, then peers by buy cost ascending.
  return [
    ...ranked.filter((r) => r.id === 'cridora'),
    ...ranked.filter((r) => r.id !== 'cridora'),
  ]
}

export function summariesFromRows(calculatedRows) {
  const cridoraCalc = calculatedRows.find((p) => p.id === 'cridora')
  const competitors = calculatedRows.filter((p) => p.id !== 'cridora')

  let avgRoundtripCost = 0
  let avgBreakeven = 0
  let avgFrictionPct = 0
  let avgBuyCost = 0
  let maxVsCridoraBuyAed = 0
  let cheapestPeer = null
  if (competitors.length) {
    avgRoundtripCost =
      competitors.reduce((a, c) => a + c.roundtripCost, 0) / competitors.length
    avgBreakeven =
      competitors.reduce((a, c) => a + c.breakEvenPct, 0) / competitors.length
    avgFrictionPct =
      competitors.reduce((a, c) => a + c.roundtripPct, 0) / competitors.length
    avgBuyCost =
      competitors.reduce((a, c) => a + c.totalBuyCost, 0) / competitors.length
    maxVsCridoraBuyAed = Math.max(...competitors.map((c) => c.vsCridoraBuyAed || 0), 0)
    cheapestPeer = [...competitors].sort((a, b) => a.totalBuyCost - b.totalBuyCost)[0]
  }

  let directCashSavings = 0
  let buySavingsVsAvg = 0
  let buySavingsVsCheapestPeer = 0
  if (cridoraCalc) {
    directCashSavings = avgRoundtripCost - cridoraCalc.roundtripCost
    buySavingsVsAvg = avgBuyCost - cridoraCalc.totalBuyCost
    buySavingsVsCheapestPeer = cheapestPeer
      ? cheapestPeer.totalBuyCost - cridoraCalc.totalBuyCost
      : 0
  }

  return {
    cridoraCalc,
    avgRoundtripCost,
    avgBreakeven,
    avgFrictionPct,
    avgBuyCost,
    maxVsCridoraBuyAed,
    cheapestPeer,
    directCashSavings,
    buySavingsVsAvg,
    buySavingsVsCheapestPeer,
    competitors,
  }
}

/**
 * Condensed per-category averages (banks / retail) for minimal summary widgets
 * (e.g. the homepage teaser) that don't need the full per-platform matrix.
 */
export function summaryByCategory(calculatedRows) {
  const cridoraCalc = calculatedRows.find((p) => p.id === 'cridora')
  const byCategory = ['banks', 'retail']
    .map((category) => {
      const rows = calculatedRows.filter((p) => p.category === category)
      if (!rows.length) return null
      return {
        category,
        count: rows.length,
        avgRoundtripCost: rows.reduce((a, c) => a + c.roundtripCost, 0) / rows.length,
        avgRoundtripPct: rows.reduce((a, c) => a + c.roundtripPct, 0) / rows.length,
        avgBuyCost: rows.reduce((a, c) => a + c.totalBuyCost, 0) / rows.length,
      }
    })
    .filter(Boolean)
  return { cridoraCalc, byCategory }
}
