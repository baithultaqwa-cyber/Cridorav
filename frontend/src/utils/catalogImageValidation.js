/** Catalog product images: same rules as backend (users.views._validate_catalog_image_upload). */

const MAX_BYTES = 5 * 1024 * 1024

const EXT_OK = ['.jpg', '.jpeg', '.png', '.webp']

const MIME_OK = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/pjpeg',
  'image/x-png',
])

function extensionOk(name) {
  const n = String(name || '').toLowerCase()
  return EXT_OK.some((e) => n.endsWith(e))
}

/**
 * @param {File} file
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function validateCatalogImageFile(file) {
  if (!file) {
    return { ok: false, error: 'No file selected.' }
  }
  if (file.size === 0) {
    return { ok: false, error: 'File is empty.' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Image must be 5MB or smaller.' }
  }
  if (!extensionOk(file.name)) {
    return {
      ok: false,
      error: 'File must be .jpg, .jpeg, .png, or .webp (e.g. export iPhone photos as JPEG first).',
    }
  }
  const t = (file.type || '').toLowerCase()
  if (t && t !== 'application/octet-stream' && !MIME_OK.has(t)) {
    if (t.startsWith('image/') && (t.includes('gif') || t.includes('svg') || t.includes('heic') || t.includes('heif'))) {
      return { ok: false, error: 'Only JPEG, PNG, or WebP are allowed (not GIF, SVG, or HEIC).' }
    }
    if (t && !t.startsWith('image/') && t !== 'application/octet-stream') {
      return { ok: false, error: 'Only image files (JPG, PNG, or WebP) are allowed.' }
    }
  }

  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file)
      try {
        if (typeof bmp.close === 'function') bmp.close()
      } catch {
        /* ignore */
      }
    } else {
      await loadImageFromFile(file)
    }
  } catch {
    return {
      ok: false,
      error:
        'This file is not a valid image or is corrupted. Use a real JPEG, PNG, or WebP (not a renamed file).',
    }
  }

  return { ok: true, error: '' }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
      resolve()
    }
    img.onerror = () => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
      reject(new Error('decode'))
    }
    img.src = url
  })
}
