/**
 * Standalone / installed-PWA boot splash: centered Cridora mark until the app is ready.
 * Works with the static #cridora-boot-splash in index.html (instant paint before React).
 */
import { useEffect, useState } from 'react'
import CridoraLogo from '../../components/CridoraLogo'
import { useAuth } from '../../context/AuthContext'
import { isStandaloneDisplay } from './isStandaloneDisplay'
import './pwaBootSplash.css'

const MIN_MS = 900
const FADE_MS = 420

function removeStaticSplash() {
  const el = document.getElementById('cridora-boot-splash')
  if (!el) return
  el.classList.add('is-exit')
  window.setTimeout(() => el.remove(), FADE_MS)
}

export default function PwaBootSplash() {
  const { loading: authLoading } = useAuth()
  const [standalone] = useState(() =>
    typeof window !== 'undefined' ? isStandaloneDisplay() : false,
  )
  const [visible, setVisible] = useState(standalone)
  const [exiting, setExiting] = useState(false)
  const [mountedAt] = useState(() => Date.now())

  useEffect(() => {
    if (!standalone) {
      removeStaticSplash()
      setVisible(false)
      return undefined
    }
    // Hand off: instant HTML seal → animated CridoraLogo (theme boot)
    const el = document.getElementById('cridora-boot-splash')
    if (el) {
      el.classList.add('is-exit')
      window.setTimeout(() => el.remove(), 280)
    }
    return undefined
  }, [standalone])

  useEffect(() => {
    if (!standalone || authLoading) return undefined

    const elapsed = Date.now() - mountedAt
    const wait = Math.max(0, MIN_MS - elapsed)
    const t = window.setTimeout(() => {
      setExiting(true)
      window.setTimeout(() => setVisible(false), FADE_MS)
    }, wait)
    return () => clearTimeout(t)
  }, [standalone, authLoading, mountedAt])

  if (!standalone || !visible) return null

  return (
    <div
      className={`pwa-boot-splash${exiting ? ' is-exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Cridora"
    >
      <div className="pwa-boot-splash__glow pwa-boot-splash__glow--a" aria-hidden />
      <div className="pwa-boot-splash__glow pwa-boot-splash__glow--b" aria-hidden />
      <div className="pwa-boot-splash__mark">
        <CridoraLogo size="lg" />
      </div>
      <p className="pwa-boot-splash__hint">Opening your vault…</p>
    </div>
  )
}
