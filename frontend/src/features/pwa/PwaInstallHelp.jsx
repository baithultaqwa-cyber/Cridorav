import { useCallback, useEffect, useState } from 'react'
import { Download, Share2, Smartphone } from 'lucide-react'
import { isStandaloneDisplay } from './isStandaloneDisplay'

function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iOS
}

function IosInstallSteps() {
  return (
    <div className="flex gap-2.5">
      <Share2 size={14} className="text-[var(--gold)] flex-shrink-0 mt-0.5" aria-hidden />
      <div className="text-xs text-[var(--text-dim)] leading-relaxed">
        <p className="font-semibold text-[var(--text-soft)] mb-0.5">iPhone &amp; iPad (Safari)</p>
        <p>
          Open this site in <strong className="text-[var(--text-soft)]">Safari</strong>. Tap{' '}
          <strong className="text-[var(--text-soft)]">Share</strong>
          <span className="text-[var(--text-muted)]"> (square with arrow)</span>, then{' '}
          <strong className="text-[var(--text-soft)]">Add to Home Screen</strong>, then{' '}
          <strong className="text-[var(--text-soft)]">Add</strong>.
        </p>
      </div>
    </div>
  )
}

function AndroidChromeSteps({ deferred, busy, onInstall }) {
  return (
    <div className="text-xs text-[var(--text-dim)] leading-relaxed">
      <p className="font-semibold text-[var(--text-soft)] mb-1.5">Android &amp; desktop (Chrome, Edge)</p>
      {deferred ? (
        <div className="flex flex-col gap-2">
          <p>Add Cridora to your home screen for quick access and a fullscreen experience.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onInstall()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase disabled:opacity-50 w-fit"
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
      ) : (
        <p>
          Use the browser menu: <strong className="text-[var(--text-soft)]">Install app</strong>,{' '}
          <strong className="text-[var(--text-soft)]">Add to Home screen</strong>, or similar (often under{' '}
          <strong className="text-[var(--text-soft)]">⋮</strong> or <strong className="text-[var(--text-soft)]">⋯</strong>
          ).
        </p>
      )}
    </div>
  )
}

/**
 * Footer install instructions: Android/Chrome when available + iOS (Safari) for everyone not already in standalone.
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
      <div className="flex items-center gap-2 mb-3">
        <Smartphone size={14} className="text-[var(--gold)] flex-shrink-0" aria-hidden />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--gold)]">
          Install Cridora app
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {ios ? (
          <>
            <IosInstallSteps />
            <div
              className="pt-3 border-t gap-3 flex flex-col"
              style={{ borderColor: 'rgba(201,168,76,0.12)' }}
            >
              <AndroidChromeSteps deferred={deferred} busy={busy} onInstall={install} />
            </div>
          </>
        ) : (
          <>
            <AndroidChromeSteps deferred={deferred} busy={busy} onInstall={install} />
            <div
              className="pt-3 border-t gap-3 flex flex-col"
              style={{ borderColor: 'rgba(201,168,76,0.12)' }}
            >
              <IosInstallSteps />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
