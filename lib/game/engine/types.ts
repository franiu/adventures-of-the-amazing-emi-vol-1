export type Vec2 = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }

/** Axis-aligned bounding box overlap test. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

/** Circle overlap test using squared distance. */
export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx
  const dy = ay - by
  const rr = ar + br
  return dx * dx + dy * dy <= rr * rr
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
