import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePushNotifications } from '../pushNotifications/usePushNotifications'
import AtelierLiveBuy from '../../pages/demo/AtelierLiveBuy'
import AtelierSpotTicker from '../../pages/demo/AtelierSpotTicker'
import HomeHeroCoin from './HomeHeroCoin'
import '../../pages/demo/atelier.css'
import './homeAtelierHero.css'

const FONT_ID = 'cridora-atelier-fonts'

/**
 * Production landing hero — one clear promise, calm whitespace, live buy.
 * Alert CTA enables Web Push; hidden once the user is already subscribed.
 */
export default function HomeAtelierHero({ heroRef }) {
  const { authFetch, user } = useAuth()
  // Guests must subscribe without Authorization — a Bearer-null JWT 401s AllowAny routes.
  const push = usePushNotifications(user ? authFetch : undefined)
  const [notifyMsg, setNotifyMsg] = useState('')

  useEffect(() => {
    if (document.getElementById(FONT_ID)) return undefined
    const link = document.createElement('link')
    link.id = FONT_ID
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500;600;700&display=swap'
    document.head.appendChild(link)
    return undefined
  }, [])

  const showAlertCta = push.supported && !push.subscribed

  const onNotify = async () => {
    if (push.busy || push.subscribed) return
    setNotifyMsg('')
    const result = await push.enable()
    if (result?.ok) {
      setNotifyMsg('You’re set — we’ll alert you on price movements.')
      return
    }
    if (result?.error === 'ios_install_required') {
      setNotifyMsg('On iPhone, add Cridora to your Home Screen first, then tap again.')
    } else if (result?.error === 'denied') {
      setNotifyMsg('Notifications are blocked in browser settings.')
    } else if (result?.error === 'unsupported') {
      setNotifyMsg('Alerts need a browser that supports notifications.')
    } else {
      setNotifyMsg('Couldn’t enable alerts — try again in a moment.')
    }
  }

  return (
    <div ref={heroRef} className="lp home-lp">
      <AtelierSpotTicker />

      <section className="lp-hero lp-hero--buy home-lp-hero">
        <div className="lp-hero-grain" aria-hidden="true" />
        <div className="home-lp-ambient home-lp-ambient--a" aria-hidden="true" />
        <div className="home-lp-ambient home-lp-ambient--b" aria-hidden="true" />
        <div className="lp-hero-inner home-lp-inner">
          <div className="lp-hero-copy home-lp-copy">
            <h1 className="lp-headline home-lp-headline">
              Your gold. Your choice. Your best deal.
            </h1>
            <p className="home-lp-subhead">
              Find, compare &amp; buy gold from verified dealers in Dubai
            </p>
            <p className="lp-lede home-lp-lede home-lp-body">
              Cridora brings Dubai&apos;s bullion dealers and gold buyers together in one trusted
              marketplace. Compare offers, check dealer credibility, and make your next gold
              purchase with confidence.
            </p>
            <p className="home-lp-trust">
              Verified bullion dealers · Transparent offers · Smarter gold buying
            </p>

            <div className="home-lp-visual">
              <HomeHeroCoin />
            </div>

            <div className="lp-cta home-lp-cta">
              <a className="btn btn-gold sz-lg" href="#buy">
                Start buying gold
              </a>
              {showAlertCta ? (
                <button
                  type="button"
                  className="btn btn-line sz-lg"
                  onClick={onNotify}
                  disabled={push.busy}
                >
                  {push.busy ? 'Enabling…' : 'Alert me on price movements'}
                </button>
              ) : null}
            </div>
            <p className="home-lp-cta-note">Compare. Choose. Buy with confidence.</p>
            {notifyMsg ? (
              <p className="home-lp-notify-note" role="status">
                {notifyMsg}
              </p>
            ) : null}
          </div>
          <AtelierLiveBuy
            variant="hero"
            initialGrams={10}
            panelTitle="Live price"
            showPersonalSavings={false}
          />
        </div>
      </section>
    </div>
  )
}
