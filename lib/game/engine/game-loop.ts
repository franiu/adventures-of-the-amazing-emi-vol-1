/**
 * Fixed-timestep game loop with a variable render step.
 *
 * The simulation always advances in fixed `step` increments (default 1/60s) so
 * physics stay deterministic regardless of display refresh rate, while render
 * runs once per animation frame. Pausing freezes the accumulator and the first
 * frame after resume is clamped to avoid a large dt "jump".
 */
export type UpdateFn = (dt: number) => void
export type RenderFn = (alpha: number) => void

export class GameLoop {
  private readonly step: number
  private readonly maxFrame: number
  private update: UpdateFn
  private render: RenderFn

  private rafId = 0
  private lastTime = 0
  private accumulator = 0
  private running = false
  private paused = false

  constructor(update: UpdateFn, render: RenderFn, stepHz = 60) {
    this.update = update
    this.render = render
    this.step = 1 / stepHz
    // Never simulate more than ~0.25s worth of steps in one frame (spiral guard).
    this.maxFrame = 0.25
  }

  start() {
    if (this.running) return
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.accumulator = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  pause() {
    this.paused = true
  }

  resume() {
    if (!this.running || !this.paused) return
    this.paused = false
    // Reset the clock so time spent paused is not applied at once.
    this.lastTime = performance.now()
    this.accumulator = 0
  }

  get isPaused() {
    return this.paused
  }

  private tick = (now: number) => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.tick)

    if (this.paused) {
      this.lastTime = now
      return
    }

    let frameTime = (now - this.lastTime) / 1000
    this.lastTime = now
    if (frameTime > this.maxFrame) frameTime = this.maxFrame

    this.accumulator += frameTime
    while (this.accumulator >= this.step) {
      this.update(this.step)
      this.accumulator -= this.step
    }

    this.render(this.accumulator / this.step)
  }
}
