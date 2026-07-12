'use client'

/**
 * Tiny synthesized sound engine (Web Audio API) — no audio assets required.
 *
 * Everything is generated with oscillators + gain envelopes, so it is small,
 * offline-friendly, and instant. A single AudioContext is created lazily on the
 * first user gesture to satisfy browser autoplay policies.
 *
 * The manager is a module-level singleton so any component (or the game loop)
 * can trigger sounds without prop-drilling an instance around.
 */

type Bus = 'sfx' | 'music'

class SoundManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private muted = false

  // Music scheduler state.
  private musicTimer: ReturnType<typeof setInterval> | null = null
  private musicStep = 0
  private nextNoteTime = 0

  /** Lazily create the audio graph. Safe to call repeatedly. */
  ensure() {
    if (this.ctx || typeof window === 'undefined') return
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    this.master.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 0.9
    this.sfxGain.connect(this.master)

    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.0
    this.musicGain.connect(this.master)
  }

  /** Resume the context — must be called from within a user gesture. */
  resume() {
    this.ensure()
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02)
    }
  }

  isMuted() {
    return this.muted
  }

  private busNode(bus: Bus) {
    return bus === 'music' ? this.musicGain : this.sfxGain
  }

  /** Play a single enveloped tone. */
  private tone(
    freq: number,
    when: number,
    dur: number,
    opts: {
      type?: OscillatorType
      gain?: number
      bus?: Bus
      glideTo?: number
    } = {},
  ) {
    if (!this.ctx) return
    const dest = this.busNode(opts.bus ?? 'sfx')
    if (!dest) return
    const t = this.ctx.currentTime + when
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    const peak = opts.gain ?? 0.3
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, t)
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur)
    // Fast attack, smooth decay.
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  /** Short burst of filtered noise — used for splashes/impacts. */
  private noise(
    when: number,
    dur: number,
    opts: { gain?: number; type?: BiquadFilterType; freq?: number } = {},
  ) {
    if (!this.ctx || !this.sfxGain) return
    const t = this.ctx.currentTime + when
    const frames = Math.floor(this.ctx.sampleRate * dur)
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = opts.type ?? 'bandpass'
    filter.frequency.value = opts.freq ?? 900
    const g = this.ctx.createGain()
    const peak = opts.gain ?? 0.4
    g.gain.setValueAtTime(peak, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxGain)
    src.start(t)
    src.stop(t + dur)
  }

  // ---- Public sound effects -------------------------------------------------

  uiClick() {
    this.resume()
    this.tone(520, 0, 0.09, { type: 'triangle', gain: 0.22 })
  }

  uiSelect() {
    this.resume()
    this.tone(440, 0, 0.08, { type: 'triangle', gain: 0.22 })
    this.tone(660, 0.06, 0.1, { type: 'triangle', gain: 0.2 })
  }

  engineStart() {
    this.resume()
    // Rising rev.
    this.tone(120, 0, 0.5, { type: 'sawtooth', gain: 0.28, glideTo: 320 })
    this.tone(90, 0.04, 0.5, { type: 'square', gain: 0.14, glideTo: 220 })
  }

  dodge() {
    // Quick upward whoosh as an obstacle passes.
    this.tone(300, 0, 0.14, { type: 'sine', gain: 0.14, glideTo: 620 })
  }

  crash() {
    this.resume()
    // Impact thud + water splash.
    this.tone(140, 0, 0.35, { type: 'square', gain: 0.3, glideTo: 60 })
    this.noise(0, 0.5, { gain: 0.5, type: 'lowpass', freq: 1400 })
    this.noise(0.05, 0.35, { gain: 0.3, type: 'highpass', freq: 2200 })
  }

  finish() {
    this.resume()
    // Cheerful ascending arpeggio.
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      this.tone(f, i * 0.11, 0.28, { type: 'triangle', gain: 0.26 })
    })
    this.noise(0.44, 0.5, { gain: 0.22, type: 'highpass', freq: 3000 })
  }

  // ---- Stage 2 (dive) effects ----------------------------------------------

  /** Emi throws a punch — a quick watery whoosh. */
  punch() {
    this.resume()
    this.tone(220, 0, 0.12, { type: 'square', gain: 0.16, glideTo: 520 })
    this.noise(0, 0.16, { gain: 0.22, type: 'bandpass', freq: 1200 })
  }

  /** Emi takes a hit — a muffled descending buzz. */
  hurt() {
    this.resume()
    this.tone(300, 0, 0.32, { type: 'sawtooth', gain: 0.24, glideTo: 90 })
    this.noise(0, 0.3, { gain: 0.28, type: 'lowpass', freq: 900 })
  }

  /** Collect an air bubble — a bright rising blip. */
  pickup() {
    this.resume()
    this.tone(660, 0, 0.1, { type: 'sine', gain: 0.2, glideTo: 990 })
    this.tone(990, 0.06, 0.12, { type: 'sine', gain: 0.16 })
  }

  /** Land a punch on a Kraken tentacle — a chunky crunch. */
  bossHit() {
    this.resume()
    this.tone(160, 0, 0.18, { type: 'square', gain: 0.26, glideTo: 70 })
    this.noise(0, 0.22, { gain: 0.34, type: 'lowpass', freq: 1600 })
  }

  /** The Kraken is driven off — a triumphant low-to-high sweep. */
  bossDefeat() {
    this.resume()
    const notes = [329.63, 415.3, 493.88, 659.25, 830.61]
    notes.forEach((f, i) => {
      this.tone(f, i * 0.12, 0.34, { type: 'triangle', gain: 0.26 })
    })
    this.noise(0.5, 0.6, { gain: 0.24, type: 'highpass', freq: 2600 })
  }

  // ---- Background music (gentle looping arpeggio) ---------------------------

  /** Pentatonic loop that fits the breezy sea-adventure vibe. */
  private static readonly MUSIC_SEQUENCE = [
    293.66, 440, 587.33, 440, 329.63, 493.88, 659.25, 493.88,
  ]
  private static readonly MUSIC_STEP_MS = 260

  /** Slower, lower minor loop for the tense underwater dive. */
  private static readonly DIVE_SEQUENCE = [
    196, 261.63, 311.13, 261.63, 174.61, 233.08, 293.66, 233.08,
  ]
  private static readonly DIVE_STEP_MS = 330

  /** Breezy sea-adventure loop (Stage 1). */
  startMusic() {
    this.playMusic(SoundManager.MUSIC_SEQUENCE, SoundManager.MUSIC_STEP_MS, 0.22)
  }

  /** Tense, deeper loop for the dive (Stage 2). */
  startDiveMusic() {
    this.playMusic(SoundManager.DIVE_SEQUENCE, SoundManager.DIVE_STEP_MS, 0.2)
  }

  private playMusic(sequence: number[], stepMs: number, gain: number) {
    this.resume()
    if (!this.ctx || !this.musicGain) return
    if (this.musicTimer) return
    // Fade music in.
    this.musicGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.5)
    this.musicStep = 0
    const step = () => {
      const f = sequence[this.musicStep % sequence.length]
      // Melody note + a soft lower octave for warmth.
      this.tone(f, 0, 0.34, { type: 'triangle', gain: 0.18, bus: 'music' })
      if (this.musicStep % 2 === 0) {
        this.tone(f / 2, 0, 0.5, { type: 'sine', gain: 0.12, bus: 'music' })
      }
      this.musicStep++
    }
    step()
    this.musicTimer = setInterval(step, stepMs)
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25)
    }
  }
}

export const sound = new SoundManager()
