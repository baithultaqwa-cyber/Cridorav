import { catalogImageUrl } from '../../utils/mediaUrl'
import { METAL_DEFAULT_IMAGE, PUBLIC_SELLER_LABEL } from './dummyCatalog'

/** Map a public marketplace API row into the listing shape used by cards + detail. */
export function normalizeLiveProduct(p) {
  const metal = ['gold', 'silver'].includes(p.metal) ? p.metal : 'gold'
  const useLive = Boolean(p.use_live_rate)
  const spread = Number(p.buyback_spread_per_gram ?? p.buyback_per_gram ?? 0)
  const rawGallery = Array.isArray(p.gallery) ? p.gallery : []
  const galleryUrls = rawGallery
    .map((g) => (typeof g === 'string' ? g : g?.url))
    .map((u) => catalogImageUrl(u) || u)
    .filter(Boolean)
  const image = galleryUrls[0]
    || catalogImageUrl(p.image_url)
    || METAL_DEFAULT_IMAGE[metal]
    || METAL_DEFAULT_IMAGE.gold
  const gallery = galleryUrls.length ? galleryUrls : (image ? [image] : [])
  const shortDesc = `${p.purity} fine ${p.metal}. ${p.weight}g · ${p.vat_inclusive ? 'VAT incl.' : `+${p.vat_pct}% VAT`}`
  return {
    id: `live-${p.id}`,
    name: p.name,
    shortDesc,
    longDesc: p.description || shortDesc,
    metal,
    purity: p.purity || '',
    form: p.form || 'Bar',
    mint: p.vendor_name || PUBLIC_SELLER_LABEL,
    image,
    gallery,
    highlights: [
      p.vat_inclusive ? 'VAT inclusive' : 'VAT disclosed',
      'Verified dealer',
      'Live quote',
    ],
    specs: [
      { label: 'Metal', value: String(metal).replace(/^\w/, (c) => c.toUpperCase()) },
      { label: 'Purity', value: String(p.purity || '—') },
      { label: 'Weight', value: `${p.weight} g` },
      { label: 'VAT', value: p.vat_inclusive ? 'Included' : `+${p.vat_pct ?? 0}%` },
      { label: 'Dealer', value: p.vendor_name || PUBLIC_SELLER_LABEL },
    ],
    metalRatePerGram: p.cridora_rate_per_gram ?? p.effective_rate ?? 0,
    ratePerGram: p.final_rate_per_gram,
    vendorCostPerGram: p.vendor_cost_per_gram ?? null,
    spreadPerGram: p.spread_per_gram ?? null,
    totalGrams: p.weight,
    vatIncluded: p.vat_inclusive,
    vatPct: p.vat_pct ?? 0,
    packagingFee: p.packaging_fee ?? 0,
    storageFee: p.storage_fee ?? 0,
    insuranceFee: p.insurance_fee ?? 0,
    vendorName: PUBLIC_SELLER_LABEL,
    vendorDisplayName: p.vendor_name || PUBLIC_SELLER_LABEL,
    vendorId: p.vendor_id || null,
    vendorVerified: p.vendor_verified !== false,
    vendorManualKyc: Boolean(p.vendor_manual_kyc),
    customerVerificationStatus: p.customer_verification_status || null,
    buybackPerGram: p.effective_buyback_per_gram ?? p.buyback_per_gram ?? 0,
    useLiveRate: useLive,
    buybackSpreadPerGram: useLive ? spread : 0,
    rating: null,
    reviews: null,
    inStock: p.in_stock,
    isOpen: p.is_open !== false,
    badge: 'Live',
    badgeColor: 'gold',
    source: 'live',
  }
}
