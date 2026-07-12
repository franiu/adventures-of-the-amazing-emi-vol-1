import { VIRTUAL_WIDTH as W, VIRTUAL_HEIGHT as H } from '@/lib/game/engine/canvas'
import { clamp, lerp, circlesOverlap, randRange } from '@/lib/game/engine/types'
import type { InputSnapshot } from '@/lib/game/input/input'
import { getImage } from '@/lib/game/assets/loader'
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
  r: number
  kind: ObstacleKind
  img: ImageKey
  spin: number
  spinSpeed: number
  scored: boolean
}

const KIND_TABLE: Record<ObstacleKind, { r: number; img: ImageKey }> = {
  rock: { r: 74, img: 'obstacleRock' },
  buoy: { r: 56, img: 'obstacleBuoy' },
  barrel: { r: 60, img: 'obstacleBarrel' },
}

export type Stage1Hud = {
  score: number
  progress: number // 0..1 to the diving site
  status: Stage1Status
  time: number
}

export type Stage1Status = 'playing' | 'won' | 'lost'

const TARGET_DISTANCE = 26000
const BOAT_W = 120
const BOAT_H = 156
const BOAT_RADIUS = 44
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
  private wakePhase = 0

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
    this.wakePhase = 0
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
    this.wakePhase += dt * 12

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
    const boatHitY = this.boatY - 10
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
      let x = 0
      let tries = 0
      do {
        x = randRange(MARGIN, W - MARGIN)
        tries++
      } while (tries < 8 && usedX.some((ux) => Math.abs(ux - x) < 150))
      usedX.push(x)
      this.obstacles.push({
        x,
        y: -meta.r - randRange(0, 160),
        r: meta.r,
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
        const size = o.r * 2.3
        ctx.drawImage(img, -size / 2, -size / 2, size, size)
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
    // Foamy wake
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#e8f6ff'
    const wobble = Math.sin(this.wakePhase) * 8
    ctx.beginPath()
    ctx.moveTo(this.boatX - 26, this.boatY + 40)
    ctx.lineTo(this.boatX - 60 + wobble, this.boatY + 210)
    ctx.lineTo(this.boatX + 60 - wobble, this.boatY + 210)
    ctx.lineTo(this.boatX + 26, this.boatY + 40)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    const img = getImage('boatEmi')
    ctx.save()
    ctx.translate(this.boatX, this.boatY)
    ctx.rotate(this.tilt)
    if (img) {
      ctx.drawImage(img, -BOAT_W / 2, -BOAT_H / 2, BOAT_W, BOAT_H)
    } else {
      ctx.fillStyle = '#e2513a'
      ctx.beginPath()
      ctx.moveTo(0, -BOAT_H / 2)
      ctx.lineTo(BOAT_W / 2, BOAT_H / 2)
      ctx.lineTo(-BOAT_W / 2, BOAT_H / 2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
}
