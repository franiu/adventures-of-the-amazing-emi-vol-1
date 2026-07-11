'use client'

import { GameButton } from '@/components/game/ui/game-button'

type Props = {
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
}

export function PauseOverlay({ onResume, onRestart, onQuit }: Props) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-ocean-deep/80 backdrop-blur-sm">
      <h2 className="font-display text-4xl font-bold text-secondary">Paused</h2>
      <div className="flex w-56 flex-col gap-3">
        <GameButton onClick={onResume} className="w-full">
          Resume
        </GameButton>
        <GameButton variant="secondary" onClick={onRestart} className="w-full">
          Restart
        </GameButton>
        <GameButton variant="ghost" onClick={onQuit} className="w-full">
          Quit to Menu
        </GameButton>
      </div>
    </div>
  )
}
