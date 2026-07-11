/**
 * Unified input snapshot shared by all stages.
 * - `axisX` / `axisY` come from keyboard (arrows / WASD).
 * - Pointer fields are fed by the React stage wrapper (touch + mouse), already
 *   converted into virtual play-field coordinates.
 * - `action` is the primary button (space / tap on action pad).
 */
export type InputSnapshot = {
  axisX: number
  axisY: number
  action: boolean
  actionJustPressed: boolean
  pointerActive: boolean
  pointerX: number
  pointerY: number
}

export class InputManager {
  private keys = new Set<string>()
  private pointerActive = false
  private pointerX = 0
  private pointerY = 0
  private actionDown = false
  private actionEdge = false
  private attached = false

  attach() {
    if (this.attached || typeof window === 'undefined') return
    this.attached = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    if (!this.attached) return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.keys.clear()
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (
      k === 'arrowleft' ||
      k === 'arrowright' ||
      k === 'arrowup' ||
      k === 'arrowdown' ||
      k === ' '
    ) {
      e.preventDefault()
    }
    if ((k === ' ' || k === 'enter') && !this.actionDown) {
      this.actionEdge = true
    }
    if (k === ' ') this.actionDown = true
    this.keys.add(k)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === ' ') this.actionDown = false
    this.keys.delete(k)
  }

  private onBlur = () => {
    this.keys.clear()
    this.actionDown = false
  }

  /** Called by the stage wrapper from pointer/touch handlers. */
  setPointer(active: boolean, x: number, y: number) {
    this.pointerActive = active
    this.pointerX = x
    this.pointerY = y
  }

  /** Called by touch action buttons (e.g. punch / jump). */
  pressAction() {
    if (!this.actionDown) this.actionEdge = true
    this.actionDown = true
  }

  releaseAction() {
    this.actionDown = false
  }

  private keyAxisX(): number {
    let x = 0
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1
    return x
  }

  private keyAxisY(): number {
    let y = 0
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1
    return y
  }

  /** Build a snapshot for this tick and clear one-shot edges. */
  sample(): InputSnapshot {
    const snap: InputSnapshot = {
      axisX: this.keyAxisX(),
      axisY: this.keyAxisY(),
      action: this.actionDown,
      actionJustPressed: this.actionEdge,
      pointerActive: this.pointerActive,
      pointerX: this.pointerX,
      pointerY: this.pointerY,
    }
    this.actionEdge = false
    return snap
  }
}
