import type { CutscenePanel } from '@/components/game/screens/cutscene'

export const INTRO_PANELS: CutscenePanel[] = [
  {
    image: '/game/characters/mom.png',
    imageAlt: "Emi's mother",
    title: 'A Strange Message',
    lines: [
      'Emi\u2019s parents are world-famous explorers.',
      'Last week they sailed off to find the lost city of Atlantis\u2026',
    ],
  },
  {
    image: '/game/characters/dad.png',
    imageAlt: "Emi's father",
    title: 'Trouble Below',
    lines: [
      '\u201CEmi\u2014 the sea took us! We\u2019re trapped beneath the waves!\u201D',
      'The radio crackled\u2026 then went silent.',
    ],
  },
  {
    image: '/game/characters/emi.png',
    imageAlt: 'Emi',
    imageClassName: 'animate-bounce',
    title: 'Emi to the Rescue!',
    lines: [
      'Emi grabbed her life vest and jumped in the speedboat.',
      'Hold on, Mom and Dad. Here she comes!',
    ],
  },
]

export const OUTRO_PANELS: CutscenePanel[] = [
  {
    image: '/game/characters/happy-ending.png',
    imageAlt: 'Emi reunited with her parents',
    title: 'Reunited!',
    lines: [
      'Deep in glittering Atlantis, Emi found them at last.',
      'Hugs all around \u2014 the bravest rescue the sea has ever seen!',
    ],
  },
]
