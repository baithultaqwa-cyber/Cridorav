import { API_AUTH_BASE as API } from '../config'

/**
 * Rebuild a server-provided /api/auth/... URL with the app-configured API origin
 * (avoids bad hosts from build_absolute_uri behind reverse proxies, and fixes
 * same-path fetches from the browser).
 */
function resolveAuthFileRequestUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null
  try {
    const parsed = new URL(fileUrl, window.location.href)
    const p = parsed.pathname
    const prefix = '/api/auth'
    const i = p.indexOf(prefix)
    if (i === -1) return fileUrl
    const rest = p.slice(i + prefix.length)
    const path = (rest.startsWith('/') ? rest : `/${rest}`) + (parsed.search || '')
    return `${String(API).replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  } catch {
    return fileUrl
  }
}

function openArrayBufferInNewTab(data, res, openedWindow) {
  const w = openedWindow
  const rawType = (res && res.headers.get('content-type')) || 'application/octet-stream'
  const type = String(rawType).split(';')[0].trim() || 'application/octet-stream'
  const b = new Blob([data], { type })
  const url = URL.createObjectURL(b)
  if (w) {
    try {
      w.location.replace(url)
    } catch {
      w.close()
    }
    setTimeout(() => URL.revokeObjectURL(url), 300000)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 300000)
}

/**
 * Open a KYC/KYB document in a new tab using JWT (public /media/kyc_docs/ is blocked).
 * Opens a tab synchronously (user gesture) then navigates to the blob, so the browser
 * does not block the window after an async fetch.
 */
export async function openAuthDocument(docId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || docId == null) return
  const w = window.open('about:blank', '_blank')
  try {
    const res = await fetch(`${String(API).replace(/\/$/, '')}/documents/${docId}/file/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (w) {
        try {
          w.document.open()
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:1rem">Could not open document (${res.status}).</body></html>`)
          w.document.close()
        } catch {
          w.close()
        }
      }
      return
    }
    const ab = await res.arrayBuffer()
    openArrayBufferInNewTab(ab, res, w)
  } catch {
    if (w) w.close()
  }
}

/**
 * Open a document by full URL (e.g. admin superseded snapshot). URL is normalized to
 * the app API origin before fetch to avoid CORS / wrong host issues.
 */
export async function openAuthDocumentUrl(fileUrl, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || !fileUrl) return
  const requestUrl = resolveAuthFileRequestUrl(fileUrl) || fileUrl
  const w = window.open('about:blank', '_blank')
  try {
    const res = await fetch(requestUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (w) {
        try {
          w.document.open()
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:1rem">Could not open document (${res.status}).</body></html>`)
          w.document.close()
        } catch {
          w.close()
        }
      }
      return
    }
    const ab = await res.arrayBuffer()
    openArrayBufferInNewTab(ab, res, w)
  } catch {
    if (w) w.close()
  }
}
