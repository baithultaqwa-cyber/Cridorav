import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Tracks fixed bottom docks so banners (install CTA, etc.) can stack cleanly:
 * - investBarAtBottom: Home "Buy Gold" bar at viewport bottom (desktop/tablet)
 * - mobileTabsVisible: MobileBottomNav is mounted (&lt;768px app chrome)
 *
 * Install CTA should sit above: tabs (if any) → invest bar (if bottom) → safe area.
 */
const BottomDockContext = createContext({
  investBarAtBottom: false,
  setInvestBarAtBottom: () => {},
  mobileTabsVisible: false,
  setMobileTabsVisible: () => {},
})

export function BottomDockProvider({ initialAtBottom = false, children }) {
  const [investBarAtBottom, setInvestBarAtBottom] = useState(initialAtBottom)
  const [mobileTabsVisible, setMobileTabsVisible] = useState(false)

  useEffect(() => {
    setInvestBarAtBottom(initialAtBottom)
  }, [initialAtBottom])

  return (
    <BottomDockContext.Provider
      value={{
        investBarAtBottom,
        setInvestBarAtBottom,
        mobileTabsVisible,
        setMobileTabsVisible,
      }}
    >
      {children}
    </BottomDockContext.Provider>
  )
}

export function useBottomDock() {
  return useContext(BottomDockContext)
}
