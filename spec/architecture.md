# Technical Architecture

## Rendering model

- **HTML5 Canvas 2D** with a custom `requestAnimationFrame` loop runs all
  real-time gameplay.
- **React** owns everything else: menus, HUD overlays, pause, cutscenes, and
  results. HUD elements are absolutely-positioned DOM above the canvas so they
  stay crisp and accessible.

## Module layout

```
app/page.tsx                → mounts <GameRoot/>
components/game/
  game-root.tsx             → top-level screen state machine (router)
  screens/                  → main-menu, cutscene, results, stub, loading
  hud/                      → pause-overlay, game-over-overlay
  stages/                   → React wrappers hosting a <canvas> per stage
  ui/game-button.tsx        → shared playful button
lib/game/
  engine/
    game-loop.ts            → fixed-timestep loop (start/stop/pause/resume)
    canvas.ts               → DPR-aware sizing + letterboxed virtual resolution
    types.ts                → Vec2, Rect, Entity, collision helpers (AABB/circle)
  stages/                   → pure-TS simulation per stage (no React)
  state/
    cookies.ts              → typed JSON cookie wrapper
    stats.ts                → game stats model + load/save (incl. difficulty)
    screens.ts             → screen enum
  input/input.ts            → unified touch + keyboard snapshot
  assets/
    manifest.ts             → image registry + chroma-key list
    loader.ts               → preload + magenta chroma-key
  difficulty.ts             → difficulty levels + global multipliers
  cutscenes.ts              → cutscene scripts (data)
```

## Screen state machine

`game-root.tsx` holds the active screen and swaps screens (never mounts all at
once), so only the current stage runs a loop:

```
BOOT → MAIN_MENU → INTRO_CUTSCENE
     → STAGE_1 → TRANSITION_1
     → STAGE_2 → TRANSITION_2
     → STAGE_3 → OUTRO_CUTSCENE → RESULTS
```

`PAUSED` is an overlay flag on top of a stage; `GAME_OVER` can retry the current
stage or quit to the menu.

## The stage interface

Stage logic is pure TypeScript and framework-agnostic. Each stage provides:

```ts
interface Stage {
  init(ctx: StageContext): void
  update(dt: number, input: InputSnapshot): void
  render(g: CanvasRenderingContext2D): void
  isComplete(): boolean   // cleared → advance story
  didFail(): boolean      // wiped out → game over
  getStats(): StageStats  // merged into cookie-persisted stats
}
```

The React wrapper: sizes the canvas, starts the loop, feeds the input snapshot
into `update`, calls `render`, and watches `isComplete` / `didFail` to drive the
state machine.

## Game loop

- Fixed-timestep **accumulator** pattern: physics update at a constant step for
  determinism; rendering is variable.
- `pause()` freezes the accumulator; `resume()` clamps the first frame's `dt` to
  avoid a large jump after being backgrounded.
- Auto-pause is wired to `visibilitychange`.

## Coordinate system

All gameplay math uses a **portrait virtual resolution**. `canvas.ts` scales and
letterboxes that virtual space to the device viewport and accounts for
device-pixel-ratio, so logic never deals in raw device pixels.

## Input

`lib/game/input/input.ts` merges touch (drag / tap zones / action button) and
keyboard (arrows/WASD/space, pause keys) into one normalized snapshot that
stages read each tick. It suppresses default touch scrolling/zoom on the canvas.

## Difficulty

`lib/game/difficulty.ts` defines three `DifficultyConfig` presets (`rookie`,
`adventurer`, `indiana`) as **global multipliers**: `speedMul`, `spawnMul`,
`densityBonus`, and `hitScale`. The selected difficulty is stored in the cookie
save (`stats.difficulty`) and read by `game-root.tsx`, which passes the resolved
config into the active stage.

Each stage keeps its own base tuning (the "Adventurer" reference values) and
applies the multipliers when computing derived values — e.g. `BoatStage` exposes
getters like `baseSpeed = 430 * speedMul`, `startInterval = 0.95 / spawnMul`,
`maxDensity = 3 + densityBonus`, `hitFactor = 0.82 * hitScale`. New stages should
follow the same pattern so one difficulty choice scales the whole game
consistently.

## Persistence

`state/cookies.ts` is a small typed JSON wrapper over `document.cookie` (~1 year
expiry, no dependency). `state/stats.ts` loads stats on boot and writes on stage
complete / game over. It persists the selected **difficulty** alongside progress
stats. **Cookies only — no localStorage or server storage.**

## Constraints

- No game engine, no heavy runtime dependencies — Canvas 2D + React only.
- All client-side (`"use client"`).
- Mobile-first: virtual resolution + letterboxing; touch-first controls with
  keyboard as a desktop convenience.
