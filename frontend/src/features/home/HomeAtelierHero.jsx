import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { enablePushNotifications, pushApiSupported } from '../pushNotifications/enablePush'
import AtelierLiveBuy from '../../pages/demo/AtelierLiveBuy'
import AtelierSpotTicker from '../../pages/demo/AtelierSpotTicker'
import '../../pages/demo/atelier.css'
import './homeAtelierHero.css'

const FONT_ID = 'cridora-atelier-fonts'

/**
 * Production landing hero — one clear promise, then the live buy panel.
 * Company / legal detail lives on Terms; this surface stays psychologically light.
 */
export default function HomeAtelierHero({ heroRef }) {
  const { authFetch } = useAuth()
  const [notifyState, setNotifyState] = useState('idle')
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

  const onNotify = async () => {
    if (notifyState === 'busy') return
    setNotifyState('busy')
    setNotifyMsg('')
    if (!pushApiSupported()) {
      setNotifyState('error')
      setNotifyMsg('Alerts need a browser that supports notifications.')
      return
    }
    const result = await enablePushNotifications(authFetch)
    if (result.ok) {
      setNotifyState('ok')
      setNotifyMsg('You’ll get a ping when gold drops.')
      return
    }
    setNotifyState('error')
    if (result.error === 'ios_install_required') {
      setNotifyMsg('On iPhone, add Cridora to your Home Screen first, then tap again.')
    } else if (result.error === 'denied') {
      setNotifyMsg('Notifications are blocked in browser settings.')
    } else {
      setNotifyMsg('Couldn’t enable alerts — try again in a moment.')
    }
  }

  return (
    <div className="lp home-lp">
      <AtelierSpotTicker />

      <section ref={heroRef} className="lp-hero lp-hero--buy">
        <div className="lp-hero-grain" aria-hidden="true" />
        <div className="home-lp-ambient home-lp-ambient--a" aria-hidden="true" />
        <div className="home-lp-ambient home-lp-ambient--b" aria-hidden="true" />
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <h1 className="lp-headline home-lp-headline">
              UAE&apos;s lowest trusted gold rate
            </h1>
            <p className="lp-lede home-lp-lede home-lp-tagline">
              Live prices for investors — buy physical gold without the markup.
            </p>

            <div className="lp-cta home-lp-cta">
              <a className="btn btn-gold sz-lg" href="#buy">
                Buy gold
              </a>
              <button
                type="button"
                className="btn btn-line sz-lg"
                onClick={onNotify}
                disabled={notifyState === 'busy' || notifyState === 'ok'}
              >
                {notifyState === 'busy'
                  ? 'Enabling…'
                  : notifyState === 'ok'
                    ? 'Alerts on'
                    : 'Alert me on dips'}
              </button>
            </div>
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
