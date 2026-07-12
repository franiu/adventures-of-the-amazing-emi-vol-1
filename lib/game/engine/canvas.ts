import { clamp } from './types'

/** Virtual portrait resolution — all game math is done in these units. */
export const VIRTUAL_WIDTH = 720
export const VIRTUAL_HEIGHT = 1280

/**
 * When steering with a finger, the character is rendered this many virtual
 * units ABOVE the touch point so the fingertip never hides the player. Only
 * applied to touch input — mouse/pen keep exact 1:1 tracking.
 */
export const TOUCH_POINTER_OFFSET_Y = 130

export type Viewport = {
  /** scale factor from virtual units -> css pixels */
  scale: number
  /** css-pixel offset of the letterboxed play field */
  offsetX: number
  offsetY: number
  cssWidth: number
  cssHeight: number
}

/**
 * Resizes the canvas to fill its container with device-pixel-ratio awareness,
 * then returns the transform needed to map the virtual play field into the
 * available space using "contain" (letterboxed) scaling.
 */
export function fitCanvas(canvas: HTMLCanvasElement): Viewport {
  const parent = canvas.parentElement
  const cssWidth = parent?.clientWidth ?? window.innerWidth
  const cssHeight = parent?.clientHeight ?? window.innerHeight
  const dpr = clamp(window.devicePixelRatio || 1, 1, 3)

  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`

  const scale = Math.min(cssWidth / VIRTUAL_WIDTH, cssHeight / VIRTUAL_HEIGHT)
  const offsetX = (cssWidth - VIRTUAL_WIDTH * scale) / 2
  const offsetY = (cssHeight - VIRTUAL_HEIGHT * scale) / 2

  return { scale, offsetX, offsetY, cssWidth, cssHeight }
}

/**
 * Applies the DPR + letterbox transform to the 2D context so that draw calls
 * can use virtual coordinates (0..VIRTUAL_WIDTH, 0..VIRTUAL_HEIGHT).
 */
export function applyViewport(
  ctx: CanvasRenderingContext2D,
  view: Viewport,
): void {
  const dpr = clamp(window.devicePixelRatio || 1, 1, 3)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.translate(view.offsetX, view.offsetY)
  ctx.scale(view.scale, view.scale)
}

/** Convert a css-pixel pointer position into virtual play-field coordinates. */
export function pointerToVirtual(
  view: Viewport,
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const cx = clientX - rect.left - view.offsetX
  const cy = clientY - rect.top - view.offsetY
  return { x: cx / view.scale, y: cy / view.scale }
}
