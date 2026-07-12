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

export type Stage2Status = 'playing' | 'won' | 'lost'

/** One-shot events the host turns into sound. */
export type Stage2Event =
  | 'punch'
  | 'hitEnemy'
  | 'hurt'
  | 'pickup'
  | 'krakenHit'
  | 'krakenDefeat'

type Phase = 'descend' | 'boss' | 'retreat'

export type Stage2Hud = {
  oxygen: number // 0..1
  progress: number // 0..1 toward Atlantis
  status: Stage2Status
  time: number
  punches: number
  boss: boolean
  bossHealth: number // 0..1 (1 = full)
}

type EnemyKind = 'shark' | 'mermaid'

type Enemy = {
  kind: EnemyKind
  x: number
  y: number
  r: number
  draw: number
  cx: number
  cy: number
  vx: number
  vy: number
  phase: number
  wobble: number
  chase: number // how strongly it drifts toward Emi's depth
  knocked: boolean
  spin: number
  spinSpeed: number
  scored: boolean
}

/** Air-bubble pickup that restores oxygen. */
type Air = {
  x: number
  y: number
  r: number
  vy: number
  phase: number
  taken: boolean
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

/** Decorative rising bubble (background ambiance only). */
type Ambient = { x: number; y: number; r: number; speed: number; phase: number }

type Tentacle = {
  baseY: number
  phaseY: number
  phaseR: number
  speedY: number
  speedR: number
  sweep: number // vertical sweep amplitude
  // Current computed tip position (updated each frame).
  tipX: number
  tipY: number
  recoil: number // >0 while retracted after a punch (no damage)
}

const ENEMY_TABLE: Record<EnemyKind, { draw: number; img: ImageKey }> = {
  shark: { draw: 168, img: 'shark' },
  mermaid: { draw: 150, img: 'mermaid' },
}
const DEFAULT_CONTENT = { cx: 0.5, cy: 0.5, hw: 0.4, hh: 0.32 }

// ---- Tuning (base = "Adventurer") ----
const OXYGEN_MAX = 100
const BUBBLE_GAIN = 16
const PUNCH_COST = 4
const HIT_COST = 16
const PUNCH_ACTIVE = 0.2 // seconds the punch hitbox is live
const PUNCH_CD = 0.34 // seconds between punches
const PUNCH_REACH = 78 // px in front of Emi
const PUNCH_RADIUS = 66
const INVULN_TIME = 1.4
const TARGET_DISTANCE = 7000
const BOSS_TRIGGER = 0.8 // progress at which the Kraken appears
const RETREAT_TIME = 2.6 // seconds for the Kraken to withdraw + gate to arrive

// Emi's movement bounds (she stays in the left portion of the lane).
const EMI_X_MIN = 110
const EMI_X_MAX = 320
const EMI_Y_MIN = 110
const EMI_Y_MAX = H - 150
const EMI_DRAW = 150

const KRAKEN_DRAW = 360
const TIP_RADIUS = 44

export class DiveStage {
  // Player
  private px = EMI_X_MIN + 60
  private py = H / 2
  private tilt = 0
  private invuln = 0
  private punchTime = 0
  private punchCd = 0

  // World
  private phase: Phase = 'descend'
  private elapsed = 0
  private distance = 0
  private scroll = 0
  private coralScroll = 0
  private oxygen = OXYGEN_MAX
  private spawnTimer = 0
  private airTimer = 0
  private dodged = 0
  private punches = 0
  private knockedCount = 0

  private enemies: Enemy[] = []
  private airs: Air[] = []
  private particles: Particle[] = []
  private ambient: Ambient[] = []

  // Boss
  private tentacles: Tentacle[] = []
  private bossMaxHealth = 5
  private bossHealth = 5
  private krakenX = W + KRAKEN_DRAW // slides in from the right
  private krakenY = H * 0.4
  private retreatT = 0
  private gateX = W + 260 // Atlantis gate slides in during retreat

  // FX
  private shake = 0
  private flash = 0
  private flashColor = '#ffffff'

  private events: Stage2Event[] = []
  private cfg: DifficultyConfig = DIFFICULTIES[DEFAULT_DIFFICULTY]

  status: Stage2Status = 'playing'

  constructor(cfg?: DifficultyConfig) {
    if (cfg) this.cfg = cfg
  }

  setConfig(cfg: DifficultyConfig) {
    this.cfg = cfg
  }

  // ---- Difficulty-scaled tuning ----
  private get scrollSpeed() {
    return 240 * this.cfg.speedMul
  }
  private get oxyDrain() {
    // Faster difficulty = faster metabolism (harder), gentler difficulty = slower.
    return 2.4 * this.cfg.speedMul
  }
  private get spawnInterval() {
    const base = 1.5 / this.cfg.spawnMul
    return Math.max(0.7, base - this.elapsed * 0.01)
  }
  private get hitR() {
    return 0.72 * this.cfg.hitScale
  }
  private get tentacleCount() {
    return clamp(3 + this.cfg.densityBonus, 2, 4)
  }

  reset() {
    this.px = EMI_X_MIN + 60
    this.py = H / 2
    this.tilt = 0
    this.invuln = 0
    this.punchTime = 0
    this.punchCd = 0

    this.phase = 'descend'
    this.elapsed = 0
    this.distance = 0
    this.scroll = 0
    this.coralScroll = 0
    this.oxygen = OXYGEN_MAX
    this.spawnTimer = 0
    this.airTimer = 1.2
    this.dodged = 0
    this.punches = 0
    this.knockedCount = 0

    this.enemies = []
    this.airs = []
    this.particles = []
    this.ambient = []
    for (let i = 0; i < 26; i++) {
      this.ambient.push({
        x: randRange(0, W),
        y: randRange(0, H),
        r: randRange(3, 11),
        speed: randRange(24, 70),
        phase: randRange(0, Math.PI * 2),
      })
    }

    this.tentacles = []
    this.bossMaxHealth = 5 + this.cfg.densityBonus
    this.bossHealth = this.bossMaxHealth
    this.krakenX = W + KRAKEN_DRAW
    this.krakenY = H * 0.4
    this.retreatT = 0
    this.gateX = W + 260

    this.shake = 0
    this.flash = 0
    this.events = []
    this.status = 'playing'
  }

  drainEvents(): Stage2Event[] {
    if (this.events.length === 0) return []
    const out = this.events
    this.events = []
    return out
  }

  private get score() {
    return (
      Math.floor(this.distance / 8) +
      this.knockedCount * 25 +
      this.dodged * 10 +
      Math.round(this.oxygen) * 2 +
      (this.status === 'won' ? 500 : 0)
    )
  }

  getHud(): Stage2Hud {
    return {
      oxygen: clamp(this.oxygen / OXYGEN_MAX, 0, 1),
      progress: clamp(this.distance / TARGET_DISTANCE, 0, 1),
      status: this.status,
      time: this.elapsed,
      punches: this.punches,
      boss: this.phase === 'boss',
      bossHealth: this.bossMaxHealth ? this.bossHealth / this.bossMaxHealth : 0,
    }
  }

  /** Score getter for the host when reporting the result. */
  getScore() {
    return this.score
  }

  update(dt: number, input: InputSnapshot) {
    if (this.status !== 'playing') return

    this.elapsed += dt
    this.updateFx(dt)
    this.updateAmbient(dt)

    // Timers.
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt)
    if (this.punchTime > 0) this.punchTime = Math.max(0, this.punchTime - dt)
    if (this.punchCd > 0) this.punchCd = Math.max(0, this.punchCd - dt)

    // Parallax scroll (keeps moving in every phase for a lively scene).
    this.scroll = (this.scroll + this.scrollSpeed * 0.5 * dt) % W
    this.coralScroll = (this.coralScroll + this.scrollSpeed * dt) % W

    if (this.phase === 'retreat') {
      this.updateRetreat(dt, input)
      return
    }

    // ---- Movement (descend + boss) ----
    this.moveEmi(dt, input)

    // ---- Punch ----
    if (input.actionJustPressed) this.tryPunch()

    // ---- Oxygen ----
    this.oxygen -= this.oxyDrain * dt
    if (this.oxygen <= 0) {
      this.oxygen = 0
      this.lose()
      return
    }

    // ---- Air bubbles ----
    this.updateAir(dt)

    if (this.phase === 'descend') {
      this.updateDescend(dt)
    } else {
      this.updateBoss(dt)
    }

    // ---- Enemies ----
    this.updateEnemies(dt)
  }

  // ---------------------------------------------------------------------------

  private moveEmi(dt: number, input: InputSnapshot) {
    const prevY = this.py
    if (input.pointerActive) {
      this.px = lerp(this.px, input.pointerX, clamp(dt * 12, 0, 1))
      this.py = lerp(this.py, input.pointerY, clamp(dt * 12, 0, 1))
    } else {
      if (input.axisX !== 0) this.px += input.axisX * 560 * dt
      if (input.axisY !== 0) this.py += input.axisY * 620 * dt
    }
    this.px = clamp(this.px, EMI_X_MIN, EMI_X_MAX)
    this.py = clamp(this.py, EMI_Y_MIN, EMI_Y_MAX)
    // Gentle tilt from vertical motion.
    this.tilt = clamp((this.py - prevY) * 0.02, -0.35, 0.35)
  }

  private tryPunch() {
    if (this.punchCd > 0) return
    this.punchTime = PUNCH_ACTIVE
    this.punchCd = PUNCH_CD
    this.punches += 1
    this.oxygen = Math.max(0, this.oxygen - PUNCH_COST)
    this.events.push('punch')

    const hx = this.px + PUNCH_REACH
    const hy = this.py

    // Knock back any enemy caught in the punch.
    for (const e of this.enemies) {
      if (e.knocked) continue
      if (circlesOverlap(hx, hy, PUNCH_RADIUS, e.x, e.y, e.r)) {
        e.knocked = true
        e.vx = randRange(360, 520)
        e.vy = randRange(-160, 160)
        e.spinSpeed = randRange(-8, 8)
        this.knockedCount += 1
        this.events.push('hitEnemy')
        this.spawnBurst(e.x, e.y, '#e8f6ff', 12)
      }
    }

    // Punch the Kraken's tentacle tips during the boss fight.
    if (this.phase === 'boss') {
      for (const t of this.tentacles) {
        if (t.recoil > 0) continue
        if (circlesOverlap(hx, hy, PUNCH_RADIUS, t.tipX, t.tipY, TIP_RADIUS)) {
          t.recoil = 1.2
          this.bossHealth = Math.max(0, this.bossHealth - 1)
          this.shake = Math.max(this.shake, 14)
          this.spawnBurst(t.tipX, t.tipY, '#c9a2ff', 16)
          this.events.push('krakenHit')
          if (this.bossHealth <= 0) this.startRetreat()
          break
        }
      }
    }
  }

  private hurt() {
    if (this.invuln > 0) return
    this.oxygen = Math.max(0, this.oxygen - HIT_COST * this.cfg.hitScale)
    this.invuln = INVULN_TIME
    this.shake = Math.max(this.shake, 18)
    this.flash = 0.5
    this.flashColor = '#ff5a5a'
    this.events.push('hurt')
    this.spawnBurst(this.px, this.py, '#ff8f8f', 14)
    if (this.oxygen <= 0) {
      this.oxygen = 0
      this.lose()
    }
  }

  private updateDescend(dt: number) {
    this.distance += this.scrollSpeed * dt

    // Spawn enemies from the right.
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0
      this.spawnEnemy()
    }

    // Enter the boss fight once we near Atlantis.
    if (this.distance >= TARGET_DISTANCE * BOSS_TRIGGER) {
      this.distance = TARGET_DISTANCE * BOSS_TRIGGER
      this.startBoss()
    }
  }

  private startBoss() {
    this.phase = 'boss'
    this.krakenX = W + KRAKEN_DRAW * 0.5
    this.krakenY = H * 0.4
    this.tentacles = []
    const n = this.tentacleCount
    for (let i = 0; i < n; i++) {
      this.tentacles.push({
        baseY: lerp(H * 0.2, H * 0.8, n === 1 ? 0.5 : i / (n - 1)),
        phaseY: randRange(0, Math.PI * 2),
        phaseR: randRange(0, Math.PI * 2),
        speedY: randRange(1.1, 1.7),
        speedR: randRange(0.9, 1.4),
        sweep: randRange(150, 230),
        tipX: W,
        tipY: H / 2,
        recoil: 0,
      })
    }
  }

  private updateBoss(dt: number) {
    // Slide the Kraken to its anchored position on the right.
    const anchorX = W - 40
    this.krakenX = lerp(this.krakenX, anchorX, clamp(dt * 2.5, 0, 1))

    // Occasionally spawn a stray enemy to keep the pressure on.
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval * 1.8) {
      this.spawnTimer = 0
      this.spawnEnemy()
    }

    // Animate tentacles + check tip collisions.
    for (const t of this.tentacles) {
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt)
      t.phaseY += t.speedY * dt
      t.phaseR += t.speedR * dt
      const reachExtended = 250 // how far left the tip can reach
      const reachRetracted = 560
      // Reach oscillates in/out; recoil forces full retract.
      const reachN = 0.5 + 0.5 * Math.sin(t.phaseR)
      let tipX = lerp(reachExtended, reachRetracted, reachN)
      if (t.recoil > 0) tipX = 640
      const tipY = clamp(
        t.baseY + Math.sin(t.phaseY) * t.sweep,
        70,
        H - 70,
      )
      t.tipX = tipX
      t.tipY = tipY

      // Tip damages Emi unless recoiling.
      if (
        t.recoil <= 0 &&
        this.invuln <= 0 &&
        circlesOverlap(this.px, this.py, this.emiR * this.hitR, tipX, tipY, TIP_RADIUS)
      ) {
        this.hurt()
      }
    }
  }

  private startRetreat() {
    this.phase = 'retreat'
    this.retreatT = 0
    this.enemies = []
    this.flash = 0.4
    this.flashColor = '#bff3ff'
    this.events.push('krakenDefeat')
  }

  private updateRetreat(dt: number, input: InputSnapshot) {
    this.retreatT += dt
    const t = clamp(this.retreatT / RETREAT_TIME, 0, 1)

    // Kraken withdraws off the right edge; tentacles whip back.
    this.krakenX = lerp(W - 40, W + KRAKEN_DRAW, easeInCubic(t))
    for (const tn of this.tentacles) tn.recoil = 1

    // Atlantis gate glides in to greet Emi.
    this.gateX = lerp(W + 260, W * 0.62, easeOutCubic(t))

    // Progress fills to 100% as the gate arrives.
    this.distance = lerp(TARGET_DISTANCE * BOSS_TRIGGER, TARGET_DISTANCE, t)

    // Let Emi keep drifting toward the gate for a triumphant beat.
    if (input.pointerActive) {
      this.py = lerp(this.py, input.pointerY, clamp(dt * 6, 0, 1))
    }
    this.px = lerp(this.px, EMI_X_MAX, clamp(dt * 1.5, 0, 1))
    this.py = lerp(this.py, H / 2, clamp(dt * 1.5, 0, 1))

    // Celebratory bubbles.
    if (Math.random() < 0.7) {
      this.particles.push({
        x: this.px + randRange(-40, 60),
        y: this.py + randRange(-30, 40),
        vx: randRange(20, 120),
        vy: randRange(-80, -20),
        life: 0,
        maxLife: randRange(0.6, 1.2),
        size: randRange(4, 10),
        color: Math.random() < 0.5 ? '#bff3ff' : '#ffe9a8',
        gravity: -40,
      })
    }

    if (t >= 1) this.status = 'won'
  }

  // ---------------------------------------------------------------------------

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.knocked) {
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.spin += e.spinSpeed * dt
        continue
      }
      e.phase += dt
      // Base leftward drift plus its own speed and a little vertical wobble.
      e.x -= (this.scrollSpeed + e.vx) * dt
      e.y += Math.sin(e.phase * 2) * e.wobble * dt
      // Sharks nudge toward Emi's depth.
      if (e.chase > 0) e.y += Math.sign(this.py - e.y) * e.chase * dt
      e.y = clamp(e.y, 60, H - 60)

      if (!e.scored && e.x < this.px - 40) {
        e.scored = true
        this.dodged += 1
      }
      if (
        this.invuln <= 0 &&
        circlesOverlap(this.px, this.py, this.emiR * this.hitR, e.x, e.y, e.r)
      ) {
        this.hurt()
      }
    }
    // Cull off either side.
    this.enemies = this.enemies.filter((e) => e.x > -180 && e.x < W + 320)
  }

  private spawnEnemy() {
    const kind: EnemyKind = Math.random() < 0.6 ? 'shark' : 'mermaid'
    const meta = ENEMY_TABLE[kind]
    const b = getContentBounds(meta.img) ?? DEFAULT_CONTENT
    const r = ((b.hw + b.hh) / 2) * meta.draw
    this.enemies.push({
      kind,
      x: W + meta.draw,
      y: randRange(120, H - 120),
      r,
      draw: meta.draw,
      cx: b.cx,
      cy: b.cy,
      vx: kind === 'shark' ? randRange(90, 170) : randRange(50, 110),
      vy: 0,
      phase: randRange(0, Math.PI * 2),
      wobble: kind === 'mermaid' ? randRange(60, 130) : randRange(10, 40),
      chase: kind === 'shark' ? randRange(20, 55) : 0,
      knocked: false,
      spin: 0,
      spinSpeed: 0,
      scored: false,
    })
  }

  private updateAir(dt: number) {
    this.airTimer -= dt
    if (this.airTimer <= 0) {
      this.airTimer = randRange(2.6, 4.2)
      this.airs.push({
        x: randRange(W * 0.4, W - 60),
        y: H + 40,
        r: 26,
        vy: randRange(70, 120),
        phase: randRange(0, Math.PI * 2),
        taken: false,
      })
    }
    for (const a of this.airs) {
      a.y -= a.vy * dt
      a.x -= this.scrollSpeed * 0.4 * dt
      a.phase += dt * 3
      a.x += Math.sin(a.phase) * 18 * dt
      if (
        !a.taken &&
        circlesOverlap(this.px, this.py, this.emiR * 0.8, a.x, a.y, a.r)
      ) {
        a.taken = true
        this.oxygen = Math.min(OXYGEN_MAX, this.oxygen + BUBBLE_GAIN)
        this.events.push('pickup')
        this.spawnBurst(a.x, a.y, '#bff3ff', 10)
      }
    }
    this.airs = this.airs.filter((a) => !a.taken && a.y > -60 && a.x > -60)
  }

  private updateAmbient(dt: number) {
    for (const a of this.ambient) {
      a.y -= a.speed * dt
      a.phase += dt * 2
      a.x += Math.sin(a.phase) * 8 * dt
      if (a.y < -20) {
        a.y = H + 20
        a.x = randRange(0, W)
      }
    }
  }

  private updateFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 40)
    this.flash = Math.max(0, this.flash - dt * 1.6)
    for (const p of this.particles) {
      p.life += dt
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife)
  }

  private spawnBurst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = randRange(0, Math.PI * 2)
      const sp = randRange(60, 300)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: randRange(0.4, 0.9),
        size: randRange(4, 11),
        color,
        gravity: -30,
      })
    }
  }

  private lose() {
    this.shake = Math.max(this.shake, 12)
    this.status = 'lost'
  }

  private get emiR() {
    const b = getContentBounds('diverEmi') ?? DEFAULT_CONTENT
    return ((b.hw + b.hh) / 2) * EMI_DRAW
  }

  // ---- Rendering ------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D) {
    const sx = this.shake ? randRange(-this.shake, this.shake) : 0
    const sy = this.shake ? randRange(-this.shake, this.shake) : 0
    ctx.save()
    ctx.translate(sx, sy)

    this.renderBackground(ctx)
    this.renderAmbient(ctx)
    this.renderAir(ctx)
    this.renderEnemies(ctx)

    // Kraken (head + tentacles) sits above enemies but the tentacles read as
    // foreground threats.
    if (this.phase === 'boss' || this.phase === 'retreat') {
      this.renderKraken(ctx)
    }

    // Atlantis gate glides in during the retreat/win beat.
    if (this.phase === 'retreat') this.renderGate(ctx)

    this.renderEmi(ctx)
    this.renderParticles(ctx)

    ctx.restore()

    if (this.flash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.flash
      ctx.fillStyle = this.flashColor
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D) {
    // Base gradient (guaranteed seamless).
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#12566b')
    g.addColorStop(0.5, '#0c3a52')
    g.addColorStop(1, '#041e2e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Scenic backdrop scrolled horizontally (two copies), dimmed to hide seams.
    const bg = getImage('deepSeaBg')
    if (bg) {
      ctx.save()
      ctx.globalAlpha = 0.55
      const x0 = -this.scroll
      ctx.drawImage(bg, x0, 0, W, H)
      ctx.drawImage(bg, x0 + W, 0, W, H)
      ctx.restore()
    }

    // Coral parallax along the bottom (faster scroll = foreground).
    const coral = getImage('coral')
    if (coral) {
      const cw = 300
      const ch = 300
      const y = H - ch + 40
      let x = -this.coralScroll
      // Tile a few copies across with spacing.
      for (let i = -1; i < Math.ceil(W / (cw + 120)) + 1; i++) {
        ctx.drawImage(coral, x + i * (cw + 120), y, cw, ch)
      }
    }
  }

  private renderAmbient(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.fillStyle = '#bfe9ff'
    for (const a of this.ambient) {
      ctx.globalAlpha = 0.18
      ctx.beginPath()
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private renderAir(ctx: CanvasRenderingContext2D) {
    for (const a of this.airs) {
      ctx.save()
      ctx.translate(a.x, a.y)
      // Glow.
      ctx.globalAlpha = 0.85
      ctx.fillStyle = 'rgba(150,230,255,0.35)'
      ctx.beginPath()
      ctx.arc(0, 0, a.r + 6, 0, Math.PI * 2)
      ctx.fill()
      // Bubble body.
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#dff6ff'
      ctx.lineWidth = 3
      ctx.fillStyle = 'rgba(190,243,255,0.35)'
      ctx.beginPath()
      ctx.arc(0, 0, a.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Highlight.
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(-a.r * 0.35, -a.r * 0.35, a.r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      this.drawSprite(
        ctx,
        e.kind,
        e.x,
        e.y,
        e.draw,
        e.cx,
        e.cy,
        e.spin,
        e.knocked ? 0.9 : 1,
      )
    }
  }

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    key: ImageKey,
    x: number,
    y: number,
    draw: number,
    cx: number,
    cy: number,
    spin: number,
    alpha: number,
  ) {
    const img = getImage(key)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    if (spin) ctx.rotate(spin)
    if (img) {
      ctx.drawImage(img, -cx * draw, -cy * draw, draw, draw)
    } else {
      ctx.fillStyle = '#5a7d8c'
      ctx.beginPath()
      ctx.arc(0, 0, draw * 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private renderEmi(ctx: CanvasRenderingContext2D) {
    const blink =
      this.invuln > 0 ? (Math.sin(this.invuln * 30) > 0 ? 0.4 : 1) : 1
    ctx.save()
    ctx.globalAlpha = blink
    ctx.translate(this.px, this.py)
    ctx.rotate(this.tilt)
    const b = getContentBounds('diverEmi') ?? DEFAULT_CONTENT
    const img = getImage('diverEmi')
    if (img) {
      ctx.drawImage(img, -b.cx * EMI_DRAW, -b.cy * EMI_DRAW, EMI_DRAW, EMI_DRAW)
    } else {
      ctx.fillStyle = '#2aa7b8'
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Punch effect: a swirl of knuckle bubbles in front of Emi.
    if (this.punchTime > 0) {
      const k = this.punchTime / PUNCH_ACTIVE
      ctx.save()
      ctx.globalAlpha = 0.5 + 0.4 * k
      ctx.strokeStyle = '#eafaff'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(this.px + PUNCH_REACH, this.py, PUNCH_RADIUS * (1.1 - 0.3 * k), 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  private renderKraken(ctx: CanvasRenderingContext2D) {
    // Tentacles first (behind the head).
    for (const t of this.tentacles) {
      const anchorX = this.krakenX - KRAKEN_DRAW * 0.2
      const anchorY = this.krakenY + 60
      const midX = (anchorX + t.tipX) / 2
      const midY = (anchorY + t.tipY) / 2 - 80
      ctx.save()
      ctx.strokeStyle = t.recoil > 0 ? '#7a5aa8' : '#8f5fd0'
      ctx.lineCap = 'round'
      ctx.lineWidth = 34
      ctx.beginPath()
      ctx.moveTo(anchorX, anchorY)
      ctx.quadraticCurveTo(midX, midY, t.tipX, t.tipY)
      ctx.stroke()
      // Suckers hint (thinner overlay).
      ctx.strokeStyle = 'rgba(230,200,255,0.4)'
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.moveTo(anchorX, anchorY)
      ctx.quadraticCurveTo(midX, midY, t.tipX, t.tipY)
      ctx.stroke()
      // Tip blob (the hittable / damaging part).
      ctx.fillStyle = t.recoil > 0 ? '#b79be0' : '#a06fe0'
      ctx.beginPath()
      ctx.arc(t.tipX, t.tipY, TIP_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#4b2d73'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.restore()
    }

    // Head.
    const img = getImage('krakenHead')
    ctx.save()
    ctx.translate(this.krakenX, this.krakenY)
    if (img) {
      ctx.drawImage(img, -KRAKEN_DRAW / 2, -KRAKEN_DRAW / 2, KRAKEN_DRAW, KRAKEN_DRAW)
    } else {
      ctx.fillStyle = '#7b4fb0'
      ctx.beginPath()
      ctx.arc(0, 0, KRAKEN_DRAW * 0.32, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private renderGate(ctx: CanvasRenderingContext2D) {
    const img = getImage('atlantisGate')
    const size = 460
    ctx.save()
    ctx.translate(this.gateX, H / 2)
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size)
    }
    ctx.restore()
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
}

function easeInCubic(t: number) {
  return t * t * t
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}
