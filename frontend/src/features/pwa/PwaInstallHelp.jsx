import { useCallback, useEffect, useState } from 'react'
import { Download, Share2, Smartphone } from 'lucide-react'

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  )
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS
}

/**
 * Compact install instructions + Android “Install” when the browser fires beforeinstallprompt.
 */
export default function PwaInstallHelp() {
  const [standalone, setStandalone] = useState(() =>
    typeof window !== 'undefined' ? isStandaloneDisplay() : false,
  )
  const [deferred, setDeferred] = useState(null)
  const [ios, setIos] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStandalone(isStandaloneDisplay())
    setIos(isIosDevice())
    const onBip = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    setBusy(true)
    try {
      await deferred.prompt()
      await deferred.userChoice
    } finally {
      setDeferred(null)
      setBusy(false)
    }
  }, [deferred])

  if (standalone) return null

  return (
    <div
      className="mt-6 rounded-xl px-4 py-3 max-w-md"
      style={{
        border: '1px solid rgba(201,168,76,0.2)',
        background: 'rgba(201,168,76,0.05)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Smartphone size={14} className="text-[var(--gold)] flex-shrink-0" aria-hidden />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--gold)]">
          Install Cridora app
        </span>
      </div>
      {deferred ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--text-dim)] leading-snug">
            Add Cridora to your home screen for quick access and a fullscreen experience.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void install()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase disabled:opacity-50"
            style={{
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.35)',
              color: 'var(--gold)',
            }}
          >
            <Download size={14} aria-hidden />
            {busy ? 'Opening…' : 'Install'}
          </button>
        </div>
      ) : ios ? (
        <p className="text-xs text-[var(--text-dim)] leading-relaxed flex gap-2">
          <Share2 size={14} className="text-[var(--gold)] flex-shrink-0 mt-0.5" aria-hidden />
          <span>
            In Safari, tap <strong className="text-[var(--text-soft)]">Share</strong>, then{' '}
            <strong className="text-[var(--text-soft)]">Add to Home Screen</strong>.
          </span>
        </p>
      ) : (
        <p className="text-xs text-[var(--text-dim)] leading-relaxed">
          Use your browser menu: <strong className="text-[var(--text-soft)]">Install app</strong>,{' '}
          <strong className="text-[var(--text-soft)]">Add to Home screen</strong>, or similar. Requires a
          secure connection (<strong className="text-[var(--text-soft)]">https://</strong>) in production.
        </p>
      )}
    </div>
  )
}
