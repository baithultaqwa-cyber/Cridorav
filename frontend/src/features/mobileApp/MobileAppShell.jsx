import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
// eslint-disable-next-line no-unused-vars -- motion JSX
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useBottomDock } from '../../context/BottomDockContext'
import AppTopBar from './AppTopBar'
import MobileBottomNav from './MobileBottomNav'
import MobileMoreSheet from './MobileMoreSheet'
import {
  DASHBOARD_ROUTE,
  getTabSets,
  titleForSection,
  VENDOR_QUEUE_SECTIONS,
} from './tabConfig'
import { useIsMobileApp } from './useIsMobileApp'
import { sereneTap } from '../../lib/sereneMotion'

function useDockTabsVisible(tabsOn) {
  const { setMobileTabsVisible } = useBottomDock()
  useEffect(() => {
    setMobileTabsVisible?.(Boolean(tabsOn))
    return () => setMobileTabsVisible?.(false)
  }, [tabsOn, setMobileTabsVisible])
}

/**
 * Public-route mobile chrome: top bar + bottom tabs (+ More sheet).
 * Desktop (≥768) renders children only.
 */
export function PublicMobileChrome({
  children,
  hideTabs = false,
  showBack = false,
  title: titleOverride,
}) {
  const isMobile = useIsMobileApp()
  const { user, logout, authFetch } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const reduce = useReducedMotion()

  const { tabs, more, accent } = useMemo(() => {
    const sets = getTabSets('guest')
    if (user) {
      const dash = DASHBOARD_ROUTE[user.user_type] || '/dashboard'
      return {
        ...sets,
        tabs: sets.tabs.map((t) =>
          t.id === 'account' ? { ...t, href: dash, label: 'App' } : t,
        ),
        more: [
          ...sets.more,
          { id: 'dashboard', label: 'Open Dashboard', href: dash },
          { id: 'signout', label: 'Sign Out', action: 'logout' },
        ],
      }
    }
    return sets
  }, [user])

  const tabsOn = isMobile && !hideTabs
  useDockTabsVisible(tabsOn)

  const title = titleOverride || titleForSection(user?.user_type || 'guest', null, pathname)

  const onTabPress = useCallback(
    (tab) => {
      if (tab.isMore) {
        setMoreOpen(true)
        return
      }
      if (tab.href) navigate(tab.href)
    },
    [navigate],
  )

  const onMoreSelect = useCallback(
    async (item) => {
      setMoreOpen(false)
      if (item.action === 'logout') {
        await logout()
        navigate('/')
        return
      }
      if (item.href) navigate(item.href)
    },
    [logout, navigate],
  )

  if (!isMobile) return children

  return (
    <div className="mobile-app-shell">
      <AppTopBar
        title={title}
        showLogo={!showBack}
        showBack={showBack}
        onBack={() => navigate(-1)}
        showBell={Boolean(user) && !hideTabs}
        authFetch={authFetch}
        rightSlot={
          !hideTabs ? (
            <motion.button
              type="button"
              aria-label="More"
              onClick={() => setMoreOpen(true)}
              whileTap={reduce ? undefined : sereneTap}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-dim)]"
            >
              <MoreHorizontal size={20} />
            </motion.button>
          ) : null
        }
      />
      <div
        className={`mobile-app-shell__content ${tabsOn ? 'has-tabs' : 'no-tabs'}`}
      >
        {children}
      </div>
      {tabsOn && (
        <MobileBottomNav
          tabs={tabs}
          accent={accent}
          pathname={pathname}
          moreActive={moreOpen}
          onTabPress={onTabPress}
        />
      )}
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={more}
        accent={accent}
        onSelect={onMoreSelect}
      />
    </div>
  )
}

/**
 * Dashboard mobile bottom tabs driven by role + active section.
 */
export function DashboardMobileNav({
  role,
  sectionKey,
  onSectionChange,
  badges = {},
  moreFilter,
}) {
  const isMobile = useIsMobileApp()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const { tabs, more: moreRaw, accent } = useMemo(() => getTabSets(role), [role])
  const more = useMemo(() => {
    if (!moreFilter) return moreRaw
    return moreRaw.filter(moreFilter)
  }, [moreRaw, moreFilter])

  useDockTabsVisible(isMobile)

  const onTabPress = useCallback(
    (tab) => {
      if (tab.isMore) {
        setMoreOpen(true)
        return
      }
      if (tab.href) {
        navigate(tab.href)
        return
      }
      if (tab.queuesHub) {
        if (VENDOR_QUEUE_SECTIONS.includes(sectionKey)) return
        onSectionChange?.('sellback')
        return
      }
      if (tab.sectionKey) onSectionChange?.(tab.sectionKey)
    },
    [navigate, onSectionChange, sectionKey],
  )

  const onMoreSelect = useCallback(
    async (item) => {
      setMoreOpen(false)
      if (item.action === 'logout') {
        await logout()
        navigate('/')
        return
      }
      if (item.href) {
        navigate(item.href)
        return
      }
      if (item.sectionKey) onSectionChange?.(item.sectionKey)
    },
    [logout, navigate, onSectionChange],
  )

  if (!isMobile) return null

  const moreActive =
    moreOpen ||
    (Boolean(sectionKey) &&
      !tabs.some((t) => !t.isMore && (
        (t.queuesHub && VENDOR_QUEUE_SECTIONS.includes(sectionKey)) ||
        (!t.queuesHub && t.sectionKey === sectionKey)
      )))

  return (
    <>
      <MobileBottomNav
        tabs={tabs}
        accent={accent}
        sectionKey={sectionKey}
        pathname={pathname}
        moreActive={moreActive}
        onTabPress={onTabPress}
        badges={badges}
      />
      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={more}
        accent={accent}
        onSelect={onMoreSelect}
      />
    </>
  )
}

export { AppTopBar, MobileBottomNav, MobileMoreSheet }
export { titleForSection }
