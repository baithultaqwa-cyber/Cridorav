import { useState, useEffect } from 'react'
import { catalogImageUrl } from '../utils/mediaUrl'

/**
 * Renders a catalog / marketplace product image with absolute URL resolution
 * and a fallback if the file is missing or fails to load (404, CORS, etc.).
 */
export default function CatalogImage({ url, alt = '', className = '', fallback = null }) {
  const [failed, setFailed] = useState(false)
  const resolved = catalogImageUrl(url)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!resolved || failed) {
    return fallback
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
