import { useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import DemoShell from './DemoShell'
import { DEMO_PAGES } from './demoMeta'

/** Full-bleed iframe host for the standalone HTML landing demos. */
export default function DemoHtml({ demoId }) {
  const { slug } = useParams()
  const id = demoId || slug
  const demo = useMemo(() => DEMO_PAGES.find((d) => d.id === id || d.slug === id), [id])

  if (!demo?.htmlSrc) {
    return <Navigate to="/demos" replace />
  }

  return (
    <DemoShell activeId={demo.id}>
      <iframe
        title={`${demo.title} — Cridora landing demo`}
        src={demo.htmlSrc}
        className="block w-full border-0"
        style={{ height: 'calc(100dvh - 52px)', background: '#0a0806' }}
        allow="fullscreen"
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </DemoShell>
  )
}
