export type Screen =
  | 'menu'
  | 'intro'
  | 'stage1'
  | 'transition1'
  | 'stage2'
  | 'transition2'
  | 'stage3'
  | 'outro'
  | 'results'

/** Result reported by a stage when it ends. */
export type StageResult = {
  cleared: boolean
  time: number
  score: number
}
