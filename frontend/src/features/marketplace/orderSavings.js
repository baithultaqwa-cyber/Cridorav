import { heroNoonOgoldSavings, heroCompareRows } from '../home/heroCompare'

/**
 * Best-case estimated saving for a marketplace listing / quote.
 * Marketplace surfaces the amount only — competitor names stay on the landing page comparison.
 */
export function listingOrderSavings(item, qty = 1, matrix = null) {
  if (!item) return null
  const units = Math.max(1, Number(qty) || 1)
  const grams = Number(item.totalGrams) * units
  const rate = Number(item.ratePerGram) || Number(item.metalRatePerGram) || 0
  const metal = item.metal === 'silver' ? 'silver' : 'gold'
  if (!(grams > 0) || !(rate > 0)) return null

  const named = heroNoonOgoldSavings(grams, rate, matrix, metal)
  const rows = heroCompareRows(grams, rate, 0, metal)

  const candidates = [
    named?.noonSave,
    named?.ogoldSave,
    ...(rows.competitors || []).map((c) => c.vsCridoraAed),
  ].map(Number).filter((n) => Number.isFinite(n) && n > 0)

  if (!candidates.length) return null

  return {
    grams,
    qty: units,
    bestSave: Math.max(...candidates),
    live: Boolean(named?.live),
  }
}

/** Single unnamed savings line for cards / detail / buy quote. */
export function formatListingSavings(savings) {
  if (!(savings?.bestSave > 0)) return null
  return `You save: AED ${Math.round(savings.bestSave).toLocaleString('en-AE')}`
}
