'use client'

type Props = {
  progress: number // 0..1
  label?: string
}

export function LoadingScreen({ progress, label = 'Loading…' }: Props) {
  const pct = Math.round(progress * 100)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-ocean-mid to-ocean-deep px-10">
      <p className="font-display text-2xl font-bold text-secondary">{label}</p>
      <div className="h-4 w-full max-w-xs overflow-hidden rounded-full bg-card/70">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{pct}%</p>
    </div>
  )
}
