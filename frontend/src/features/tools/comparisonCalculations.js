export function mergeCridoraPlatform(staticCompetitors, buyFeePct, sellFeePct) {
  const buy = Number(buyFeePct) || 0
  const sell = Number(sellFeePct) || 0
  return [
    {
      id: 'cridora',
      name: 'Cridora (marketplace)',
      category: 'cridora',
      badge: `Quoted metal + platform fee (${buy}% buy / ${sell}% sell — live config)`,
      highlight: true,
      buySpreadPct: 0,
      buyFeePct: buy / 100,
      buyFixedFee: 0,
      annualCustodyPct: 0,
      sellSpreadPct: 0,
      sellFeePct: sell / 100,
      sellExitFeePct: 0,
      sellFixedFee: 0,
      notes:
        'Model uses same gram reference on buy/sell for illustration only; marketplace checkout uses each vendor quote.',
    },
    ...staticCompetitors.map((r) => ({ ...r })),
  ]
}

/** @returns {typeof STATIC_COMPETITORS | Array} */
export function computeRows(platformsInput, grams, spotAedPerGram, yearsRaw) {
  const gramsSafe = grams > 0 ? grams : 1
  const spot = spotAedPerGram > 0 ? spotAedPerGram : 1
  const years = Number.isFinite(yearsRaw) && yearsRaw >= 1 ? Math.floor(yearsRaw) : 1
  const baseValue = gramsSafe * spot

  return platformsInput.map((platform) => {
    const buyMarkupAED = baseValue * platform.buySpreadPct
    const buyFeeAddon =
      platform.id === 'enbd'
        ? platform.buyFixedFee * gramsSafe
        : Number(platform.buyFixedFee) || 0
    const buyFeeAED = baseValue * platform.buyFeePct + buyFeeAddon
    const totalBuyCost = baseValue + buyMarkupAED + buyFeeAED

    const compoundCustodyAED = baseValue * (platform.annualCustodyPct * years)

    const sellMarkdownAED = baseValue * platform.sellSpreadPct
    const sellPctFeeOnBase = baseValue * platform.sellFeePct
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
}

export function summariesFromRows(calculatedRows) {
  const cridoraCalc = calculatedRows.find((p) => p.id === 'cridora')
  const competitors = calculatedRows.filter((p) => p.id !== 'cridora')

  let avgRoundtripCost = 0
  let avgBreakeven = 0
  let avgFrictionPct = 0
  if (competitors.length) {
    avgRoundtripCost =
      competitors.reduce((a, c) => a + c.roundtripCost, 0) /
      competitors.length
    avgBreakeven =
      competitors.reduce((a, c) => a + c.breakEvenPct, 0) /
      competitors.length
    avgFrictionPct =
      competitors.reduce((a, c) => a + c.roundtripPct, 0) / competitors.length
  }

  let directCashSavings = 0
  if (cridoraCalc) {
    directCashSavings = avgRoundtripCost - cridoraCalc.roundtripCost
  }

  return {
    cridoraCalc,
    avgRoundtripCost,
    avgBreakeven,
    avgFrictionPct,
    directCashSavings,
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
      }
    })
    .filter(Boolean)
  return { cridoraCalc, byCategory }
}
