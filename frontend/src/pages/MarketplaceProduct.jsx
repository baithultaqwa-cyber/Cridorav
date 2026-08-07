import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Shield,
  ShoppingCart,
  Package,
  Check,
} from 'lucide-react'
import SeoHead from '../components/SeoHead'
import LoginPromptModal from '../components/LoginPromptModal'
import { useAuth } from '../context/AuthContext'
import { API_AUTH_BASE, SITE_ORIGIN } from '../config'
import { useTickerSpotPrices } from '../lib/spotPriceCache'
import { catalogImageUrl } from '../utils/mediaUrl'
import {
  PUBLIC_SELLER_LABEL,
  findPricedProduct,
  buildDummyListings,
} from '../features/marketplace/dummyCatalog'
import { normalizeLiveProduct } from '../features/marketplace/normalizeLiveProduct'
import {
  listingOrderSavings,
  formatListingSavings,
} from '../features/marketplace/orderSavings'
import ProductImageLoop from '../features/marketplace/ProductImageLoop'

const metalTheme = {
  gold: {
    textClass: 'gradient-gold-text',
    btnBg: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)',
    icon: 'var(--gold)',
    border: 'rgba(232,195,74,0.22)',
  },
  silver: {
    textClass: 'gradient-silver-text',
    btnBg: 'linear-gradient(135deg, var(--silver) 0%, var(--silver-light) 100%)',
    icon: 'var(--silver)',
    border: 'var(--silver-20)',
  },
}

export default function MarketplaceProduct() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: spotPayload } = useTickerSpotPrices()
  const [loginOpen, setLoginOpen] = useState(false)
  const [liveProducts, setLiveProducts] = useState([])
  const [liveLoaded, setLiveLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_AUTH_BASE}/marketplace/`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data) ? data : (data.items || [])
        setLiveProducts(items.map(normalizeLiveProduct).filter((p) => ['gold', 'silver'].includes(p.metal)))
      })
      .catch(() => {
        if (!cancelled) setLiveProducts([])
      })
      .finally(() => {
        if (!cancelled) setLiveLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  const product = useMemo(
    () => findPricedProduct(productId, spotPayload, liveProducts),
    [productId, spotPayload, liveProducts],
  )

  const related = useMemo(() => {
    if (!product) return []
    return buildDummyListings(spotPayload)
      .filter((p) => p.id !== product.id && p.metal === product.metal)
      .slice(0, 3)
  }, [product, spotPayload])

  const theme = metalTheme[product?.metal] || metalTheme.gold
  const gallery = product?.gallery?.length ? product.gallery : product?.image ? [product.image] : []
  const total = product ? product.ratePerGram * product.totalGrams : 0
  const savingsLine = product
    ? formatListingSavings(listingOrderSavings(product, 1))
    : null

  const startBuy = useCallback(() => {
    if (!product?.inStock || product.isOpen === false) return
    if (!user) {
      setLoginOpen(true)
      return
    }
    const buyKey = product.source === 'live'
      ? String(product.id).replace(/^live-/, '')
      : String(product.id)
    navigate(`/marketplace?openBuy=${encodeURIComponent(buyKey)}`)
  }, [product, user, navigate])

  const canBuy = Boolean(product?.inStock && product?.isOpen !== false)

  if (!product && !liveLoaded) {
    return (
      <main className="min-h-[70vh] pt-24 pb-16 px-4">
        <p className="text-center text-[var(--text-faint)] text-sm tracking-widest uppercase">Loading product…</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="min-h-[70vh] pt-24 pb-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          <Package className="mx-auto mb-4 text-[var(--text-dim)]" size={36} />
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Product not found</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            This listing may have been removed or the link is outdated.
          </p>
          <Link to="/marketplace" className="text-[var(--gold)] text-sm font-semibold underline-offset-4 hover:underline">
            Back to marketplace
          </Link>
        </div>
      </main>
    )
  }

  return (
    <>
      <SeoHead
        title={`${product.name} | Cridora Marketplace`}
        description={product.shortDesc || `Buy ${product.metal} in the UAE on Cridora.`}
        path={`/marketplace/product/${product.id}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.longDesc || product.shortDesc,
          image: product.image,
          sku: product.id,
          brand: { '@type': 'Brand', name: 'Cridora' },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'AED',
            price: Number(total.toFixed(2)),
            availability: product.inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: `${SITE_ORIGIN}/marketplace/product/${product.id}`,
          },
        }}
      />

      <main className="min-h-screen min-h-[100dvh] pt-4 md:pt-24 pb-16 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-[var(--text-dim)] hover:text-[var(--gold)] mb-8"
          >
            <ArrowLeft size={14} /> Marketplace
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
            {/* Gallery */}
            <div>
              <div
                className="relative aspect-square rounded-2xl overflow-hidden mb-3"
                style={{ border: `1px solid ${theme.border}`, background: 'rgba(0,0,0,0.35)' }}
              >
                <ProductImageLoop
                  images={gallery}
                  alt={product.name}
                  priority
                  intervalMs={1400}
                  showDots={gallery.length > 1}
                  className="absolute inset-0"
                  fallback={(
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={48} className="text-[var(--text-faint)]" />
                    </div>
                  )}
                />
                {product.badge && (
                  <span
                    className="absolute top-4 left-4 z-10 text-[10px] tracking-widest uppercase font-bold px-2.5 py-1 rounded-sm"
                    style={{ background: 'rgba(232,195,74,0.2)', color: 'var(--gold)' }}
                  >
                    {product.badge}
                  </span>
                )}
                {!product.inStock && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
                    <span className="text-[11px] tracking-[0.2em] uppercase border border-[#444] px-3 py-1.5 text-[#888]">
                      Currently Unavailable
                    </span>
                  </div>
                )}
              </div>
              {gallery.length > 1 && (
                <p className="text-[10px] text-[var(--text-faint)] tracking-widest uppercase">
                  {gallery.length} images · hover to slide
                </p>
              )}
            </div>

            {/* Copy + buy */}
            <div className="flex flex-col min-w-0">
              <p className="text-[11px] tracking-[0.25em] uppercase text-[var(--gold)] mb-3">
                {product.metal} · {product.purity} · {product.form}
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight mb-3">
                {product.name}
              </h1>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6 max-w-prose">
                {product.longDesc || product.shortDesc}
              </p>

              <div className="flex items-center gap-2 mb-6">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(232,195,74,0.15)' }}
                >
                  <Shield size={12} className="text-[var(--gold)]" />
                </div>
                <span className="text-xs text-[var(--text-soft)]">{PUBLIC_SELLER_LABEL}</span>
                {product.vendorVerified && (
                  <span className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-sm text-[var(--gold)] bg-[rgba(232,195,74,0.12)]">
                    Verified
                  </span>
                )}
              </div>

              <div
                className="rounded-2xl p-5 mb-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${theme.border}` }}
              >
                <div className="flex items-end justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1">
                      Your price / g
                    </div>
                    <div className={`text-2xl font-black tabular-nums ${theme.textClass}`}>
                      AED {Number(product.ratePerGram).toFixed(product.metal === 'silver' ? 3 : 2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1">
                      Total · {product.totalGrams}g
                    </div>
                    <div className={`text-xl font-black tabular-nums ${theme.textClass}`}>
                      AED {total.toLocaleString('en-AE', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)]">
                  <span>Customer sell-back</span>
                  <span className="text-right text-emerald-400 tabular-nums">
                    {product.buybackPerGram > 0
                      ? `AED ${(Number(product.buybackPerGram) * Number(product.totalGrams)).toLocaleString('en-AE', { maximumFractionDigits: 2 })} (AED ${Number(product.buybackPerGram).toFixed(2)}/g)`
                      : '—'}
                  </span>
                  <span>VAT</span>
                  <span className="text-right">{product.vatIncluded ? 'Included' : 'Excluded'}</span>
                </div>
                {savingsLine && (
                  <div
                    className="mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}
                  >
                    <span className="font-semibold text-emerald-400">{savingsLine}</span>
                  </div>
                )}
              </div>

              {product.highlights?.length > 0 && (
                <ul className="space-y-2 mb-6">
                  {product.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                      <Check size={14} className="text-[var(--gold)] flex-shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={startBuy}
                disabled={!canBuy}
                className="w-full py-3.5 rounded-lg text-[11px] tracking-widest uppercase font-bold flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
                style={{ background: canBuy ? theme.btnBg : 'rgba(50,50,50,0.5)', color: '#080808' }}
              >
                <ShoppingCart size={14} />
                {!product.inStock
                  ? 'Currently Unavailable'
                  : product.isOpen === false
                    ? 'Dealer Temporarily Closed'
                    : 'Buy now'}
              </button>
              {product.source === 'demo' && (
                <p className="mt-3 text-[10px] text-[var(--text-faint)] leading-relaxed">
                  Preview product — priced from the live Cridora ticker. Not a binding dealer quote.
                </p>
              )}
            </div>
          </div>

          {/* Specs */}
          {product.specs?.length > 0 && (
            <section className="mt-14 pt-10" style={{ borderTop: '1px solid rgba(232,195,74,0.1)' }}>
              <h2 className="text-sm tracking-[0.2em] uppercase text-[var(--gold)] mb-5">Specifications</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3 max-w-3xl">
                {product.specs.map((s) => (
                  <div
                    key={s.label}
                    className="flex justify-between gap-4 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <dt className="text-xs text-[var(--text-dim)]">{s.label}</dt>
                    <dd className="text-xs font-semibold text-[var(--text-primary)] text-right">{s.value}</dd>
                  </div>
                ))}
                {product.mint && (
                  <div
                    className="flex justify-between gap-4 py-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <dt className="text-xs text-[var(--text-dim)]">Mint / source</dt>
                    <dd className="text-xs font-semibold text-[var(--text-primary)] text-right">{product.mint}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-14 pt-10" style={{ borderTop: '1px solid rgba(232,195,74,0.1)' }}>
              <h2 className="text-sm tracking-[0.2em] uppercase text-[var(--gold)] mb-5">
                More {product.metal}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    to={`/marketplace/product/${r.id}`}
                    className="rounded-xl overflow-hidden group"
                    style={{ border: '1px solid rgba(232,195,74,0.12)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={catalogImageUrl(r.image) || r.image}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-xs font-bold text-[var(--text-primary)] mb-1 line-clamp-2">{r.name}</div>
                      <div className={`text-sm font-black tabular-nums ${metalTheme[r.metal]?.textClass || ''}`}>
                        AED {(r.ratePerGram * r.totalGrams).toLocaleString('en-AE', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <LoginPromptModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false)
          startBuy()
        }}
      />
    </>
  )
}
