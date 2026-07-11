'use client'

import { GameButton } from '@/components/game/ui/game-button'

type Props = {
  title: string
  message: string
  score?: number
  onRetry: () => void
  onQuit: () => void
}

export function GameOverOverlay({
  title,
  message,
  score,
  onRetry,
  onQuit,
}: Props) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-ocean-deep/85 px-8 text-center backdrop-blur-sm">
      <h2 className="font-display text-5xl font-bold text-primary">{title}</h2>
      <p className="max-w-xs text-pretty text-card-foreground">{message}</p>
      {typeof score === 'number' && (
        <p className="font-display text-xl font-bold text-secondary">
          Score: {score}
        </p>
      )}
      <div className="mt-2 flex w-56 flex-col gap-3">
        <GameButton onClick={onRetry} className="w-full">
          Try Again
        </GameButton>
        <GameButton variant="ghost" onClick={onQuit} className="w-full">
          Quit to Menu
        </GameButton>
      </div>
    </div>
  )
}
