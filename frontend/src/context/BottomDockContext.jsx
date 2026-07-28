import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Tracks whether the "Buy Gold Now" invest bar currently occupies the fixed
 * bottom edge of the viewport (rendered and NOT pinned under the navbar), so
 * other fixed-bottom UI (e.g. the install/notify banner) can dock just above
 * it, then drop straight into the freed bottom spot once the invest bar pins
 * to the top of the page.
 *
 * `initialAtBottom` is derived from the route by `App.jsx` (Home starts with
 * the bar docked at the bottom; every other page keeps it pinned to the top
 * from the start). Home then keeps this in sync as the user scrolls past the
 * hero via `setInvestBarAtBottom`.
 */
const BottomDockContext = createContext({
  investBarAtBottom: false,
  setInvestBarAtBottom: () => {},
})

export function BottomDockProvider({ initialAtBottom = false, children }) {
  const [investBarAtBottom, setInvestBarAtBottom] = useState(initialAtBottom)

  useEffect(() => {
    setInvestBarAtBottom(initialAtBottom)
  }, [initialAtBottom])

  return (
    <BottomDockContext.Provider value={{ investBarAtBottom, setInvestBarAtBottom }}>
      {children}
    </BottomDockContext.Provider>
  )
}

export function useBottomDock() {
  return useContext(BottomDockContext)
}
