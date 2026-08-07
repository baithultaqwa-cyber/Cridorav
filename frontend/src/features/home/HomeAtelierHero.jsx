import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { API_MARKET_MATRIX, API_SPOT_PRICES } from '../../config'
import { writeSpotPriceCache, useTickerSpotPrices } from '../../lib/spotPriceCache'
import { enablePushNotifications, pushApiSupported } from '../pushNotifications/enablePush'
import {
  formatHeroSavingsLine,
  heroNoonOgoldSavings,
} from './heroCompare'
import AtelierLiveBuy from '../../pages/demo/AtelierLiveBuy'
import AtelierSpotTicker from '../../pages/demo/AtelierSpotTicker'
import '../../pages/demo/atelier.css'
import './homeAtelierHero.css'

const FONT_ID = 'cridora-atelier-fonts'
const FALLBACK_GOLD_24 = 478.25

function fmtAed(n, digits = 2) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-AE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function pickGold24(data) {
  const v = Number(data?.gold?.['24K'])
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Production landing hero — Atelier layout + conversion copy.
 * heroRef is used by Home for InvestNowBar pin logic.
 */
export default function HomeAtelierHero({ heroRef }) {
  const { authFetch } = useAuth()
  const { data: tickerSpot } = useTickerSpotPrices()
  const [gold24, setGold24] = useState(() => pickGold24(tickerSpot) || FALLBACK_GOLD_24)
  const [matrix, setMatrix] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const [ageSec, setAgeSec] = useState(0)
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

  const refreshSpot = useCallback(async () => {
    try {
      const res = await fetch(API_SPOT_PRICES, { cache: 'no-store' })
      if (!res.ok) throw new Error('http')
      const data = await res.json()
      writeSpotPriceCache(data)
      const next = pickGold24(data)
      if (next != null) {
        setGold24(next)
        setFetchedAt(Date.now())
      }
    } catch {
      const cached = pickGold24(tickerSpot)
      if (cached != null) setGold24(cached)
    }
  }, [tickerSpot])

  const refreshMatrix = useCallback(async () => {
    try {
      const res = await fetch(API_MARKET_MATRIX, { cache: 'no-store' })
      if (!res.ok) throw new Error('http')
      setMatrix(await res.json())
    } catch {
      /* keep last */
    }
  }, [])

  useEffect(() => {
    void refreshSpot()
    void refreshMatrix()
    const id = setInterval(() => {
      void refreshSpot()
      void refreshMatrix()
    }, 45_000)
    return () => clearInterval(id)
  }, [refreshSpot, refreshMatrix])

  useEffect(() => {
    const cached = pickGold24(tickerSpot)
    if (cached != null) {
      setGold24(cached)
      setFetchedAt(Date.now())
    }
  }, [tickerSpot])

  useEffect(() => {
    const tick = () => setAgeSec(Math.max(0, Math.floor((Date.now() - fetchedAt) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fetchedAt])

  const ageLabel =
    ageSec < 5
      ? 'updated seconds ago'
      : ageSec < 60
        ? `updated ${ageSec}s ago`
        : `updated ${Math.floor(ageSec / 60)}m ago`

  const savings = useMemo(
    () => heroNoonOgoldSavings(10, gold24, matrix, 'gold'),
    [gold24, matrix],
  )
  const savingsLine = formatHeroSavingsLine(savings)

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
      setNotifyMsg('You’re on the list — we’ll ping you when gold drops.')
      return
    }
    setNotifyState('error')
    if (result.error === 'ios_install_required') {
      setNotifyMsg('On iPhone, add Cridora to your Home Screen first, then tap again.')
    } else if (result.error === 'denied') {
      setNotifyMsg('Notifications are blocked in browser settings.')
    } else {
      setNotifyMsg('Couldn’t enable alerts right now — try again in a moment.')
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
            <p className="home-lp-eyebrow">
              Live 24K gold — AED {fmtAed(gold24, 2)}/g, {ageLabel}
            </p>
            <h1 className="lp-headline home-lp-headline">
              The price everyone else marks up. We just show it to you.
            </h1>
            <p className="lp-lede home-lp-lede">
              Matched instantly with licensed UAE dealers, allocated to you — not pooled. Checked
              cheaper than OGold, Noon, and every bank, every day.
            </p>

            {savingsLine ? (
              <p className="home-lp-savings" role="status">
                {savingsLine}
              </p>
            ) : null}

            <div className="lp-cta home-lp-cta">
              <a className="btn btn-gold sz-lg" href="#buy">
                Buy at live price
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
                    : 'Notify me when gold drops'}
              </button>
            </div>
            <p className="home-lp-notify-note">
              {notifyMsg ||
                'We’ll only message you when the price is worth it — never more than that.'}
            </p>
          </div>
          <AtelierLiveBuy
            variant="hero"
            initialGrams={10}
            panelTitle="Buying now? See your exact savings."
            showPersonalSavings
          />
        </div>
      </section>

      <div className="home-lp-proof" role="region" aria-label="Trust facts">
        <div className="home-lp-proof-badges">
          <span className="home-lp-badge home-lp-badge--success">Licensed · KhairaX FZC LLC</span>
          <span className="home-lp-badge home-lp-badge--warn">Insured · Dubai National Insurance</span>
          <span className="home-lp-badge home-lp-badge--neutral">Allocated · Not pooled</span>
        </div>
        <Link className="home-lp-proof-link" to="/vendors">
          Book a dealer visit
        </Link>
      </div>
    </div>
  )
}
