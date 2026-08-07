import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, GripVertical, Trash2, Upload, Plus } from 'lucide-react'
import { API_AUTH_BASE } from '../../config'
import { validateCatalogImageFile } from '../../utils/catalogImageValidation'
import { catalogImageUrl } from '../../utils/mediaUrl'

export const CATALOG_GALLERY_MAX = 3

function resolvePreviewUrl(url) {
  if (!url) return null
  if (String(url).startsWith('blob:')) return url
  return catalogImageUrl(url) || url
}

function formatUploadErrorResponse(data, status) {
  if (data?.detail) return String(data.detail)
  return `Upload failed (HTTP ${status})`
}

/**
 * Multi-slot product image editor (add / remove / reorder, max 3).
 * Slot shapes:
 *   { key, kind: 'existing'|'staging'|'local', id?, stagingId?, url, file? }
 */
export default function CatalogProductImagesEditor({
  initialGallery = [],
  initialImageUrl = null,
  getToken,
  onSlotsChange,
}) {
  const inputId = useId()
  const fileRef = useRef(null)
  const [slots, setSlots] = useState(() => {
    const fromGallery = Array.isArray(initialGallery) ? initialGallery : []
    if (fromGallery.length) {
      return fromGallery.slice(0, CATALOG_GALLERY_MAX).map((g, i) => ({
        key: `existing-${g.id ?? i}`,
        kind: 'existing',
        id: g.id ?? null,
        url: g.url || g.image_url || '',
      })).filter((s) => s.url)
    }
    if (initialImageUrl) {
      return [{ key: 'cover-0', kind: 'existing', id: null, url: initialImageUrl }]
    }
    return []
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onSlotsChange?.(slots)
  }, [slots, onSlotsChange])

  const clearStaging = async (sid) => {
    if (!sid) return
    try {
      await fetch(`${API_AUTH_BASE}/vendor/catalog/staging-image/${sid}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
    } catch { /* best-effort */ }
  }

  const removeSlot = async (index) => {
    const slot = slots[index]
    if (!slot) return
    if (slot.kind === 'staging' && slot.stagingId) {
      await clearStaging(slot.stagingId)
    }
    if (slot.kind === 'local' && slot.url?.startsWith('blob:')) {
      try { URL.revokeObjectURL(slot.url) } catch { /* noop */ }
    }
    setSlots((prev) => prev.filter((_, i) => i !== index))
    setError('')
  }

  const moveSlot = (index, dir) => {
    setSlots((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (slots.length >= CATALOG_GALLERY_MAX) {
      setError(`Maximum ${CATALOG_GALLERY_MAX} images.`)
      return
    }
    const v = await validateCatalogImageFile(file)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError('')
    const blobUrl = URL.createObjectURL(file)
    const key = `local-${Date.now()}`
    setSlots((prev) => [...prev, { key, kind: 'local', url: blobUrl, file }])
  }

  const uploadPending = async () => {
    const pending = slots.filter((s) => s.kind === 'local' && s.file)
    if (!pending.length) return true
    const token = getToken?.()
    if (!token) {
      setError('Not signed in — refresh and try again.')
      return false
    }
    setUploading(true)
    setError('')
    try {
      let next = [...slots]
      for (const slot of pending) {
        const fd = new FormData()
        fd.append('image', slot.file, slot.file.name || 'upload.jpg')
        const r = await fetch(`${API_AUTH_BASE}/vendor/catalog/staging-image/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const raw = await r.text()
        let data = {}
        try { data = raw ? JSON.parse(raw) : {} } catch { data = { detail: raw || `HTTP ${r.status}` } }
        if (!r.ok) throw new Error(formatUploadErrorResponse(data, r.status))
        if (slot.url?.startsWith('blob:')) {
          try { URL.revokeObjectURL(slot.url) } catch { /* noop */ }
        }
        next = next.map((s) => (
          s.key === slot.key
            ? {
                key: `staging-${data.staging_id}`,
                kind: 'staging',
                stagingId: data.staging_id,
                url: data.image_url,
              }
            : s
        ))
        setSlots(next)
      }
      return true
    } catch (err) {
      setError(err?.message || 'Upload failed')
      return false
    } finally {
      setUploading(false)
    }
  }

  const canAdd = slots.length < CATALOG_GALLERY_MAX
  const hasLocalPending = slots.some((s) => s.kind === 'local')

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10px] tracking-widest uppercase text-[var(--text-dim)] font-semibold">
          Product images ({slots.length}/{CATALOG_GALLERY_MAX})
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-widest uppercase font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}
          >
            <Plus size={12} /> Add image
          </button>
        )}
      </div>

      {slots.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-28 rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--text-faint)] hover:text-[var(--text-soft)] transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--silver-20)' }}
        >
          <Upload size={20} />
          <span className="text-[10px] tracking-widest uppercase">Add up to {CATALOG_GALLERY_MAX} images</span>
        </button>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((slot, index) => (
            <li
              key={slot.key}
              className="flex items-center gap-3 rounded-xl p-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <GripVertical size={14} className="text-[var(--text-faint)] flex-shrink-0" aria-hidden />
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/40">
                <img
                  src={resolvePreviewUrl(slot.url)}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[var(--text-soft)] font-semibold">
                  {index === 0 ? 'Primary (loop start)' : `Image ${index + 1}`}
                </div>
                <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
                  {slot.kind === 'local' ? 'Pending upload' : slot.kind === 'staging' ? 'On server' : 'Saved'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move earlier in loop"
                  disabled={index === 0}
                  onClick={() => moveSlot(index, -1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#aaa' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Move later in loop"
                  disabled={index === slots.length - 1}
                  onClick={() => moveSlot(index, 1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#aaa' }}
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => removeSlot(index)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400"
                  style={{ background: 'rgba(239,68,68,0.08)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasLocalPending && (
        <button
          type="button"
          onClick={uploadPending}
          disabled={uploading}
          className="mt-3 w-full py-2.5 rounded-xl text-xs tracking-widest uppercase font-bold disabled:opacity-50"
          style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)' }}
        >
          {uploading ? 'Uploading…' : 'Upload new images to server & verify'}
        </button>
      )}

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-[var(--text-faint)] leading-relaxed">
        Up to {CATALOG_GALLERY_MAX} images. Reorder to set the marketplace loop order. Max 5MB each — JPG/PNG/WebP.
      </p>

      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPickFile}
      />
    </div>
  )
}

/** Build API gallery payload from editor slots. */
export function buildGallerySavePayload(slots) {
  if (slots.some((s) => s.kind === 'local')) {
    return { ok: false, error: 'Upload pending images to the server before saving, or remove them.' }
  }
  const hasLegacyCover = slots.some((s) => s.kind === 'existing' && !(Number(s.id) > 0))
  const hasStaging = slots.some((s) => s.kind === 'staging')
  const hasExistingIds = slots.some((s) => s.kind === 'existing' && Number(s.id) > 0)

  // Legacy single cover with no gallery row ids yet — leave server gallery unchanged
  // unless the vendor also added staging images or cleared everything.
  if (hasLegacyCover && !hasStaging && slots.length > 0 && !hasExistingIds) {
    return { ok: true, omitGallery: true, gallery: null }
  }

  const gallery = []
  for (const s of slots) {
    if (s.kind === 'staging' && Number(s.stagingId) > 0) {
      gallery.push({ type: 'staging', staging_id: s.stagingId })
    } else if (s.kind === 'existing' && Number(s.id) > 0) {
      gallery.push({ type: 'existing', id: s.id })
    }
  }
  return { ok: true, omitGallery: false, gallery }
}

export function slotsHaveLocalPending(slots) {
  return slots.some((s) => s.kind === 'local')
}
