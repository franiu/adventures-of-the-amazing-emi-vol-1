/** Central registry of image assets, keyed by a short id used in code. */
export const IMAGES = {
  // Characters (user-provided portraits)
  emi: '/game/characters/emi.png',
  dad: '/game/characters/dad.png',
  mom: '/game/characters/mom.png',
  happyEnding: '/game/characters/happy-ending.png',
  // Menu / shared
  menuBg: '/game/menu-bg.png',
  // Stage 1 — boat ride
  boatEmi: '/game/stage1/boat-emi.png',
  seaBg: '/game/stage1/sea-bg.png',
  obstacleRock: '/game/stage1/obstacle-rock.png',
  obstacleBuoy: '/game/stage1/obstacle-buoy.png',
  obstacleBarrel: '/game/stage1/obstacle-barrel.png',
} as const

export type ImageKey = keyof typeof IMAGES

export const STAGE1_ASSETS: ImageKey[] = [
  'boatEmi',
  'seaBg',
  'obstacleRock',
  'obstacleBuoy',
  'obstacleBarrel',
]
