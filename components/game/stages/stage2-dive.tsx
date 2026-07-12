'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Wind } from 'lucide-react'
import { GameLoop } from '@/lib/game/engine/game-loop'
import {
  applyViewport,
  fitCanvas,
  pointerToVirtual,
  TOUCH_POINTER_OFFSET_Y,
  type Viewport,
} from '@/lib/game/engine/canvas'
import { InputManager } from '@/lib/game/input/input'
import { preloadImages } from '@/lib/game/assets/loader'
import { STAGE2_ASSETS } from '@/lib/game/assets/manifest'
import { DiveStage, type Stage2Hud } from '@/lib/game/stages/stage2'
import type { StageResult } from '@/lib/game/state/screens'
import type { DifficultyConfig } from '@/lib/game/difficulty'
import { sound } from '@/lib/game/audio/sound'
import { GameButton } from '@/components/game/ui/game-button'
import { LoadingScreen } from '@/components/game/screens/loading-screen'
import { PauseOverlay } from '@/components/game/hud/pause-overlay'
import { GameOverOverlay } from '@/components/game/hud/game-over-overlay'

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost'

type Props = {
  difficulty: DifficultyConfig
  onComplete: (result: StageResult) => void
  onQuit: () => void
}

const INITIAL_HUD: Stage2Hud = {
  oxygen: 1,
  progress: 0,
  status: 'playing',
  time: 0,
  punches: 0,
  boss: false,
  bossHealth: 1,
}

export function Stage2Dive({ difficulty, onComplete, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<DiveStage | null>(null)
  const inputRef = useRef<InputManager | null>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const viewRef = useRef<Viewport | null>(null)
  const frameCountRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [hud, setHud] = useState<Stage2Hud>(INITIAL_HUD)
  const [summary, setSummary] = useState({ score: 0, time: 0 })
  const phaseRef = useRef<Phase>('loading')
  phaseRef.current = phase

  // ---- Preload assets ----
  useEffect(() => {
    let active = true
    preloadImages(STAGE2_ASSETS, (loaded, total) => {
      if (active) setProgress(total ? loaded / total : 1)
    }).then(() => {
      if (active) setPhase('ready')
    })
    return () => {
      active = false
    }
  }, [])

  // ---- Canvas sizing ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      viewRef.current = fitCanvas(canvas)
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
    }
  }, [])

  const endStage = useCallback((status: 'won' | 'lost', sim: DiveStage) => {
    loopRef.current?.stop()
    sound.stopMusic()
    const h = sim.getHud()
    setHud(h)
    setSummary({ score: sim.getScore(), time: h.time })
    setPhase(status)
  }, [])

  // ---- Start / restart the run ----
  const startRun = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!simRef.current) simRef.current = new DiveStage(difficulty)
    if (!inputRef.current) {
      inputRef.current = new InputManager()
      inputRef.current.attach()
    }
    const sim = simRef.current
    const input = inputRef.current
    sim.setConfig(difficulty)
    sim.reset()
    viewRef.current = fitCanvas(canvas)

    const update = (dt: number) => {
      const snap = input.sample()
      sim.update(dt, snap)
      for (const ev of sim.drainEvents()) {
        if (ev === 'punch') sound.punch()
        else if (ev === 'hitEnemy') sound.bossHit()
        else if (ev === 'hurt') sound.hurt()
        else if (ev === 'pickup') sound.pickup()
        else if (ev === 'krakenHit') sound.bossHit()
        else if (ev === 'krakenDefeat') sound.bossDefeat()
      }
      if (sim.status !== 'playing') {
        endStage(sim.status, sim)
      }
    }

    const render = () => {
      const view = viewRef.current
      if (!view) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      applyViewport(ctx, view)
      sim.render(ctx)
      frameCountRef.current += 1
      if (frameCountRef.current % 4 === 0) {
        setHud(sim.getHud())
      }
    }

    loopRef.current?.stop()
    loopRef.current = new GameLoop(update, render)
    loopRef.current.start()
    sound.startDiveMusic()
    setPhase('playing')
  }, [endStage, difficulty])

  // ---- Auto-pause on tab blur ----
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'playing') {
        loopRef.current?.pause()
        sound.stopMusic()
        setPhase('paused')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      loopRef.current?.stop()
      inputRef.current?.detach()
      sound.stopMusic()
    }
  }, [])

  // ---- Pointer steering ----
  const handlePointer = useCallback((e: React.PointerEvent, active: boolean) => {
    const view = viewRef.current
    const canvas = canvasRef.current
    const input = inputRef.current
    if (!view || !canvas || !input) return
    if (!active) {
      input.setPointer(false, 0, 0)
      return
    }
    const rect = canvas.getBoundingClientRect()
    const p = pointerToVirtual(view, e.clientX, e.clientY, rect)
    // Lift the steer target above the fingertip so touch doesn't hide Emi.
    const offsetY = e.pointerType === 'touch' ? TOUCH_POINTER_OFFSET_Y : 0
    input.setPointer(true, p.x, p.y - offsetY)
  }, [])

  const punch = () => {
    inputRef.current?.pressAction()
    // Action is edge-triggered; release immediately so holding doesn't spam.
    inputRef.current?.releaseAction()
  }

  const pause = () => {
    if (phase !== 'playing') return
    loopRef.current?.pause()
    sound.stopMusic()
    setPhase('paused')
  }
  const resume = () => {
    if (phase !== 'paused') return
    loopRef.current?.resume()
    sound.startDiveMusic()
    setPhase('playing')
  }
  const restart = () => startRun()
  const finishWin = () =>
    onComplete({ cleared: true, time: summary.time, score: summary.score })

  const oxygenPct = Math.round(hud.oxygen * 100)
  const oxygenColor =
    hud.oxygen > 0.5
      ? 'bg-accent'
      : hud.oxygen > 0.25
        ? 'bg-secondary'
        : 'bg-destructive'
  const oxygenLow = hud.oxygen <= 0.25

  return (
    <div className="relative h-full w-full overflow-hidden bg-ocean-deep">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          handlePointer(e, true)
        }}
        onPointerMove={(e) => phase === 'playing' && handlePointer(e, true)}
        onPointerUp={(e) => handlePointer(e, false)}
        onPointerCancel={(e) => handlePointer(e, false)}
      />

      {/* HUD */}
      {(phase === 'playing' || phase === 'paused') && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
            {/* Oxygen meter */}
            <div className="min-w-[150px] flex-1 rounded-2xl bg-ocean-deep/60 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <Wind
                  className={`h-4 w-4 ${oxygenLow ? 'text-destructive' : 'text-accent'}`}
                  aria-hidden
                />
                <p className="font-display text-xs uppercase tracking-wide text-secondary">
                  Oxygen
                </p>
              </div>
              <div
                className="mt-1.5 h-3 overflow-hidden rounded-full bg-ocean-deep/70"
                role="progressbar"
                aria-valuenow={oxygenPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Oxygen remaining"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${oxygenColor} ${oxygenLow ? 'animate-pulse' : ''}`}
                  style={{ width: `${oxygenPct}%` }}
                />
              </div>
            </div>

            {/* Progress to Atlantis */}
            <div className="flex-1 px-1 pt-1">
              <div className="mx-auto h-3 max-w-[220px] overflow-hidden rounded-full bg-ocean-deep/60">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${Math.round(hud.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs font-semibold text-secondary">
                Atlantis {Math.round(hud.progress * 100)}%
              </p>
            </div>

            <button
              onClick={pause}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-ocean-deep/60 text-foreground backdrop-blur-sm"
              aria-label="Pause"
            >
              <span className="flex gap-1">
                <span className="block h-4 w-1.5 rounded-full bg-current" />
                <span className="block h-4 w-1.5 rounded-full bg-current" />
              </span>
            </button>
          </div>

          {/* Boss health bar */}
          {hud.boss && (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex flex-col items-center gap-1 px-8">
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-destructive">
                The Kraken
              </p>
              <div className="h-3 w-full max-w-sm overflow-hidden rounded-full border border-destructive/50 bg-ocean-deep/70">
                <div
                  className="h-full rounded-full bg-destructive transition-[width] duration-200"
                  style={{ width: `${Math.round(hud.bossHealth * 100)}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Punch button */}
      {phase === 'playing' && (
        <button
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            punch()
          }}
          className="font-display absolute bottom-8 right-6 z-10 flex h-24 w-24 select-none items-center justify-center rounded-full border-4 border-secondary/70 bg-primary/90 text-lg font-bold text-primary-foreground shadow-lg backdrop-blur-sm transition-transform active:scale-90"
          aria-label="Punch"
        >
          Punch!
        </button>
      )}

      {/* Controls hint */}
      {phase === 'playing' && hud.time < 3.5 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-40 z-10 text-center">
          <p className="mx-auto inline-block rounded-full bg-ocean-deep/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-sm">
            Drag to swim • tap Punch to swat enemies • grab air bubbles!
          </p>
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20">
          <LoadingScreen progress={progress} label="Descending into the deep…" />
        </div>
      )}

      {/* Ready */}
      {phase === 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-ocean-deep/70 px-8 text-center backdrop-blur-sm">
          <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-secondary">
            Stage 2
          </p>
          <h2 className="font-display text-5xl font-bold text-primary">
            Deep Dive
          </h2>
          <span className="font-display rounded-full bg-accent px-4 py-1 text-sm font-bold text-accent-foreground">
            {difficulty.label} · {difficulty.tagline}
          </span>
          <p className="max-w-xs text-pretty text-card-foreground">
            Swim down to the gates of Atlantis! Your{' '}
            <span className="font-bold text-accent">oxygen</span> is always
            draining — grab air bubbles to top it up. Dodge or{' '}
            <span className="font-bold text-primary">punch</span> the sharks and
            mermaids (punching costs air), then drive back the{' '}
            <span className="font-bold text-destructive">Kraken</span> to reach
            the dock.
          </p>
          <GameButton onClick={startRun}>Dive!</GameButton>
        </div>
      )}

      {/* Pause */}
      {phase === 'paused' && (
        <PauseOverlay onResume={resume} onRestart={restart} onQuit={onQuit} />
      )}

      {/* Win */}
      {phase === 'won' && (
        <div className="absolute inset-0 z-30 flex animate-in flex-col items-center justify-center gap-4 bg-ocean-deep/85 px-8 text-center backdrop-blur-sm fade-in duration-300">
          <h2 className="font-display animate-in text-5xl font-bold text-accent zoom-in-50 duration-500">
            Atlantis Dock!
          </h2>
          <p className="max-w-xs text-pretty text-card-foreground">
            Emi drove off the Kraken and reached the glowing gate of Atlantis.
            Her parents must be just beyond it!
          </p>
          <p className="font-display text-xl font-bold text-secondary">
            Score: {summary.score}
          </p>
          <GameButton onClick={finishWin}>Continue</GameButton>
        </div>
      )}

      {/* Lose */}
      {phase === 'lost' && (
        <GameOverOverlay
          title="Out of Air!"
          message="Emi ran out of oxygen in the deep. Catch your breath and dive again!"
          score={summary.score}
          onRetry={restart}
          onQuit={onQuit}
        />
      )}
    </div>
  )
}
