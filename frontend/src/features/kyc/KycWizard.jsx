import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Upload, FileText } from 'lucide-react'
import { API_AUTH_BASE } from '../../config'
import { useAuth } from '../../context/AuthContext'
import KycProgressBar from './KycProgressBar'
import { isAdultDob, isEmiratesId, isPassportNo, isPersonName, kycFileError } from '../../lib/formValidation'

const WIZARD_DOCS = [
  { doc_type: 'emirates_id_front', label: 'Emirates ID — front' },
  { doc_type: 'emirates_id_back', label: 'Emirates ID — back' },
  { doc_type: 'passport_front', label: 'Passport — bio page' },
  { doc_type: 'passport_back', label: 'Passport — back / visa page' },
]

const inputClass = 'w-full px-4 py-3 rounded-xl text-sm text-[var(--text-primary)]'
const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  outline: 'none',
}

export default function KycWizard({ initialProgress, onChanged }) {
  const { authFetch, getToken, refreshUser } = useAuth()
  const [progress, setProgress] = useState(initialProgress || null)
  const [profile, setProfile] = useState({
    full_name: '',
    date_of_birth: '',
    place_of_birth: '',
    nationality: '',
    residency_status: 'resident',
    emirates_id_number: '',
    passport_number: '',
  })
  const [country, setCountry] = useState('United Arab Emirates')
  const [step, setStep] = useState(1)
  const [docs, setDocs] = useState([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const applyPayload = useCallback((data) => {
    if (data?.progress) {
      setProgress(data.progress)
      setStep(data.progress.current_step || 1)
    }
    if (data?.profile) {
      setProfile((p) => ({
        ...p,
        ...data.profile,
        date_of_birth: data.profile.date_of_birth || '',
        residency_status: data.profile.residency_status || 'resident',
      }))
    }
    if (typeof data?.country === 'string') setCountry(data.country || 'United Arab Emirates')
    onChanged?.(data?.progress)
  }, [onChanged])

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_AUTH_BASE}/kyc/progress/`)
      if (!res.ok) return
      applyPayload(await res.json())
    } catch { /* ignore */ }
    try {
      const token = getToken()
      const res = await fetch(`${API_AUTH_BASE}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setDocs(await res.json())
    } catch { /* ignore */ }
  }, [authFetch, applyPayload, getToken])

  useEffect(() => { load() }, [load])

  const saveStep1 = async () => {
    if (!isPersonName(profile.full_name)) {
      setMsg('Enter your full legal name.')
      return
    }
    if (!isAdultDob(profile.date_of_birth)) {
      setMsg('Enter a valid date of birth (18+).')
      return
    }
    if (!(profile.place_of_birth || '').trim() || !(profile.nationality || '').trim()) {
      setMsg('Place of birth and nationality are required.')
      return
    }
    const eid = (profile.emirates_id_number || '').trim()
    const pp = (profile.passport_number || '').trim()
    if (!eid && !pp) {
      setMsg('Enter Emirates ID or passport number.')
      return
    }
    if (eid && !isEmiratesId(eid)) {
      setMsg('Emirates ID should be 15 digits starting with 784.')
      return
    }
    if (pp && !isPassportNo(pp)) {
      setMsg('Passport number looks invalid.')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const res = await authFetch(`${API_AUTH_BASE}/kyc/profile/`, {
        method: 'PATCH',
        body: JSON.stringify({ ...profile, country }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(d.detail || 'Please complete the required fields.')
        return
      }
      applyPayload(d)
      await refreshUser()
      setStep(2)
    } catch {
      setMsg('Connection issue — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const uploadDoc = async (docType, file) => {
    if (!file) return
    const fileErr = kycFileError(file)
    if (fileErr) {
      setMsg(fileErr)
      return
    }
    const token = getToken()
    const form = new FormData()
    form.append('doc_type', docType)
    form.append('file', file)
    setMsg('')
    try {
      const res = await fetch(`${API_AUTH_BASE}/documents/upload/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(d.detail || 'Upload failed.')
        return
      }
      await load()
      setMsg('Document saved.')
    } catch {
      setMsg('Upload failed. Please try again.')
    }
  }

  const submit = async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await authFetch(`${API_AUTH_BASE}/kyc/submit/`, { method: 'POST', body: '{}' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(d.detail || 'Please finish all steps before submitting.')
        if (d.progress) applyPayload(d)
        return
      }
      applyPayload(d)
      await refreshUser()
      setMsg(d.detail || 'Submitted for review.')
    } catch {
      setMsg('Connection issue — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getDoc = (dt) => docs.find((d) => d.doc_type === dt)
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }))

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-primary)] flex items-center gap-2 mb-1">
        <FileText size={14} className="text-[var(--gold)]" /> Identity verification
      </h3>
      <p className="text-[11px] text-[var(--text-dim)] mb-4">
        Three short steps. You can browse rates and your portfolio anytime — we only ask before payment.
      </p>
      <KycProgressBar progress={progress} />
      {msg && <p className="text-xs mb-4" style={{ color: msg.includes('fail') || msg.includes('Please') ? '#f87171' : '#10b981' }}>{msg}</p>}

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { k: 'full_name', label: 'Full name', type: 'text' },
            { k: 'date_of_birth', label: 'Date of birth', type: 'date' },
            { k: 'place_of_birth', label: 'Place of birth', type: 'text' },
            { k: 'nationality', label: 'Nationality', type: 'text' },
            { k: 'emirates_id_number', label: 'Emirates ID number', type: 'text' },
            { k: 'passport_number', label: 'Passport number', type: 'text' },
          ].map((f) => (
            <div key={f.k} className={f.k === 'full_name' ? 'sm:col-span-2' : ''}>
              <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">{f.label}</label>
              <input type={f.type} value={profile[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} className={inputClass} style={inputStyle} />
            </div>
          ))}
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">Residency</label>
            <select value={profile.residency_status || 'resident'} onChange={(e) => set('residency_status', e.target.value)} className={inputClass} style={inputStyle}>
              <option value="resident">UAE resident</option>
              <option value="visitor">Visitor</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] mb-1.5 block">Country</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
          <div className="sm:col-span-2 mt-2">
            <button type="button" disabled={saving} onClick={saveStep1} className="btn-gold disabled:opacity-50">
              {saving ? 'Saving…' : 'Save & continue'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          {WIZARD_DOCS.map((meta) => {
            const doc = getDoc(meta.doc_type)
            return (
              <label key={meta.doc_type} className="rounded-xl p-4 flex items-center justify-between gap-3 cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{meta.label}</div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    {doc?.status === 'verified' ? 'Verified' : doc?.file_url || doc?.original_filename ? (doc.status === 'rejected' ? 'Rejected — tap to re-upload' : 'Uploaded') : 'PDF or image · tap to upload'}
                  </div>
                </div>
                {doc?.file_url || doc?.original_filename ? <CheckCircle size={16} className="text-emerald-400 shrink-0" /> : <Upload size={16} className="text-[var(--gold)] shrink-0" />}
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => { uploadDoc(meta.doc_type, e.target.files?.[0]); e.target.value = '' }} />
              </label>
            )
          })}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-xs text-[var(--text-dim)]" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Back</button>
            <button type="button" onClick={() => setStep(3)} className="btn-gold">Continue to review</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="rounded-xl p-4 mb-4 text-sm text-[var(--text-soft)]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-semibold text-[var(--text-primary)] mb-2">{profile.full_name || '—'}</p>
            <p className="text-xs leading-relaxed">
              DOB {profile.date_of_birth || '—'} · Born {profile.place_of_birth || '—'} · {profile.nationality || '—'} · {profile.residency_status || '—'}
            </p>
            <p className="text-xs mt-2">EID {profile.emirates_id_number || '—'} · Passport {profile.passport_number || '—'}</p>
          </div>
          {progress?.submitted && (
            <p className="text-xs text-emerald-400 mb-3">Submitted — our team is reviewing. You will be able to pay once approved.</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-xs text-[var(--text-dim)]" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Back</button>
            <button type="button" disabled={saving || progress?.submitted} onClick={submit} className="btn-gold disabled:opacity-50">
              {saving ? 'Submitting…' : progress?.submitted ? 'Submitted' : 'Submit for review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
