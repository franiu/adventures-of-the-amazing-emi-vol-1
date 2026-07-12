# AGENT.md — Adventures of the Amazing Emi, Vol 1

Guidance for AI agents and developers working in this repository. Read this
before making changes. The full game specification lives in [`spec/`](./spec).

## What this is

A single-page, mobile-first, touch-friendly web game. A young girl, **Emi**,
must rescue her parents from the lost city of **Atlantis** across three
mini-game stages wrapped in intro / transition / outro cutscenes. All progress
and stats persist in **cookies** — there is no server-side storage.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** (theme tokens in `app/globals.css`, no `tailwind.config`)
- **TypeScript**
- **HTML5 Canvas 2D** for real-time gameplay; React owns all menus/HUD/cutscenes
- **pnpm** (see `pnpm-lock.yaml`)
- No game engine and no heavy runtime deps — Canvas 2D + React only.

## Commands

```bash
pnpm dev      # start dev server
pnpm build    # production build
pnpm lint     # lint
```

## Project structure

```
app/
  page.tsx                → mounts <GameRoot/>
  layout.tsx              → fonts (Fredoka display, Nunito body), metadata, <html> bg
  globals.css             → ocean theme tokens + game-surface utilities
components/game/
  game-root.tsx           → top-level screen state machine (the router)
  screens/                → React screens (main-menu, cutscene, results, stub, loading)
  hud/                    → overlays (pause, game-over)
  stages/                 → per-stage React wrappers that host a <canvas>
  ui/                     → shared game UI (game-button)
lib/game/
  engine/                 → framework-agnostic loop core (game-loop, canvas, types)
  stages/                 → per-stage simulation logic (pure TS, no React)
  state/                  → cookie persistence, stats, screen enum
  assets/                 → image manifest + loader (incl. chroma-key)
  input/                  → unified touch + keyboard input manager
  cutscenes.ts            → cutscene scripts (data, not components)
public/game/              → generated art + user-provided character portraits
spec/                     → game design + technical specification
```

## Core architecture rules

1. **Separation of concerns:** stage *logic* is pure TS in `lib/game/stages/`
   and must not import React. The React wrapper in `components/game/stages/`
   owns the canvas, input wiring, loop lifecycle, and HUD.
2. **One active stage:** the screen state machine mounts only the current
   screen. Never run multiple game loops at once.
3. **Stage interface:** every stage exposes
   `init(ctx)`, `update(dt, input)`, `render(g)`, `isComplete()`, `didFail()`,
   `getStats()`. Follow this when adding Stage 2 / Stage 3.
4. **Fixed-timestep loop:** `lib/game/engine/game-loop.ts` uses an accumulator so
   physics are deterministic regardless of frame rate. Clamp the first frame
   after resume to avoid a `dt` spike.
5. **Virtual resolution:** all game math is in a portrait virtual resolution,
   letterboxed and DPR-scaled to the device in `canvas.ts`. Do not hardcode
   device pixels in stage logic.
6. **Pause/resume:** driven by the pause button *and* `visibilitychange`
   (auto-pause on tab blur). Pausing freezes the accumulator.

## Persistence (cookies only)

- Use `lib/game/state/cookies.ts` (typed JSON wrapper over `document.cookie`).
- Game stats live in `lib/game/state/stats.ts`: highest stage reached, best
  times/scores, attempts, wipeouts, completion flag.
- **Never** introduce `localStorage`, a database, or any server storage — the
  cookie-only constraint is a product requirement.

## Art pipeline — IMPORTANT

The image generator **cannot output true alpha transparency**; asking for a
"transparent background" bakes an opaque checkerboard into the PNG. Instead:

1. Generate sprites on a **solid flat magenta (`#FF00FF`) background**.
2. Add the sprite key to `CHROMA_KEY_ASSETS` in `lib/game/assets/manifest.ts`.
3. The loader (`lib/game/assets/loader.ts`) keys out the magenta into real
   transparency at load time (with edge feathering / de-fringing) and returns a
   processed `<canvas>`.

Full-frame backgrounds (e.g. `sea-bg.png`) are used as-is and must **not** be
chroma-keyed. User-provided character portraits live in
`public/game/characters/` and are used for cutscenes/HUD, not as moving sprites.

## Design tokens

Ocean-themed palette + Fredoka/Nunito fonts are defined in `app/globals.css`.
Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) and
the `.font-display` / `.game-surface` utilities rather than raw colors.

## Build status

- Done: app shell, engine core, input, cookie stats, cutscene player, Stage 1
  (Speedboat Dash) fully playable.
- Stubbed (reachable "Coming soon" screens): Stage 2 (diving/Kraken), Stage 3
  (platformer + Connect-4), transitions, outro reunion.

See [`spec/roadmap.md`](./spec/roadmap.md) for what's next.
