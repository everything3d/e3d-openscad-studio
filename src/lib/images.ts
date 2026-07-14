/**
 * Client-side image preprocessing for chat attachments.
 *
 * Attached images travel as data URLs inside the UIMessage history, which is
 * re-sent on every chat turn and persisted to Postgres. Downscaling before
 * send keeps multi-image conversations well under request-size limits
 * (~4.5 MB on Vercel) without a separate upload store.
 */

const MAX_DIMENSION = 1536
const JPEG_QUALITY = 0.85

/** Data-URL length (chars, ≈ bytes × 4/3) below which an image is sent as-is. */
const PASSTHROUGH_LENGTH = 400_000

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })
}

/**
 * Downscale an image data URL to fit MAX_DIMENSION, re-encoding as JPEG.
 * Small images pass through untouched. On any failure (e.g. an SVG the
 * canvas can't rasterize) the original URL is returned unchanged.
 */
export async function downscaleImageDataUrl(
  url: string,
  mediaType: string,
): Promise<{ url: string; mediaType: string }> {
  const original = { url, mediaType }
  if (!mediaType.startsWith('image/') || mediaType === 'image/svg+xml') {
    return original
  }

  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && url.length <= PASSTHROUGH_LENGTH) {
      return original
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return original

    // Transparent PNGs would composite onto black in JPEG; give them white.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    // Re-encoding can inflate small screenshots/diagrams; keep the smaller one.
    if (jpeg.length >= url.length && scale === 1) {
      return original
    }
    return { url: jpeg, mediaType: 'image/jpeg' }
  } catch {
    return original
  }
}
