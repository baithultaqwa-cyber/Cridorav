import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
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
