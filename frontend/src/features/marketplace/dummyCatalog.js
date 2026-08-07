/** Dummy / preview marketplace catalog — gold & silver only. */

export const PUBLIC_SELLER_LABEL = 'Verified Dealer'

/**
 * Static product templates. Rates attached at runtime from the live ticker.
 * `id` is stable for detail URLs: `/marketplace/product/demo-1`
 */
export const DUMMY_PRODUCT_TEMPLATES = [
  {
    id: 'demo-1',
    name: '24K Gold Bar — 100g',
    shortDesc: 'LBMA Good Delivery–style 999.9 fine gold bar. Assay card included.',
    longDesc:
      'A classic investment bar sized for serious accumulation. Weight and fineness are disclosed on the listing before you commit. Metal remains with the selling UAE dealer — Cridora never takes custody.',
    metal: 'gold',
    purity: '24K',
    form: 'Bar',
    mint: 'LBMA-aligned refinery',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=900&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=900&q=80',
      'https://images.unsplash.com/photo-1610375463636-845fc9aa95a5?w=900&q=80',
      'https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80',
    ],
    totalGrams: 100,
    vatIncluded: false,
    buybackSpread: 2,
    packagingFee: 35,
    rating: 4.9,
    reviews: 312,
    inStock: true,
    badge: 'Best Seller',
    badgeColor: 'gold',
    highlights: ['Assay card', 'Serialised', 'Dealer storage available'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '24K / 999.9' },
      { label: 'Weight', value: '100 g' },
      { label: 'Form', value: 'Cast / minted bar' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-2',
    name: '24K Gold Bar — 50g',
    shortDesc: 'Investment-grade gold bar from a DMCC-licensed dealer network.',
    longDesc:
      'Half the size of the 100g bar with the same purity disclosure. Ideal if you want smaller tickets while still owning allocated physical metal through a verified UAE dealer.',
    metal: 'gold',
    purity: '24K',
    form: 'Bar',
    mint: 'DMCC network dealer',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
      'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=900&q=80',
      'https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80',
    ],
    totalGrams: 50,
    vatIncluded: false,
    buybackSpread: 2,
    packagingFee: 25,
    rating: 4.8,
    reviews: 187,
    inStock: true,
    badge: null,
    badgeColor: null,
    highlights: ['Entry-friendly size', 'Buy-back disclosed', 'Verified dealer'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '24K / 999.9' },
      { label: 'Weight', value: '50 g' },
      { label: 'Form', value: 'Bar' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-3',
    name: 'Fine Silver Bar — 1kg',
    shortDesc: '999 fine silver. Built for portfolio diversification.',
    longDesc:
      'A full-kilogram fine silver bar with VAT treatment shown upfront. Compare the AED/g against banks and marketplaces before you buy — then checkout against the dealer’s live quote.',
    metal: 'silver',
    purity: '999',
    form: 'Bar',
    mint: 'Bullion refinery',
    image: 'https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=900&q=80'],
    totalGrams: 1000,
    vatIncluded: true,
    buybackSpread: 0.15,
    packagingFee: 45,
    rating: 4.7,
    reviews: 98,
    inStock: true,
    badge: 'VAT Incl.',
    badgeColor: 'silver',
    highlights: ['1 kg unit', 'VAT inclusive', 'Diversification size'],
    specs: [
      { label: 'Metal', value: 'Silver' },
      { label: 'Purity', value: '999 fine' },
      { label: 'Weight', value: '1,000 g' },
      { label: 'Form', value: 'Bar' },
      { label: 'VAT', value: 'Included' },
    ],
  },
  {
    id: 'demo-4',
    name: 'Gold Coin — 1oz Krugerrand',
    shortDesc: 'South African 22K gold bullion coin. Legal tender. Globally recognised.',
    longDesc:
      'The Krugerrand remains one of the world’s most liquid gold coins. Listed here at the disclosed 22K rate with sell-back terms visible before checkout.',
    metal: 'gold',
    purity: '22K',
    form: 'Coin',
    mint: 'South African Mint',
    image: 'https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80'],
    totalGrams: 31.1,
    vatIncluded: false,
    buybackSpread: 2,
    packagingFee: 18,
    rating: 4.9,
    reviews: 445,
    inStock: true,
    badge: 'Popular',
    badgeColor: 'gold',
    highlights: ['1 troy oz', 'Legal tender', 'High liquidity'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '22K' },
      { label: 'Weight', value: '31.1 g (1 oz)' },
      { label: 'Form', value: 'Coin' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-5',
    name: 'Silver Coins — 10oz Set',
    shortDesc: 'Austrian Philharmonic-style silver coins. 999 fine. Collector & investor grade.',
    longDesc:
      'A ten-ounce stack of fine silver coins — easier to portion than a kilo bar. Stock can rotate; check availability on the listing.',
    metal: 'silver',
    purity: '999',
    form: 'Coin',
    mint: 'Austrian Mint style',
    image: 'https://images.unsplash.com/photo-1559526324-593bc073d938?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1559526324-593bc073d938?w=900&q=80'],
    totalGrams: 311,
    vatIncluded: true,
    buybackSpread: 0.15,
    rating: 4.7,
    reviews: 72,
    inStock: false,
    badge: 'Limited',
    badgeColor: 'silver',
    highlights: ['10 oz set', 'Portionable', 'VAT inclusive'],
    specs: [
      { label: 'Metal', value: 'Silver' },
      { label: 'Purity', value: '999 fine' },
      { label: 'Weight', value: '311 g (10 oz)' },
      { label: 'Form', value: 'Coins' },
      { label: 'VAT', value: 'Included' },
    ],
  },
  {
    id: 'demo-6',
    name: '24K Gold Granules — 250g',
    shortDesc: 'High-purity gold granules. Ideal for bulk buyers.',
    longDesc:
      'Loose 24K granules for buyers who prefer flexible melt or industrial use cases. Purity and weight are locked in the quote before payment.',
    metal: 'gold',
    purity: '24K',
    form: 'Granules',
    mint: 'Refinery granules',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80'],
    totalGrams: 250,
    vatIncluded: false,
    buybackSpread: 2,
    packagingFee: 55,
    rating: 4.8,
    reviews: 143,
    inStock: true,
    badge: 'Bulk',
    badgeColor: 'gold',
    highlights: ['250 g lot', 'Flexible form', 'Bulk pricing band'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '24K' },
      { label: 'Weight', value: '250 g' },
      { label: 'Form', value: 'Granules' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-7',
    name: '24K Gold Bar — 10g',
    shortDesc: 'Starter bar. Same purity disclosure as larger units.',
    longDesc:
      'A compact 10g bar for first purchases or gifting. Live AED/g matches the ticker tier; packaging fees (if any) appear in the quote.',
    metal: 'gold',
    purity: '24K',
    form: 'Bar',
    mint: 'Minted mini bar',
    image: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1610375461246-83df859d849d?w=900&q=80'],
    totalGrams: 10,
    vatIncluded: false,
    buybackSpread: 2.2,
    packagingFee: 12,
    rating: 4.6,
    reviews: 521,
    inStock: true,
    badge: 'Starter',
    badgeColor: 'gold',
    highlights: ['Low ticket', 'Gift-ready', 'Same 24K purity'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '24K' },
      { label: 'Weight', value: '10 g' },
      { label: 'Form', value: 'Mini bar' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-8',
    name: '22K Gold Jewellery Bar — 20g',
    shortDesc: '22K flat bar popular for jewellery fabricators and retail buyers.',
    longDesc:
      'Priced off the 22K ticker tier. Useful when you want a known karat without jumping to full 24K bullion.',
    metal: 'gold',
    purity: '22K',
    form: 'Bar',
    mint: 'Jewellery wholesale',
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80'],
    totalGrams: 20,
    vatIncluded: false,
    buybackSpread: 2.5,
    rating: 4.5,
    reviews: 88,
    inStock: true,
    badge: null,
    badgeColor: null,
    highlights: ['22K tier', '20 g unit', 'Fabricator friendly'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '22K' },
      { label: 'Weight', value: '20 g' },
      { label: 'Form', value: 'Flat bar' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
  {
    id: 'demo-9',
    name: 'Fine Silver Bar — 100g',
    shortDesc: 'Compact 999 silver for smaller silver allocations.',
    longDesc:
      'A hundred-gram fine silver bar when a kilo feels too large. VAT treatment and buy-back are shown on the listing card and detail page.',
    metal: 'silver',
    purity: '999',
    form: 'Bar',
    mint: 'Minted silver',
    image: 'https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=900&q=80'],
    totalGrams: 100,
    vatIncluded: true,
    buybackSpread: 0.18,
    rating: 4.6,
    reviews: 64,
    inStock: true,
    badge: null,
    badgeColor: null,
    highlights: ['100 g', 'VAT inclusive', 'Easy to store'],
    specs: [
      { label: 'Metal', value: 'Silver' },
      { label: 'Purity', value: '999' },
      { label: 'Weight', value: '100 g' },
      { label: 'Form', value: 'Bar' },
      { label: 'VAT', value: 'Included' },
    ],
  },
  {
    id: 'demo-10',
    name: 'Gold Coin — 1g Maple Leaf style',
    shortDesc: 'Fractional 24K gold coin for gifts and micro-allocations.',
    longDesc:
      'A one-gram gold coin format — useful for gifting or testing the platform with a tiny ticket size. Still matched to a verified dealer listing.',
    metal: 'gold',
    purity: '24K',
    form: 'Coin',
    mint: 'Fractional mint',
    image: 'https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80',
    gallery: ['https://images.unsplash.com/photo-1543699565-003b8adda5fc?w=900&q=80'],
    totalGrams: 1,
    vatIncluded: false,
    buybackSpread: 3,
    rating: 4.4,
    reviews: 210,
    inStock: true,
    badge: 'Gift',
    badgeColor: 'gold',
    highlights: ['1 g', 'Gift size', '24K'],
    specs: [
      { label: 'Metal', value: 'Gold' },
      { label: 'Purity', value: '24K' },
      { label: 'Weight', value: '1 g' },
      { label: 'Form', value: 'Coin' },
      { label: 'VAT', value: 'Excluded' },
    ],
  },
]

export function getDummyTemplate(id) {
  const key = String(id || '')
  return DUMMY_PRODUCT_TEMPLATES.find((t) => t.id === key || t.id === `demo-${key}`) || null
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

/** Resolve AED/g from the public spot payload for gold/silver. */
export function spotGramRate(spot, metal, purity) {
  if (!spot || typeof spot !== 'object') return null
  const p = String(purity || '').trim()
  if (metal === 'gold' && spot.gold && typeof spot.gold === 'object') {
    if (p && typeof spot.gold[p] === 'number' && spot.gold[p] > 0) return spot.gold[p]
    const pu = p.toUpperCase()
    if (pu && typeof spot.gold[pu] === 'number' && spot.gold[pu] > 0) return spot.gold[pu]
    if (/^\d+(\.\d+)?$/.test(p)) {
      const base = Number(spot.gold['24K'] || 0)
      if (base > 0) return round4(base * (parseFloat(p) / 1000))
    }
    const g24 = Number(spot.gold['24K'] || 0)
    return g24 > 0 ? g24 : null
  }
  if (metal === 'silver' && spot.silver && typeof spot.silver === 'object') {
    if (p && typeof spot.silver[p] === 'number' && spot.silver[p] > 0) return spot.silver[p]
    if (/^\d+(\.\d+)?$/.test(p)) {
      const base = Number(spot.silver['999'] || 0)
      if (base > 0) return round4(base * (parseFloat(p) / 1000))
    }
    const s999 = Number(spot.silver['999'] || 0)
    return s999 > 0 ? s999 : null
  }
  return null
}

/** Attach live ticker AED/g to a dummy template. */
export function priceDummyProduct(template, spot) {
  if (!template) return null
  const rate = spotGramRate(spot, template.metal, template.purity)
  if (rate == null || !(rate > 0)) {
    // Still return a row with placeholder rate so detail pages work offline
    const fallback = template.metal === 'silver' ? 6.873 : 478.25
    const spread = Number(template.buybackSpread) || 0
    return listingFromTemplate(template, fallback, spread)
  }
  const spread = Number(template.buybackSpread) || 0
  return listingFromTemplate(template, rate, spread)
}

function listingFromTemplate(t, rate, spread) {
  const buyback = Math.max(0, round4(rate - spread))
  return {
    id: t.id,
    name: t.name,
    shortDesc: t.shortDesc,
    longDesc: t.longDesc,
    metal: t.metal,
    purity: t.purity,
    form: t.form,
    mint: t.mint,
    image: t.image,
    gallery: t.gallery || [t.image],
    highlights: t.highlights || [],
    specs: t.specs || [],
    metalRatePerGram: rate,
    ratePerGram: rate,
    totalGrams: t.totalGrams,
    vatIncluded: t.vatIncluded,
    vendorName: PUBLIC_SELLER_LABEL,
    vendorVerified: true,
    buybackPerGram: buyback,
    buybackSpreadPerGram: spread,
    packagingFee: Number(t.packagingFee) || 0,
    storageFee: Number(t.storageFee) || 0,
    insuranceFee: Number(t.insuranceFee) || 0,
    useLiveRate: true,
    rating: t.rating,
    reviews: t.reviews,
    inStock: t.inStock,
    badge: t.badge || 'Preview',
    badgeColor: t.badgeColor || (t.metal === 'silver' ? 'silver' : 'gold'),
    source: 'demo',
  }
}

export function buildDummyListings(spot) {
  return DUMMY_PRODUCT_TEMPLATES.map((t) => priceDummyProduct(t, spot)).filter(Boolean)
}

export function findPricedProduct(id, spot, liveProducts = []) {
  const key = String(id || '')
  const live = liveProducts.find((p) => p.id === key || p.id === `live-${key}`)
  if (live) return live
  const tpl = getDummyTemplate(key)
  return priceDummyProduct(tpl, spot)
}

export const METAL_DEFAULT_IMAGE = {
  gold: DUMMY_PRODUCT_TEMPLATES[0].image,
  silver: DUMMY_PRODUCT_TEMPLATES[2].image,
}
