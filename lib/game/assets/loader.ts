import { IMAGES, CHROMA_KEY_ASSETS, type ImageKey } from './manifest'

/** Sprites may be raw <img> or a processed <canvas> after chroma-keying. */
export type Sprite = HTMLImageElement | HTMLCanvasElement
export type ImageCache = Partial<Record<ImageKey, Sprite>>

/**
 * Normalized (0..1) opaque-pixel bounds of a keyed sprite, so gameplay can size
 * collisions and center drawing to the *visible* art, not the padded frame.
 * cx/cy = center of the opaque box; hw/hh = half width/height as a fraction of
 * the full image dimensions.
 */
export type ContentBounds = { cx: number; cy: number; hw: number; hh: number }

const cache: ImageCache = {}
const boundsCache: Partial<Record<ImageKey, ContentBounds>> = {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${src}`))
    img.src = src
  })
}

/**
 * Removes a flat magenta (#FF00FF) background by turning matching pixels
 * transparent. Uses a distance threshold so anti-aliased edges fade out, and
 * de-fringes partially-keyed edge pixels to avoid a pink halo.
 */
function chromaKey(img: HTMLImageElement): {
  canvas: HTMLCanvasElement
  bounds: ContentBounds
} {
  const canvas = document.createElement('canvas')
  const w = img.naturalWidth
  const h = img.naturalHeight
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  // Key color: magenta
  const kr = 255
  const kg = 0
  const kb = 255
  // Track the opaque bounding box while we key.
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    // Magenta = high red, low green, high blue.
    const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2)
    if (dist < 90) {
      px[i + 3] = 0
    } else if (dist < 170) {
      // Edge band: fade alpha and pull the color away from magenta.
      const t = (dist - 90) / 80
      px[i + 3] = Math.round(px[i + 3] * t)
      px[i + 1] = Math.min(255, g + (1 - t) * 60) // lift green to kill pink fringe
    }
    // Any meaningfully-opaque pixel expands the content box.
    if (px[i + 3] > 40) {
      const p = i / 4
      const x = p % w
      const y = (p / w) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  ctx.putImageData(data, 0, 0)

  const bounds: ContentBounds =
    maxX >= minX && maxY >= minY
      ? {
          cx: (minX + maxX) / 2 / w,
          cy: (minY + maxY) / 2 / h,
          hw: (maxX - minX) / 2 / w,
          hh: (maxY - minY) / 2 / h,
        }
      : { cx: 0.5, cy: 0.5, hw: 0.5, hh: 0.5 }

  return { canvas, bounds }
}

export async function preloadImages(
  keys: ImageKey[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<ImageCache> {
  const total = keys.length
  let loaded = 0
  onProgress?.(0, total)

  await Promise.all(
    keys.map(async (key) => {
      if (!cache[key]) {
        try {
          const img = await loadImage(IMAGES[key])
          if (CHROMA_KEY_ASSETS.has(key)) {
            const { canvas, bounds } = chromaKey(img)
            cache[key] = canvas
            boundsCache[key] = bounds
          } else {
            cache[key] = img
          }
        } catch {
          // Leave undefined; renderer falls back to a shape.
        }
      }
      loaded += 1
      onProgress?.(loaded, total)
    }),
  )

  return cache
}

export function getImage(key: ImageKey): Sprite | undefined {
  return cache[key]
}

/** Opaque-pixel bounds of a keyed sprite (undefined for non-keyed images). */
export function getContentBounds(key: ImageKey): ContentBounds | undefined {
  return boundsCache[key]
}
