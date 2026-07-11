'use client'

import { GameButton } from '@/components/game/ui/game-button'

type Props = {
  eyebrow?: string
  title: string
  lines: string[]
  primaryLabel: string
  onPrimary: () => void
  onMenu: () => void
}

export function StubScreen({
  eyebrow,
  title,
  lines,
  primaryLabel,
  onPrimary,
  onMenu,
}: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-ocean-mid to-ocean-deep px-8 text-center">
      <div className="max-w-md rounded-3xl bg-card/80 p-8 backdrop-blur-sm">
        {eyebrow && (
          <p className="font-display mb-2 text-sm font-bold uppercase tracking-[0.25em] text-secondary">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-4xl font-bold text-primary">{title}</h2>
        <div className="mt-4 space-y-2">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-pretty leading-relaxed text-card-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <GameButton onClick={onPrimary}>{primaryLabel}</GameButton>
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
