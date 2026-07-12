'use client'

import Image from 'next/image'
import { GameButton } from '@/components/game/ui/game-button'
import type { GameStats } from '@/lib/game/state/stats'
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  getDifficulty,
  type Difficulty,
} from '@/lib/game/difficulty'

type Props = {
  stats: GameStats
  onNewGame: () => void
  onContinue: () => void
  onReset: () => void
  onSetDifficulty: (d: Difficulty) => void
}

const STAGE_NAMES = ['', 'Speedboat Dash', 'The Deep Dive', 'Atlantis'] as const

export function MainMenu({
  stats,
  onNewGame,
  onContinue,
  onReset,
  onSetDifficulty,
}: Props) {
  const canContinue = stats.highestStage > 1 || stats.completed

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Background art */}
      <Image
        src="/game/menu-bg.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ocean-deep/40 via-ocean-deep/30 to-ocean-deep/90" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-8">
        <header className="mt-4 flex flex-col items-center text-center">
          <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-secondary">
            Adventures of the Amazing
          </p>
          <h1 className="font-display mt-1 text-6xl font-bold leading-none text-primary drop-shadow-[0_3px_0_oklch(0.3_0.09_40)]">
            Emi
          </h1>
          <p className="font-display mt-2 rounded-full bg-accent px-4 py-1 text-sm font-bold text-accent-foreground">
            Vol. 1 — The Lost City
          </p>
        </header>

        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-secondary/30 blur-xl" />
          <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-secondary shadow-xl">
            <Image
              src="/game/characters/emi.png"
              alt="Emi, the hero"
              fill
              className="object-cover object-top"
            />
          </div>
        </div>

        <div className="flex w-full max-w-xs flex-col items-stretch gap-3">
          <div className="rounded-2xl bg-card/70 p-3 backdrop-blur-sm">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-secondary">
              Difficulty
            </p>
            <div
              role="radiogroup"
              aria-label="Difficulty"
              className="grid grid-cols-3 gap-2"
            >
              {DIFFICULTY_ORDER.map((id) => {
                const d = DIFFICULTIES[id]
                const active = stats.difficulty === id
                return (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSetDifficulty(id)}
                    className={`rounded-xl px-2 py-2 text-center transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-ocean-deep/40 text-muted-foreground'
                    }`}
                  >
                    <span className="font-display block text-sm font-bold leading-tight">
                      {d.label}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide">
                      {d.tagline}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 min-h-8 text-center text-xs text-pretty text-card-foreground">
              {getDifficulty(stats.difficulty).blurb}
            </p>
          </div>

          <GameButton onClick={onNewGame} className="w-full text-xl">
            {stats.completed ? 'Play Again' : 'New Adventure'}
          </GameButton>
          {canContinue && !stats.completed && (
            <GameButton variant="secondary" onClick={onContinue} className="w-full">
              Continue — Stage {stats.highestStage}
            </GameButton>
          )}

          <div className="mt-2 rounded-2xl bg-card/70 p-4 text-sm backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Attempts" value={stats.attempts} />
              <Stat label="Wipeouts" value={stats.deaths} />
              <Stat
                label="Stages"
                value={`${Object.values(stats.stages).filter((s) => s.cleared).length}/3`}
              />
            </div>
            {stats.stages[1].bestScore > 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Best {STAGE_NAMES[1]} score:{' '}
                <span className="font-bold text-foreground">
                  {stats.stages[1].bestScore}
                </span>
              </p>
            )}
            <button
              onClick={onReset}
              className="mx-auto mt-3 block text-xs font-semibold text-muted-foreground underline underline-offset-2"
            >
              Reset progress
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-secondary">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
