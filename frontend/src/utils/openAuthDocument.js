import { API_AUTH_BASE as API } from '../config'

/**
 * Open a KYC/KYB document in a new tab using JWT (public /media/kyc_docs/ is blocked).
 */
export async function openAuthDocument(docId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || docId == null) return
  const res = await fetch(`${API}/documents/${docId}/file/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}
