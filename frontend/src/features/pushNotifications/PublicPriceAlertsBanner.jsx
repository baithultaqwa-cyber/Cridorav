import { useAuth } from '../../context/AuthContext'
import EnableNotificationsPrompt from './EnableNotificationsPrompt'

/**
 * Signed-out visitors can still enable Web Push for gold/silver price-movement alerts —
 * no account required. Renders the same prompt used in dashboards, just without `authFetch`
 * (so the subscription starts anonymous and gets claimed automatically if they sign in later).
 * Hidden once signed in — dashboards already offer the full notification prompt there.
 */
export default function PublicPriceAlertsBanner() {
  const { user } = useAuth()
  if (user) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <EnableNotificationsPrompt roleLabel="gold & silver price alerts — no sign-up needed" />
    </div>
  )
}
