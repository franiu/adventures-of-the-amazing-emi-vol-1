import { VIRTUAL_WIDTH as W, VIRTUAL_HEIGHT as H } from '@/lib/game/engine/canvas'
import { clamp, lerp, circlesOverlap, randRange } from '@/lib/game/engine/types'
import type { InputSnapshot } from '@/lib/game/input/input'
import { getImage, getContentBounds } from '@/lib/game/assets/loader'
import type { ImageKey } from '@/lib/game/assets/manifest'
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  type DifficultyConfig,
} from '@/lib/game/difficulty'

type ObstacleKind = 'rock' | 'buoy' | 'barrel'

type Obstacle = {
  x: number
  y: number
  r: number // collision radius, fitted to the visible art
  draw: number // on-screen square draw size
  cx: number // content-center X as a fraction of the sprite (for recentering)
  cy: number // content-center Y as a fraction of the sprite
  kind: ObstacleKind
  img: ImageKey
  spin: number
  spinSpeed: number
  scored: boolean
}

// `draw` = on-screen square size of the sprite frame; the actual collision
// radius is derived per-obstacle from the sprite's measured opaque bounds.
const KIND_TABLE: Record<ObstacleKind, { draw: number; img: ImageKey }> = {
  rock: { draw: 175, img: 'obstacleRock' },
  buoy: { draw: 130, img: 'obstacleBuoy' },
  barrel: { draw: 140, img: 'obstacleBarrel' },
}

// Fallback opaque-bounds fraction if a sprite failed to load/measure.
const DEFAULT_CONTENT = { cx: 0.5, cy: 0.5, hw: 0.42, hh: 0.42 }

export type Stage1Hud = {
  score: number
  progress: number // 0..1 to the diving site
  status: Stage1Status
  time: number
}

export type Stage1Status = 'playing' | 'won' | 'lost'

const TARGET_DISTANCE = 26000
// The boat sprite is a square frame: the hull sits in the upper portion with a
// churning wake baked into the lower portion. We anchor drawing on the hull
// center and keep the collision circle tight over the hull only (not the wake).
const BOAT_DRAW = 172
const BOAT_HULL_CY = 0.4 // hull center as a fraction down the sprite frame
const BOAT_RADIUS = 34
const MARGIN = 70

export class BoatStage {
  private boatX = W / 2
  private readonly boatY = H - 250
  private tilt = 0

  private obstacles: Obstacle[] = []
  private elapsed = 0
  private distance = 0
  private dodged = 0
  private speed = 430
  private spawnTimer = 0
  private spawnInterval = 0.95
  private bgOffset = 0

  private cfg: DifficultyConfig = DIFFICULTIES[DEFAULT_DIFFICULTY]

  status: Stage1Status = 'playing'

  constructor(cfg?: DifficultyConfig) {
    if (cfg) this.cfg = cfg
  }

  /** Select the difficulty applied on the next reset(). */
  setConfig(cfg: DifficultyConfig) {
    this.cfg = cfg
  }

  // ---- Difficulty-scaled tuning (base values = "Adventurer") ----
  private get baseSpeed() {
    return 430 * this.cfg.speedMul
  }
  private get maxSpeed() {
    return 1150 * this.cfg.speedMul
  }
  private get speedRamp() {
    return 20 * this.cfg.speedMul
  }
  private get startInterval() {
    return 0.95 / this.cfg.spawnMul
  }
  private get minInterval() {
    return 0.34 / this.cfg.spawnMul
  }
  private get intervalDecay() {
    return 0.014 * this.cfg.spawnMul
  }
  private get maxDensity() {
    return Math.max(1, 3 + this.cfg.densityBonus)
  }
  private get hitFactor() {
    return 0.82 * this.cfg.hitScale
  }

  reset() {
    this.boatX = W / 2
    this.tilt = 0
    this.obstacles = []
    this.elapsed = 0
    this.distance = 0
    this.dodged = 0
    this.speed = this.baseSpeed
    this.spawnTimer = 0
    this.spawnInterval = this.startInterval
    this.bgOffset = 0
    this.status = 'playing'
  }

  private get score() {
    return Math.floor(this.distance / 10) + this.dodged * 25
  }

  getHud(): Stage1Hud {
    return {
      score: this.score,
      progress: clamp(this.distance / TARGET_DISTANCE, 0, 1),
      status: this.status,
      time: this.elapsed,
    }
  }

  update(dt: number, input: InputSnapshot) {
    if (this.status !== 'playing') return

    this.elapsed += dt

    // Difficulty ramp: faster water, denser spawns.
    this.speed = Math.min(this.maxSpeed, this.baseSpeed + this.elapsed * this.speedRamp)
    this.spawnInterval = Math.max(
      this.minInterval,
      this.startInterval - this.elapsed * this.intervalDecay,
    )
    this.distance += this.speed * dt
    this.bgOffset = (this.bgOffset + this.speed * dt) % H

    // Steering: pointer drag takes priority, else keyboard axis.
    const prevX = this.boatX
    if (input.pointerActive) {
      this.boatX = lerp(this.boatX, input.pointerX, clamp(dt * 14, 0, 1))
    } else if (input.axisX !== 0) {
      this.boatX += input.axisX * 780 * dt
    }
    this.boatX = clamp(this.boatX, MARGIN, W - MARGIN)
    this.tilt = clamp((this.boatX - prevX) * 0.06, -0.4, 0.4)

    // Spawning
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnWave()
    }

    // Move obstacles, cull, score dodges, detect collision
    const boatHitY = this.boatY
    for (const o of this.obstacles) {
      o.y += this.speed * dt
      o.spin += o.spinSpeed * dt
      if (!o.scored && o.y > this.boatY + 40) {
        o.scored = true
        this.dodged += 1
      }
      if (
        circlesOverlap(this.boatX, boatHitY, BOAT_RADIUS, o.x, o.y, o.r * this.hitFactor)
      ) {
        this.status = 'lost'
        return
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y < H + 120)

    if (this.distance >= TARGET_DISTANCE) {
      this.status = 'won'
    }
  }

  private spawnWave() {
    // Number of obstacles per wave grows with time, capped by difficulty.
    const density = clamp(1 + Math.floor(this.elapsed / 14), 1, this.maxDensity)
    const usedX: number[] = []
    for (let i = 0; i < density; i++) {
      const kind = this.randomKind()
      const meta = KIND_TABLE[kind]
      const b = getContentBounds(meta.img) ?? DEFAULT_CONTENT
      // Fit the collision circle to the visible art: average the opaque box's
      // half-extents (as a fraction of the frame) times the on-screen size.
      const r = ((b.hw + b.hh) / 2) * meta.draw
      let x = 0
      let tries = 0
      do {
        x = randRange(MARGIN, W - MARGIN)
        tries++
      } while (tries < 8 && usedX.some((ux) => Math.abs(ux - x) < 150))
      usedX.push(x)
      this.obstacles.push({
        x,
        y: -meta.draw - randRange(0, 160),
        r,
        draw: meta.draw,
        cx: b.cx,
        cy: b.cy,
        kind,
        img: meta.img,
        spin: randRange(0, Math.PI * 2),
        spinSpeed: randRange(-0.6, 0.6),
        scored: false,
      })
    }
  }

  private randomKind(): ObstacleKind {
    const roll = Math.random()
    if (roll < 0.45) return 'rock'
    if (roll < 0.75) return 'buoy'
    return 'barrel'
  }

  render(ctx: CanvasRenderingContext2D) {
    // Water background (two vertically-tiled copies scrolling down)
    const bg = getImage('seaBg')
    if (bg) {
      const y0 = this.bgOffset
      ctx.drawImage(bg, 0, y0 - H, W, H)
      ctx.drawImage(bg, 0, y0, W, H)
    } else {
      ctx.fillStyle = '#1b6fa8'
      ctx.fillRect(0, 0, W, H)
    }

    // Obstacles
    for (const o of this.obstacles) {
      const img = getImage(o.img)
      ctx.save()
      ctx.translate(o.x, o.y)
      ctx.rotate(o.spin)
      if (img) {
        // Recenter so the sprite's opaque content (not the padded frame) pivots
        // and sits on the obstacle position.
        ctx.drawImage(img, -o.cx * o.draw, -o.cy * o.draw, o.draw, o.draw)
      } else {
        ctx.fillStyle = '#6b7280'
        ctx.beginPath()
        ctx.arc(0, 0, o.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Boat + wake
    this.renderBoat(ctx)
  }

  private renderBoat(ctx: CanvasRenderingContext2D) {
    const img = getImage('boatEmi')
    ctx.save()
    // Pivot on the hull center so tilt rotates the boat, not the wake tip.
    ctx.translate(this.boatX, this.boatY)
    ctx.rotate(this.tilt)
    if (img) {
      // The wake is baked into the lower part of the sprite; anchor on the hull.
      ctx.drawImage(
        img,
        -BOAT_DRAW / 2,
        -BOAT_HULL_CY * BOAT_DRAW,
        BOAT_DRAW,
        BOAT_DRAW,
      )
    } else {
      // Fallback: a simple bow-up triangle.
      ctx.fillStyle = '#e2513a'
      ctx.beginPath()
      ctx.moveTo(0, -70)
      ctx.lineTo(46, 60)
      ctx.lineTo(-46, 60)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}
