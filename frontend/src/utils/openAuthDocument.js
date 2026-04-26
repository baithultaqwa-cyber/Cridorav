import { API_AUTH_BASE as API } from '../config'

function blobFromAuthFetchResponse(res) {
  const raw = res.headers.get('Content-Type') || ''
  const mime = raw.split(';')[0].trim() || 'application/octet-stream'
  return res.arrayBuffer().then((buf) => new Blob([buf], { type: mime }))
}

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

/**
 * Open a document by full URL (e.g. superseded snapshot from admin API).
 */
/**
 * Open admin→vendor bank payout proof (private media; JWT required).
 */
export async function openPayoutProof(payoutId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || payoutId == null) return
  const res = await fetch(`${API}/payouts/proof/${payoutId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const blob = await blobFromAuthFetchResponse(res)
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}

/**
 * Open vendor→admin bank repayment proof (private media; JWT required).
 */
export async function openVendorRepaymentProof(repaymentId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || repaymentId == null) return
  const res = await fetch(`${API}/repayments/proof/${repaymentId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const blob = await blobFromAuthFetchResponse(res)
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}

/**
 * Open dated EOD PDF ledger (private media; JWT).
 */
export async function openEodLedgerPdf(ledgerId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || ledgerId == null) return
  const res = await fetch(`${API}/eod-ledger-pdf/${ledgerId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}

export async function openAuthDocumentUrl(fileUrl, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (!token || !fileUrl) return
  const res = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}
