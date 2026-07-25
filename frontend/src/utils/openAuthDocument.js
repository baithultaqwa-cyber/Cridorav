import { API_AUTH_BASE as API } from '../config'

function blobFromAuthFetchResponse(res) {
  const raw = res.headers.get('Content-Type') || ''
  const mime = raw.split(';')[0].trim() || 'application/octet-stream'
  return res.arrayBuffer().then((buf) => new Blob([buf], { type: mime }))
}

async function errorMessageFor(res) {
  try {
    const data = await res.clone().json()
    if (data && data.detail) return data.detail
  } catch (_) { /* not JSON */ }
  if (res.status === 401) return 'Your session has expired. Please log in again and retry.'
  if (res.status === 403) return "You don't have permission to view this document."
  if (res.status === 404) return 'Document not found.'
  return `Could not open document (error ${res.status}).`
}

/**
 * Shared fetch-as-blob-then-open flow used by all document/proof/ledger viewers below.
 * Surfaces a clear alert on failure instead of silently doing nothing.
 */
async function openAuthBlob(url, token, { rawBlob = true } = {}) {
  if (!token || !url) return
  let res
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  } catch (_) {
    alert('Could not reach the server. Check your connection and try again.')
    return
  }
  if (!res.ok) {
    alert(await errorMessageFor(res))
    return
  }
  const blob = rawBlob ? await res.blob() : await blobFromAuthFetchResponse(res)
  const blobUrl = URL.createObjectURL(blob)
  const win = window.open(blobUrl, '_blank', 'noopener')
  if (!win) alert('Your browser blocked the popup. Please allow popups for this site and try again.')
  setTimeout(() => URL.revokeObjectURL(blobUrl), 180000)
}

/**
 * Open a KYC/KYB document in a new tab using JWT (public /media/kyc_docs/ is blocked).
 */
export async function openAuthDocument(docId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (docId == null) return
  await openAuthBlob(`${API}/documents/${docId}/file/`, token)
}

/**
 * Open admin→vendor bank payout proof (private media; JWT required).
 */
export async function openPayoutProof(payoutId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (payoutId == null) return
  await openAuthBlob(`${API}/payouts/proof/${payoutId}/`, token, { rawBlob: false })
}

/**
 * Open vendor→admin bank repayment proof (private media; JWT required).
 */
export async function openVendorRepaymentProof(repaymentId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (repaymentId == null) return
  await openAuthBlob(`${API}/repayments/proof/${repaymentId}/`, token, { rawBlob: false })
}

/**
 * Open dated EOD PDF ledger (private media; JWT).
 */
export async function openEodLedgerPdf(ledgerId, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  if (ledgerId == null) return
  await openAuthBlob(`${API}/eod-ledger-pdf/${ledgerId}/`, token)
}

/**
 * Open a document by full URL (e.g. superseded snapshot from admin API).
 */
export async function openAuthDocumentUrl(fileUrl, getToken) {
  const token = typeof getToken === 'function' ? getToken() : null
  await openAuthBlob(fileUrl, token)
}
