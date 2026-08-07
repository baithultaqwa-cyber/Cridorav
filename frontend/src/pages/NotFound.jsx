import { Link, useLocation } from 'react-router-dom'
import SeoHead from '../components/SeoHead'

export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <main className="min-h-[50vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <SeoHead
        noindex
        title="Page Not Found"
        description="This Cridora page does not exist. Use the homepage or marketplace for public browsing."
        path={pathname || '/'}
      />
      <p className="text-[11px] tracking-[0.3em] uppercase text-[var(--gold)] mb-4 font-bold">404</p>
      <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] mb-4">Page not found</h1>
      <p className="text-sm text-[var(--text-muted)] max-w-md mb-10 leading-relaxed">
        The link may be outdated or mistyped.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link to="/" className="btn-gold">
          Homepage
        </Link>
        <Link
          to="/marketplace"
          className="btn-outline-gold"
        >
          Marketplace
        </Link>
      </div>
    </main>
  )
}
