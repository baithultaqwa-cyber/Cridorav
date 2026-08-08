import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import GoldMarketMatrix from '../components/GoldMarketMatrix'
import SeoHead from '../components/SeoHead'
import InvestNowBar from '../components/InvestNowBar'
import HomeAtelierHero from '../features/home/HomeAtelierHero'
import { useBottomDock } from '../context/BottomDockContext'
import { useIsMobileApp } from '../features/mobileApp'
import { SITE_ORIGIN } from '../config'

export default function Home() {
  const heroRef = useRef(null)
  const [investPinned, setInvestPinned] = useState(false)
  const { setInvestBarAtBottom } = useBottomDock()
  const isMobileApp = useIsMobileApp()

  /* Hide "Gold Prices Move Daily" during the hero (buy CTA is already there).
     After the hero scrolls away, pin the bar under the navbar. On phone
     (&lt;768) the mobile bottom tabs own the dock — keep this bar off. */
  useEffect(() => {
    if (isMobileApp) {
      setInvestPinned(false)
      return undefined
    }
    let raf = 0
    const navbarHeight = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--navbar-h')
      return parseFloat(v) || 96
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = heroRef.current
        if (!el) return
        const heroFinished = el.getBoundingClientRect().bottom <= navbarHeight() + 8
        setInvestPinned((prev) => (prev === heroFinished ? prev : heroFinished))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [isMobileApp])

  useEffect(() => {
    // Never dock this bar at the bottom on Home — hero already has Buy.
    setInvestBarAtBottom(false)
  }, [setInvestBarAtBottom])

  const homeJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Cridora',
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/pwa-512-goldbar.png`,
      description:
        'Find, compare and buy gold from verified bullion dealers in Dubai on Cridora — a trusted marketplace for smarter gold buying.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Cridora',
      url: `${SITE_ORIGIN}/`,
      description:
        'Your gold. Your choice. Your best deal. Compare offers from verified Dubai bullion dealers.',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_ORIGIN}/marketplace?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ]

  return (
    <>
      <SeoHead
        title="Buy Gold from Verified Dealers in Dubai | Compare & Buy"
        description="Your gold. Your choice. Your best deal. Find, compare and buy gold from verified bullion dealers in Dubai on Cridora."
        path="/"
        jsonLd={homeJsonLd}
      />
      <main className="min-w-0 overflow-x-hidden">
        <HomeAtelierHero heroRef={heroRef} />

        {!isMobileApp && investPinned ? (
          <>
            <InvestNowBar pinned className="invest-now-bar--reveal" />
            <div style={{ height: 'var(--invest-bar-h)' }} aria-hidden="true" />
          </>
        ) : null}

        {/* Live market board — action, not company essay */}
        <GoldMarketMatrix />

        <section
          className="py-14 md:py-20 relative overflow-hidden"
          style={{ background: 'var(--section-wash-a)' }}
        >
          <div className="max-w-lg mx-auto text-center px-6 relative z-10">
            <h2 className="text-2xl md:text-3xl font-black leading-tight mb-3">
              <span className="gradient-gold-text">Ready when you are</span>
            </h2>
            <p className="text-[var(--text-muted)] text-sm md:text-base leading-relaxed mb-8">
              Browse listings or keep shopping the live price above.
            </p>
            <Link to="/marketplace">
              <button type="button" className="btn-gold inline-flex items-center gap-2.5 group">
                Open marketplace
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
            <p className="mt-6 text-xs text-[var(--text-dim)]">
              <Link to="/terms" className="underline-offset-4 hover:underline hover:text-[var(--text-muted)]">
                Terms &amp; details
              </Link>
              {!isMobileApp ? (
                <>
                  {' · '}
                  <Link
                    to="/vendors"
                    className="text-[var(--gold)] underline-offset-4 hover:underline"
                  >
                    Become a vendor
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
