'use client'

import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_6px_0_0_oklch(0.55_0.16_40)] active:shadow-[0_2px_0_0_oklch(0.55_0.16_40)]',
  secondary:
    'bg-secondary text-secondary-foreground shadow-[0_6px_0_0_oklch(0.55_0.12_205)] active:shadow-[0_2px_0_0_oklch(0.55_0.12_205)]',
  ghost:
    'bg-card/70 text-foreground border border-border shadow-[0_4px_0_0_oklch(0.22_0.06_245)] active:shadow-[0_1px_0_0_oklch(0.22_0.06_245)]',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

export function GameButton({
  variant = 'primary',
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'font-display select-none rounded-2xl px-7 py-4 text-lg font-bold tracking-wide',
        'transition-transform duration-100 active:translate-y-1',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
