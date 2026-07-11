'use client'

import { useState } from 'react'
import Image from 'next/image'
import { GameButton } from '@/components/game/ui/game-button'
import { cn } from '@/lib/utils'

export type CutscenePanel = {
  image?: string
  imageAlt?: string
  /** extra classes for the portrait frame (e.g. animation flavor) */
  imageClassName?: string
  title?: string
  lines: string[]
  bgClassName?: string
}

type Props = {
  panels: CutscenePanel[]
  onDone: () => void
  doneLabel?: string
}

export function Cutscene({ panels, onDone, doneLabel = "Let's go!" }: Props) {
  const [index, setIndex] = useState(0)
  const panel = panels[index]
  const isLast = index === panels.length - 1

  const next = () => {
    if (isLast) onDone()
    else setIndex((i) => i + 1)
  }

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6',
        'bg-gradient-to-b from-ocean-mid to-ocean-deep',
        panel.bgClassName,
      )}
    >
      {/* Skip */}
      <button
        onClick={onDone}
        className="absolute right-4 top-5 z-20 rounded-full bg-card/70 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm"
      >
        Skip
      </button>

      {/* Tap-to-advance layer */}
      <button
        aria-label="Continue"
        onClick={next}
        className="absolute inset-0 z-0"
      />

      <div
        key={index}
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 duration-500 animate-in fade-in slide-in-from-bottom-6"
      >
        {panel.image && (
          <div
            className={cn(
              'relative h-56 w-56 overflow-hidden rounded-3xl border-4 border-secondary shadow-2xl',
              panel.imageClassName,
            )}
          >
            <Image
              src={panel.image || '/placeholder.svg'}
              alt={panel.imageAlt ?? ''}
              fill
              className="object-cover object-top"
            />
          </div>
        )}

        <div className="rounded-3xl bg-card/85 p-6 text-center backdrop-blur-sm">
          {panel.title && (
            <h2 className="font-display mb-2 text-3xl font-bold text-primary">
              {panel.title}
            </h2>
          )}
          {panel.lines.map((line, i) => (
            <p
              key={i}
              className="text-pretty text-base leading-relaxed text-card-foreground"
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex flex-col items-center gap-2">
        <GameButton onClick={next}>{isLast ? doneLabel : 'Next'}</GameButton>
        <div className="mt-1 flex gap-1.5">
          {panels.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                i === index ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
