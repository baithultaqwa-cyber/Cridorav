import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

import { API_AUTH_BASE as API } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const refreshInFlight = useRef(null)

  const getToken = () => localStorage.getItem('access_token')
  const getRefresh = () => localStorage.getItem('refresh_token')

  const storeTokens = (access, refresh) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }

  const clearTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('cridora_user')
  }

  const storeUser = (userData) => {
    localStorage.setItem('cridora_user', JSON.stringify(userData))
    setUser(userData)
  }

  useEffect(() => {
    const saved = localStorage.getItem('cridora_user')
    const token = getToken()
    if (saved && token) {
      setUser(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlight.current) {
      return refreshInFlight.current
    }
    const refresh = getRefresh()
    if (!refresh) {
      return null
    }
    const p = (async () => {
      try {
        const res = await fetch(`${API}/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.access) {
          return null
        }
        const nextRefresh = data.refresh != null ? data.refresh : refresh
        storeTokens(data.access, nextRefresh)
        return data.access
      } catch {
        return null
      } finally {
        refreshInFlight.current = null
      }
    })()
    refreshInFlight.current = p
    return p
  }, [])

  const authFetch = useCallback(
    async (url, options = {}) => {
      const { headers: optHeaders, ...rest } = options
      const makeHeaders = (accessToken) => {
        const h = { Authorization: `Bearer ${accessToken}` }
        if (!(rest.body instanceof FormData)) {
          h['Content-Type'] = 'application/json'
        }
        return { ...h, ...optHeaders, Authorization: `Bearer ${accessToken}` }
      }
      const exec = (accessToken) =>
        fetch(url, {
          ...rest,
          headers: makeHeaders(accessToken),
        })
      let token = getToken()
      let res = await exec(token)
      if (res.status !== 401) {
        return res
      }
      if (String(url).includes('token/refresh')) {
        clearTokens()
        setUser(null)
        throw new Error('Session expired. Please sign in again.')
      }
      const newAccess = await refreshAccessToken()
      if (!newAccess) {
        clearTokens()
        setUser(null)
        throw new Error('Session expired. Please sign in again.')
      }
      res = await exec(newAccess)
      if (res.status === 401) {
        clearTokens()
        setUser(null)
        throw new Error('Session expired. Please sign in again.')
      }
      return res
    },
    [refreshAccessToken],
  )

  const login = async (email, password) => {
    const res = await fetch(`${API}/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw data
    storeTokens(data.access, data.refresh)
    const userData = {
      id: data.user_id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      user_type: data.user_type,
      kyc_status: data.kyc_status,
      kyc_status_effective: data.kyc_status,
      vendor_company: data.vendor_company,
    }
    storeUser(userData)
    return userData
  }

  const register = async (payload) => {
    const res = await fetch(`${API}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw data
    storeTokens(data.access, data.refresh)
    const userData = {
      id: data.user_id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      user_type: data.user_type,
      kyc_status: data.kyc_status,
      kyc_status_effective: data.kyc_status,
    }
    storeUser(userData)
    return userData
  }

  const refreshUser = useCallback(async () => {
    if (!getToken() && !getRefresh()) return
    try {
      const res = await authFetch(`${API}/me/`, { method: 'GET' })
      if (!res.ok) return
      const data = await res.json()
      const updated = {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        user_type: data.user_type,
        kyc_status: data.kyc_status,
        kyc_status_effective: data.kyc_status_effective ?? data.kyc_status,
        compliance: data.compliance,
        vendor_company: data.vendor_company,
      }
      storeUser(updated)
    } catch {
      // authFetch already cleared session on unrecoverable 401; ignore
    }
  }, [authFetch])

  const updateKycStatus = (newStatus) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, kyc_status: newStatus }
      localStorage.setItem('cridora_user', JSON.stringify(updated))
      return updated
    })
  }

  const loginWithTokens = (data) => {
    storeTokens(data.access, data.refresh)
    const userData = {
      id: data.user_id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      user_type: data.user_type,
      kyc_status: data.kyc_status,
      kyc_status_effective: data.kyc_status,
      vendor_company: data.vendor_company,
    }
    storeUser(userData)
    return userData
  }

  const logout = useCallback(async () => {
    const refresh = getRefresh()
    const token = getToken()
    if (refresh && token) {
      try {
        await fetch(`${API}/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refresh }),
        })
      } catch (_) {
        // ignore
      }
    }
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithTokens,
        logout,
        authFetch,
        getToken,
        updateKycStatus,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
