/** Client-side guards. Server still re-validates every field. */

export function isEmail(value) {
  const v = String(value || '').trim()
  return v.length > 0 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

export function isUaeMobile(value) {
  const d = String(value || '').replace(/\D/g, '')
  if (d.startsWith('00971')) return /^5\d{8}$/.test(d.slice(5))
  if (d.startsWith('971')) return /^5\d{8}$/.test(d.slice(3))
  if (d.startsWith('0')) return /^05\d{8}$/.test(d)
  return /^5\d{8}$/.test(d)
}

export function passwordIssues(password, { email = '', name = '' } = {}) {
  const p = String(password || '')
  const issues = []
  if (p.length < 8) issues.push('Use at least 8 characters')
  if (p.length > 128) issues.push('Password is too long')
  if (/^\d+$/.test(p)) issues.push('Do not use a number-only password')
  const lower = p.toLowerCase()
  const emailLocal = String(email || '').split('@')[0]?.toLowerCase() || ''
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) {
    issues.push('Do not include your email in the password')
  }
  const n = String(name || '').trim().toLowerCase()
  if (n.length >= 4 && lower.includes(n)) issues.push('Do not include your name in the password')
  return issues
}

export function isOtpCode(value) {
  return /^\d{6}$/.test(String(value || '').replace(/\D/g, ''))
}

export function isPersonName(value) {
  const v = String(value || '').trim()
  return v.length >= 1 && v.length <= 150 && /^[\p{L}\p{M}\s.'.\-]+$/u.test(v)
}

export function isIbanOrAccount(value) {
  const s = String(value || '').replace(/\s+/g, '').toUpperCase()
  if (/^AE\d{21}$/.test(s)) return true
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return true
  if (/^\d{8,18}$/.test(s)) return true
  return false
}

export function isSwiftOrIfsc(value) {
  const s = String(value || '').replace(/\s+/g, '').toUpperCase()
  if (!s) return true
  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(s) || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s)
}

export function isEmiratesId(value) {
  const d = String(value || '').replace(/\D/g, '')
  return d.length === 15 && d.startsWith('784')
}

export function isPassportNo(value) {
  return /^[A-Za-z0-9]{5,12}$/.test(String(value || '').trim())
}

export function isAdultDob(iso) {
  if (!iso) return false
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 18 && age <= 120
}

export function kycFileError(file) {
  if (!file) return 'Choose a file'
  const okType = /^(application\/pdf|image\/(jpeg|jpg|png|webp))$/i.test(file.type || '')
  const okName = /\.(pdf|jpe?g|png|webp)$/i.test(file.name || '')
  if (!okType && !okName) return 'Use PDF, JPG, PNG, or WEBP'
  if (file.size > 10 * 1024 * 1024) return 'File must be 10 MB or smaller'
  return ''
}
