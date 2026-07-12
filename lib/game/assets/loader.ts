import { IMAGES, CHROMA_KEY_ASSETS, type ImageKey } from './manifest'

/** Sprites may be raw <img> or a processed <canvas> after chroma-keying. */
export type Sprite = HTMLImageElement | HTMLCanvasElement
export type ImageCache = Partial<Record<ImageKey, Sprite>>

const cache: ImageCache = {}

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
function chromaKey(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  // Key color: magenta
  const kr = 255
  const kg = 0
  const kb = 255
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
  }
  ctx.putImageData(data, 0, 0)
  return canvas
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
          cache[key] = CHROMA_KEY_ASSETS.has(key) ? chromaKey(img) : img
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
