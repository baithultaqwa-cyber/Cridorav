import { useEffect, useMemo, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import DemoShell from './DemoShell'
import { DEMO_PAGES } from './demoMeta'

/**
 * Host standalone HTML landing demos.
 *
 * Loads via fetch + srcDoc (not iframe src=) so:
 * - Django X-Frame-Options never blocks the preview
 * - SW navigation fallback cannot rewrite the demo document to the SPA shell
 */
export default function DemoHtml({ demoId }) {
  const { slug } = useParams()
  const id = demoId || slug
  const demo = useMemo(() => DEMO_PAGES.find((d) => d.id === id || d.slug === id), [id])
  const [srcDoc, setSrcDoc] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!demo?.htmlSrc) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setSrcDoc('')

    fetch(demo.htmlSrc, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load demo (${res.status})`)
        const html = await res.text()
        // Guard against accidentally receiving the SPA shell (old SW / mis-route).
        if (
          html.includes('id="root"') &&
          !html.includes('three.js') &&
          !html.includes('THREE.')
        ) {
          throw new Error('Demo HTML was replaced by the app shell — hard-refresh and try again')
        }
        // Ensure relative asset URLs resolve from site root inside srcDoc.
        const withBase = html.includes('<base ')
          ? html
          : html.replace(/<head([^>]*)>/i, '<head$1><base href="/" />')
        if (!cancelled) {
          setSrcDoc(withBase)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load demo')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [demo?.htmlSrc])

  if (!demo?.htmlSrc) {
    return <Navigate to="/demos" replace />
  }

  return (
    <DemoShell activeId={demo.id}>
      {error ? (
        <div
          className="flex flex-col items-center justify-center gap-3 px-6 text-center"
          style={{ height: 'calc(100dvh - 52px)', background: '#0a0806' }}
        >
          <p className="text-sm text-[#f2ece0]">{error}</p>
          <a
            href={demo.htmlSrc}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)] underline"
          >
            Open demo in a new tab
          </a>
        </div>
      ) : (
        <iframe
          title={`${demo.title} — Cridora landing demo`}
          srcDoc={loading ? '' : srcDoc}
          className="block w-full border-0"
          style={{ height: 'calc(100dvh - 52px)', background: '#0a0806' }}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      )}
    </DemoShell>
  )
}
