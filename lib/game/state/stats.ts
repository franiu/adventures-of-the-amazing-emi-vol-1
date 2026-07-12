import { readCookie, writeCookie, deleteCookie } from './cookies'
import { DEFAULT_DIFFICULTY, type Difficulty } from '@/lib/game/difficulty'

const COOKIE_KEY = 'emi_save_v1'

export type StageId = 1 | 2 | 3

/** Per-stage best results. */
export type StageRecord = {
  cleared: boolean
  /** best (lowest) completion time in seconds */
  bestTime: number | null
  /** best score (higher is better) */
  bestScore: number
}

export type GameStats = {
  /** highest stage index the player has reached (1..3) */
  highestStage: StageId
  /** true once the whole adventure is finished */
  completed: boolean
  /** currently selected difficulty (persisted across sessions) */
  difficulty: Difficulty
  attempts: number
  deaths: number
  stages: Record<StageId, StageRecord>
}

function emptyStage(): StageRecord {
  return { cleared: false, bestTime: null, bestScore: 0 }
}

export function defaultStats(): GameStats {
  return {
    highestStage: 1,
    completed: false,
    difficulty: DEFAULT_DIFFICULTY,
    attempts: 0,
    deaths: 0,
    stages: { 1: emptyStage(), 2: emptyStage(), 3: emptyStage() },
  }
}

export function loadStats(): GameStats {
  const raw = readCookie<Partial<GameStats> | null>(COOKIE_KEY, null)
  if (!raw) return defaultStats()
  // Merge with defaults to stay resilient to older/partial saves.
  const base = defaultStats()
  return {
    ...base,
    ...raw,
    stages: {
      1: { ...base.stages[1], ...raw.stages?.[1] },
      2: { ...base.stages[2], ...raw.stages?.[2] },
      3: { ...base.stages[3], ...raw.stages?.[3] },
    },
  }
}

export function saveStats(stats: GameStats): void {
  writeCookie(COOKIE_KEY, stats)
}

export function resetStats(): GameStats {
  deleteCookie(COOKIE_KEY)
  return defaultStats()
}

export function setDifficulty(stats: GameStats, difficulty: Difficulty): GameStats {
  const updated = { ...stats, difficulty }
  saveStats(updated)
  return updated
}

/** Records a successful stage clear, updating bests and unlocking the next stage. */
export function recordStageClear(
  stats: GameStats,
  stage: StageId,
  time: number,
  score: number,
): GameStats {
  const prev = stats.stages[stage]
  const next: StageRecord = {
    cleared: true,
    bestTime: prev.bestTime === null ? time : Math.min(prev.bestTime, time),
    bestScore: Math.max(prev.bestScore, score),
  }
  const highestStage = Math.min(3, Math.max(stats.highestStage, stage + 1)) as StageId
  const completed = stats.completed || stage === 3
  const updated: GameStats = {
    ...stats,
    highestStage,
    completed,
    stages: { ...stats.stages, [stage]: next },
  }
  saveStats(updated)
  return updated
}

export function recordAttempt(stats: GameStats): GameStats {
  const updated = { ...stats, attempts: stats.attempts + 1 }
  saveStats(updated)
  return updated
}

export function recordDeath(stats: GameStats): GameStats {
  const updated = { ...stats, deaths: stats.deaths + 1 }
  saveStats(updated)
  return updated
}
