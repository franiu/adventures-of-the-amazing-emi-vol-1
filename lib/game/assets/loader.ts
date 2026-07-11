import { IMAGES, type ImageKey } from './manifest'

export type ImageCache = Partial<Record<ImageKey, HTMLImageElement>>

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
 * Preloads the given image keys, reporting progress (0..1). Already-cached
 * images resolve instantly. Failed images are skipped so a single missing asset
 * never blocks the game from starting.
 */
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
          cache[key] = await loadImage(IMAGES[key])
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

export function getImage(key: ImageKey): HTMLImageElement | undefined {
  return cache[key]
}
