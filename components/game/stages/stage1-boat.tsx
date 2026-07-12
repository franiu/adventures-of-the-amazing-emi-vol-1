'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { GameLoop } from '@/lib/game/engine/game-loop'
import {
  applyViewport,
  fitCanvas,
  pointerToVirtual,
  type Viewport,
} from '@/lib/game/engine/canvas'
import { InputManager } from '@/lib/game/input/input'
import { preloadImages } from '@/lib/game/assets/loader'
import { STAGE1_ASSETS } from '@/lib/game/assets/manifest'
import { BoatStage, type Stage1Hud } from '@/lib/game/stages/stage1'
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

export function Stage1Boat({ difficulty, onComplete, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<BoatStage | null>(null)
  const inputRef = useRef<InputManager | null>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const viewRef = useRef<Viewport | null>(null)
  const frameCountRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [hud, setHud] = useState<Stage1Hud>({
    score: 0,
    progress: 0,
    status: 'playing',
    time: 0,
    lives: 3,
    maxLives: 3,
  })
  const phaseRef = useRef<Phase>('loading')
  phaseRef.current = phase

  // ---- Preload assets ----
  useEffect(() => {
    let active = true
    preloadImages(STAGE1_ASSETS, (loaded, total) => {
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

  const endStage = useCallback(
    (status: 'won' | 'lost', sim: BoatStage) => {
      loopRef.current?.stop()
      sound.stopMusic()
      const h = sim.getHud()
      setHud(h)
      setPhase(status)
    },
    [],
  )

  // ---- Start / restart the run ----
  const startRun = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!simRef.current) simRef.current = new BoatStage(difficulty)
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
      // Turn gameplay events into sounds.
      for (const ev of sim.drainEvents()) {
        if (ev === 'dodge') sound.dodge()
        else if (ev === 'crash') sound.crash()
        else if (ev === 'finish') sound.finish()
        else if (ev === 'respawn') sound.engineStart()
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
      // Throttle HUD updates to ~12/s
      frameCountRef.current += 1
      if (frameCountRef.current % 5 === 0) {
        setHud(sim.getHud())
      }
    }

    loopRef.current?.stop()
    loopRef.current = new GameLoop(update, render)
    loopRef.current.start()
    sound.engineStart()
    sound.startMusic()
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
  const handlePointer = useCallback(
    (e: React.PointerEvent, active: boolean) => {
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
      input.setPointer(true, p.x, p.y)
    },
    [],
  )

  const pause = () => {
    if (phase !== 'playing') return
    loopRef.current?.pause()
    sound.stopMusic()
    setPhase('paused')
  }
  const resume = () => {
    if (phase !== 'paused') return
    loopRef.current?.resume()
    sound.startMusic()
    setPhase('playing')
  }
  const restart = () => startRun()
  const finishWin = () =>
    onComplete({ cleared: true, time: hud.time, score: hud.score })

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
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
          <div className="rounded-2xl bg-ocean-deep/60 px-4 py-2 backdrop-blur-sm">
            <p className="font-display text-xs uppercase tracking-wide text-secondary">
              Score
            </p>
            <p className="font-display text-2xl font-bold leading-none text-foreground">
              {hud.score}
            </p>
            <div className="mt-1.5 flex gap-1" aria-label={`${hud.lives} lives left`}>
              {Array.from({ length: hud.maxLives }).map((_, i) => (
                <Heart
                  key={i}
                  className={
                    i < hud.lives
                      ? 'h-4 w-4 fill-primary text-primary'
                      : 'h-4 w-4 fill-transparent text-muted-foreground/50'
                  }
                  aria-hidden
                />
              ))}
            </div>
          </div>

          <div className="flex-1 px-3 pt-1">
            <div className="mx-auto h-3 max-w-[240px] overflow-hidden rounded-full bg-ocean-deep/60">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${Math.round(hud.progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs font-semibold text-secondary">
              Diving site {Math.round(hud.progress * 100)}%
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
      )}

      {/* Steering hint */}
      {phase === 'playing' && hud.time < 3 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center">
          <p className="mx-auto inline-block rounded-full bg-ocean-deep/60 px-4 py-2 text-sm font-semibold text-foreground backdrop-blur-sm">
            Drag to steer • dodge the obstacles!
          </p>
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20">
          <LoadingScreen progress={progress} label="Fueling the speedboat…" />
        </div>
      )}

      {/* Ready */}
      {phase === 'ready' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-ocean-deep/70 px-8 text-center backdrop-blur-sm">
          <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-secondary">
            Stage 1
          </p>
          <h2 className="font-display text-5xl font-bold text-primary">
            Speedboat Dash
          </h2>
          <span className="font-display rounded-full bg-accent px-4 py-1 text-sm font-bold text-accent-foreground">
            {difficulty.label} · {difficulty.tagline}
          </span>
          <p className="max-w-xs text-pretty text-card-foreground">
            Race to the diving site! Drag anywhere to steer Emi&apos;s boat and
            dodge the rocks, buoys and barrels. They get faster and thicker the
            closer you get. You have{' '}
            <span className="font-bold text-primary">3 lives</span> — crash and
            you&apos;ll bounce back for another try.
          </p>
          <GameButton onClick={startRun}>Start Engine!</GameButton>
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
            Diving Site!
          </h2>
          <p className="max-w-xs text-pretty text-card-foreground">
            Emi made it across the open sea. Time to gear up and dive for
            Atlantis!
          </p>
          <p className="font-display text-xl font-bold text-secondary">
            Score: {hud.score}
          </p>
          <GameButton onClick={finishWin}>Continue</GameButton>
        </div>
      )}

      {/* Lose */}
      {phase === 'lost' && (
        <GameOverOverlay
          title="Splash!"
          message="Emi's boat hit an obstacle. Shake it off and try the dash again!"
          score={hud.score}
          onRetry={restart}
          onQuit={onQuit}
        />
      )}
    </div>
  )
}
