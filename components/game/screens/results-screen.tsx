'use client'

import Image from 'next/image'
import { GameButton } from '@/components/game/ui/game-button'
import type { GameStats, StageId } from '@/lib/game/state/stats'

type Props = {
  stats: GameStats
  onPlayAgain: () => void
  onMenu: () => void
}

const STAGE_NAMES: Record<StageId, string> = {
  1: 'Speedboat Dash',
  2: 'The Deep Dive',
  3: 'Atlantis',
}

function formatTime(t: number | null): string {
  if (t === null) return '—'
  return `${t.toFixed(1)}s`
}

export function ResultsScreen({ stats, onPlayAgain, onMenu }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto bg-gradient-to-b from-ocean-mid to-ocean-deep px-6 py-10">
      <div className="relative mb-4 h-28 w-40 overflow-hidden rounded-2xl border-4 border-accent shadow-xl">
        <Image
          src="/game/characters/happy-ending.png"
          alt="Emi and her parents reunited"
          fill
          className="object-cover"
        />
      </div>

      <h2 className="font-display text-center text-4xl font-bold text-accent">
        {stats.completed ? 'Adventure Complete!' : 'Voyage Log'}
      </h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        {stats.completed
          ? 'Emi rescued her parents from Atlantis!'
          : 'Your journey so far.'}
      </p>

      <div className="mt-6 w-full max-w-sm space-y-3">
        {([1, 2, 3] as StageId[]).map((id) => {
          const rec = stats.stages[id]
          return (
            <div
              key={id}
              className="flex items-center justify-between rounded-2xl bg-card/80 px-5 py-4 backdrop-blur-sm"
            >
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  Stage {id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {STAGE_NAMES[id]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-secondary">
                  {rec.cleared ? `Score ${rec.bestScore}` : 'Locked'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Best {formatTime(rec.bestTime)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 pb-4">
        <GameButton onClick={onPlayAgain}>Play Again</GameButton>
        <button
          onClick={onMenu}
          className="text-sm font-semibold text-muted-foreground underline underline-offset-2"
        >
          Back to menu
        </button>
      </div>
    </div>
  )
}
