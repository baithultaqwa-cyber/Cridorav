import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div
          className="w-12 h-12 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin"
          aria-hidden
        />
        <p className="text-xs tracking-[0.16em] uppercase text-[var(--text-dim)]">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />

  if (allowedRoles && !allowedRoles.includes(user.user_type)) {
    const redirects = { admin: '/dashboard/admin', vendor: '/dashboard/vendor', customer: '/dashboard/customer' }
    return <Navigate to={redirects[user.user_type] || '/'} replace />
  }

  return children
}
