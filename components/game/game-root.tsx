'use client'

import { useEffect, useState } from 'react'
import {
  defaultStats,
  loadStats,
  recordAttempt,
  recordStageClear,
  resetStats,
  type GameStats,
} from '@/lib/game/state/stats'
import type { Screen, StageResult } from '@/lib/game/state/screens'
import { INTRO_PANELS, OUTRO_PANELS } from '@/lib/game/cutscenes'
import { MainMenu } from '@/components/game/screens/main-menu'
import { Cutscene } from '@/components/game/screens/cutscene'
import { StubScreen } from '@/components/game/screens/stub-screen'
import { ResultsScreen } from '@/components/game/screens/results-screen'
import { Stage1Boat } from '@/components/game/stages/stage1-boat'

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [stats, setStats] = useState<GameStats>(defaultStats)

  // Hydrate stats from cookies after mount (client only).
  useEffect(() => {
    setStats(loadStats())
  }, [])

  const goStage1 = () => {
    setStats((s) => recordAttempt(s))
    setScreen('stage1')
  }

  const onStage1Complete = (r: StageResult) => {
    setStats((s) => recordStageClear(s, 1, r.time, r.score))
    setScreen('transition1')
  }

  const clearStubStage = (stage: 2 | 3, next: Screen) => {
    setStats((s) => recordStageClear(s, stage, 0, 0))
    setScreen(next)
  }

  const handleContinue = () => {
    const target = `stage${stats.highestStage}` as Screen
    setScreen(target)
  }

  const handleReset = () => setStats(resetStats())

  return (
    <main className="game-surface no-callout bg-background text-foreground">
      {screen === 'menu' && (
        <MainMenu
          stats={stats}
          onNewGame={() => setScreen('intro')}
          onContinue={handleContinue}
          onReset={handleReset}
        />
      )}

      {screen === 'intro' && (
        <Cutscene panels={INTRO_PANELS} onDone={goStage1} doneLabel="Set sail!" />
      )}

      {screen === 'stage1' && (
        <Stage1Boat
          onComplete={onStage1Complete}
          onQuit={() => setScreen('menu')}
        />
      )}

      {screen === 'transition1' && (
        <StubScreen
          eyebrow="Transition"
          title="Into the Deep"
          lines={[
            'Emi anchors above the dive site and slips on her mask.',
            'Below the surface, dark shapes are already circling…',
          ]}
          primaryLabel="Dive in"
          onPrimary={() => setScreen('stage2')}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'stage2' && (
        <StubScreen
          eyebrow="Stage 2"
          title="The Deep Dive"
          lines={[
            'Escape sharks and mermaids, punch back the Kraken, and watch your oxygen!',
            'This stage is coming in the next update — skip ahead for now.',
          ]}
          primaryLabel="Skip stage (preview)"
          onPrimary={() => clearStubStage(2, 'transition2')}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'transition2' && (
        <StubScreen
          eyebrow="Transition"
          title="The Sunken Gate"
          lines={[
            'Past the Kraken, Emi reaches the glowing dock of Atlantis.',
            'One last challenge stands between her and her parents.',
          ]}
          primaryLabel="Enter Atlantis"
          onPrimary={() => setScreen('stage3')}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'stage3' && (
        <StubScreen
          eyebrow="Stage 3"
          title="Atlantis"
          lines={[
            'Run and jump through the ruins, then beat the Queen at 4-in-a-row!',
            'This stage is coming in the next update — skip ahead for now.',
          ]}
          primaryLabel="Skip stage (preview)"
          onPrimary={() => clearStubStage(3, 'outro')}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'outro' && (
        <Cutscene
          panels={OUTRO_PANELS}
          onDone={() => setScreen('results')}
          doneLabel="See results"
        />
      )}

      {screen === 'results' && (
        <ResultsScreen
          stats={stats}
          onPlayAgain={() => setScreen('intro')}
          onMenu={() => setScreen('menu')}
        />
      )}
    </main>
  )
}
