import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Dashboard section state synced to `?section=` for deep links / push / tabs.
 * Writes with replace so tab taps do not flood history.
 *
 * @param {string[]} validKeys
 * @param {string} defaultKey
 */
export function useDashboardSection(validKeys, defaultKey) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [section, setSectionState] = useState(() => {
    const s = searchParams.get('section')
    return validKeys.includes(s) ? s : defaultKey
  })

  useEffect(() => {
    const s = searchParams.get('section')
    if (s && validKeys.includes(s) && s !== section) {
      setSectionState(s)
    }
  }, [searchParams, validKeys, section])

  const setSection = useCallback(
    (next) => {
      if (!validKeys.includes(next)) return
      setSectionState(next)
      const params = new URLSearchParams(searchParams)
      if (next === defaultKey) {
        params.delete('section')
      } else {
        params.set('section', next)
      }
      const q = params.toString()
      navigate({ search: q ? `?${q}` : '' }, { replace: true })
    },
    [validKeys, defaultKey, navigate, searchParams],
  )

  return [section, setSection]
}
