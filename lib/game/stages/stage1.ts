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

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
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
  lives: number
  maxLives: number
}

export type Stage1Status = 'playing' | 'won' | 'lost'

/** One-shot gameplay events the host can turn into sound/haptics. */
export type Stage1Event = 'dodge' | 'crash' | 'finish' | 'respawn'

/** Internal animation phase; gameplay is frozen while an outro plays. */
type AnimPhase = 'none' | 'crash' | 'finish'

const TARGET_DISTANCE = 26000
// The boat sprite is a square frame: the hull sits in the upper portion with a
// churning wake baked into the lower portion. We anchor drawing on the hull
// center and keep the collision circle tight over the hull only (not the wake).
const BOAT_DRAW = 172
const BOAT_HULL_CY = 0.4 // hull center as a fraction down the sprite frame
const BOAT_RADIUS = 34
const MARGIN = 70

// Outro animation durations (seconds).
const CRASH_DURATION = 1.25
const FINISH_DURATION = 1.5

// Lives & post-respawn grace period.
const START_LIVES = 3
const INVULN_TIME = 2.2

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

  // ---- Outro animation state ----
  private anim: AnimPhase = 'none'
  private animT = 0
  private particles: Particle[] = []
  private shake = 0
  private flash = 0
  // Boat transform overrides driven by the outro animation.
  private boatSpin = 0
  private boatScale = 1
  private boatDX = 0
  private boatDY = 0
  private boatAlpha = 1

  // One-shot events drained by the host each frame (for sound).
  private events: Stage1Event[] = []

  // ---- Lives ----
  private lives = START_LIVES
  private readonly maxLives = START_LIVES
  private invuln = 0 // grace period (seconds) after a respawn

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
    this.anim = 'none'
    this.animT = 0
    this.particles = []
    this.shake = 0
    this.flash = 0
    this.boatSpin = 0
    this.boatScale = 1
    this.boatDX = 0
    this.boatDY = 0
    this.boatAlpha = 1
    this.events = []
    this.lives = this.maxLives
    this.invuln = 0
    this.status = 'playing'
  }

  /** Returns and clears the queued one-shot events since the last call. */
  drainEvents(): Stage1Event[] {
    if (this.events.length === 0) return []
    const out = this.events
    this.events = []
    return out
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
      lives: this.lives,
      maxLives: this.maxLives,
    }
  }

  update(dt: number, input: InputSnapshot) {
    if (this.status !== 'playing') return

    // While an outro animation plays, freeze gameplay and just advance it.
    if (this.anim !== 'none') {
      this.updateAnim(dt)
      return
    }

    this.elapsed += dt
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt)

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
        this.events.push('dodge')
      }
      if (
        this.invuln <= 0 &&
        circlesOverlap(this.boatX, boatHitY, BOAT_RADIUS, o.x, o.y, o.r * this.hitFactor)
      ) {
        this.startCrash()
        return
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.y < H + 120)

    if (this.distance >= TARGET_DISTANCE) {
      this.startFinish()
    }
  }

  // ---- Outro animations -----------------------------------------------------

  private startCrash() {
    this.lives = Math.max(0, this.lives - 1)
    this.anim = 'crash'
    this.animT = 0
    this.shake = 26
    this.flash = 0.85
    this.events.push('crash')
    // Burst of water droplets from the point of impact.
    for (let i = 0; i < 34; i++) {
      const a = randRange(0, Math.PI * 2)
      const sp = randRange(120, 620)
      this.particles.push({
        x: this.boatX,
        y: this.boatY,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 180,
        life: 0,
        maxLife: randRange(0.5, 1.1),
        size: randRange(6, 18),
        color: Math.random() < 0.5 ? '#e8f6ff' : '#8fd3ff',
        gravity: 900,
      })
    }
  }

  private startFinish() {
    this.anim = 'finish'
    this.animT = 0
    this.distance = TARGET_DISTANCE
    this.flash = 0.35
    this.events.push('finish')
  }

  /** Bring Emi back after a non-fatal crash: clear the field and grant grace. */
  private respawn() {
    this.anim = 'none'
    this.animT = 0
    this.obstacles = []
    this.particles = []
    this.spawnTimer = 0
    this.shake = 0
    this.flash = 0
    this.boatX = W / 2
    this.tilt = 0
    this.boatSpin = 0
    this.boatScale = 1
    this.boatDX = 0
    this.boatDY = 0
    this.boatAlpha = 1
    this.invuln = INVULN_TIME
    this.events.push('respawn')
  }

  private updateAnim(dt: number) {
    this.animT += dt
    this.shake = Math.max(0, this.shake - dt * 60)
    this.flash = Math.max(0, this.flash - dt * 1.8)

    // Keep the water scrolling so the scene stays alive.
    this.bgOffset = (this.bgOffset + this.speed * dt) % H

    // Advance existing particles.
    for (const p of this.particles) {
      p.life += dt
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife)

    if (this.anim === 'crash') {
      const t = clamp(this.animT / CRASH_DURATION, 0, 1)
      // Spin out, sink and fade.
      this.boatSpin = this.animT * 9
      this.boatScale = 1 - 0.55 * t
      this.boatDY = easeInCubic(t) * 70
      this.boatDX = Math.sin(this.animT * 14) * 10 * (1 - t)
      this.boatAlpha = 1 - easeInCubic(t)
      // Obstacles keep drifting for a beat.
      for (const o of this.obstacles) {
        o.y += this.speed * 0.4 * dt
        o.spin += o.spinSpeed * dt
      }
      if (this.animT >= CRASH_DURATION) {
        // Out of lives = game over; otherwise respawn and keep going.
        if (this.lives > 0) this.respawn()
        else this.status = 'lost'
      }
    } else if (this.anim === 'finish') {
      const t = clamp(this.animT / FINISH_DURATION, 0, 1)
      // Surge forward: boat rockets up off the top of the screen.
      this.boatDY = -easeInCubic(t) * (H + 260)
      this.boatScale = 1 + 0.12 * Math.sin(t * Math.PI)
      this.boatSpin = 0
      this.boatAlpha = 1
      // Emit celebratory sparkles + a rising bubble trail from the wake.
      if (Math.random() < 0.9) {
        const sparkle = Math.random() < 0.55
        this.particles.push({
          x: this.boatX + randRange(-70, 70),
          y: this.boatY + this.boatDY + randRange(-30, 90),
          vx: randRange(-90, 90),
          vy: randRange(-40, 60),
          life: 0,
          maxLife: randRange(0.5, 1.0),
          size: sparkle ? randRange(5, 12) : randRange(4, 9),
          color: sparkle ? '#ffd76b' : '#e8f6ff',
          gravity: -60,
        })
      }
      if (this.animT >= FINISH_DURATION) {
        this.status = 'won'
      }
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
    // Screen shake offset (crash impact).
    const sx = this.shake ? randRange(-this.shake, this.shake) : 0
    const sy = this.shake ? randRange(-this.shake, this.shake) : 0
    ctx.save()
    ctx.translate(sx, sy)

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

    // Boat (hidden once fully faded out after a crash)
    if (this.boatAlpha > 0.02) this.renderBoat(ctx)

    // Particles (splash droplets / sparkles) drawn above the boat.
    this.renderParticles(ctx)

    ctx.restore()

    // Full-screen impact / finish flash (drawn without shake offset).
    if (this.flash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flash
      ctx.fillStyle = this.anim === 'finish' ? '#ffe9a8' : '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const a = clamp(1 - p.life / p.maxLife, 0, 1)
      ctx.save()
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * a), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  private renderBoat(ctx: CanvasRenderingContext2D) {
    const img = getImage('boatEmi')
    ctx.save()
    ctx.globalAlpha = this.boatAlpha
    // Pivot on the hull center so tilt rotates the boat, not the wake tip.
    ctx.translate(this.boatX + this.boatDX, this.boatY + this.boatDY)
    ctx.rotate(this.tilt + this.boatSpin)
    ctx.scale(this.boatScale, this.boatScale)
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

function easeInCubic(t: number) {
  return t * t * t
}
