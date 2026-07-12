export type Difficulty = 'rookie' | 'adventurer' | 'indiana'

/**
 * Global difficulty knobs. Each stage owns its own base tuning and applies
 * these multipliers to it, so a single choice scales the whole adventure.
 *
 * - speedMul:     overall gameplay / scroll speed
 * - spawnMul:     obstacle/hazard frequency (higher = more, spawns more often)
 * - densityBonus: added to a stage's per-wave obstacle cap (can be negative)
 * - hitScale:     collision hitbox scale (lower = more forgiving)
 */
export type DifficultyConfig = {
  id: Difficulty
  label: string
  tagline: string
  blurb: string
  speedMul: number
  spawnMul: number
  densityBonus: number
  hitScale: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  rookie: {
    id: 'rookie',
    label: 'Rookie',
    tagline: 'Relaxed',
    blurb: 'Slower pace and fewer obstacles. Perfect for first-timers.',
    speedMul: 0.8,
    spawnMul: 0.78,
    densityBonus: -1,
    hitScale: 0.85,
  },
  adventurer: {
    id: 'adventurer',
    label: 'Adventurer',
    tagline: 'Balanced',
    blurb: 'The intended challenge — a brisk pace with a steady ramp.',
    speedMul: 1,
    spawnMul: 1,
    densityBonus: 0,
    hitScale: 1,
  },
  indiana: {
    id: 'indiana',
    label: 'Indiana Jones',
    tagline: 'Brutal',
    blurb: 'Blistering speed, dense hazards and unforgiving hitboxes.',
    speedMul: 1.22,
    spawnMul: 1.3,
    densityBonus: 1,
    hitScale: 1.08,
  },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['rookie', 'adventurer', 'indiana']

export const DEFAULT_DIFFICULTY: Difficulty = 'adventurer'

export function getDifficulty(id: Difficulty | undefined | null): DifficultyConfig {
  return DIFFICULTIES[id ?? DEFAULT_DIFFICULTY] ?? DIFFICULTIES[DEFAULT_DIFFICULTY]
}
