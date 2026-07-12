# Roadmap & Build Status

## Done

- **App shell** — main menu (with Emi portrait + cookie stats), loading screen,
  results screen, stub screens, pause overlay, game-over overlay.
- **Engine core** — fixed-timestep game loop, DPR/letterboxed virtual-resolution
  canvas, shared types + collision helpers.
- **Input** — unified touch + keyboard snapshot manager.
- **Persistence** — cookie wrapper + stats model (highest stage, best scores,
  attempts, wipeouts, completion, difficulty, sound preference).
- **Cutscene player** — data-driven panels with next/skip; intro scripted.
- **Difficulty levels** — Rookie / Adventurer / Indiana Jones as global
  multipliers, selectable on the menu and persisted.
- **Audio** — synthesized Web Audio SFX + music engine with a persisted mute
  toggle (no audio files).
- **Stage 1 — Speedboat Dash** — fully playable: steering, scrolling water,
  rock/buoy/barrel obstacles, difficulty ramp, progress goal, win/fail flow, HUD,
  stats wired to cookies, a **3-lives system** with respawn + invulnerability,
  and **crash/finish outro animations** (particles, screen shake, flash).
- **Art pipeline** — magenta chroma-key + opaque-bounds measurement for
  transparent sprites and tight collisions.

## Next (in priority order)

1. **Transition 1 cutscene** — boat → diving site.
2. **Stage 2 — Deep Dive** — oxygen-meter timer, punch (oxygen cost), sharks and
   mermaids, **Kraken** boss with tentacle hitboxes, reach the Atlantis dock.
   Generate dive art (Emi diving/punch sprites, enemies, Kraken, underwater bg).
3. **Transition 2 cutscene** — arrival at the Atlantis dock.
4. **Stage 3 — Atlantis Run** — platformer physics (run/jump), hazards, throne
   room; then **Connect-4** duel vs the Queen with a beatable AI.
5. **Outro cutscene** — family reunion using `happy-ending.png`.
6. **Polish** — cutscene animation, extend audio/SFX to Stages 2–3, difficulty
   tuning, accessibility pass.

## Known constraints to preserve

- Cookies only — never add localStorage or server storage.
- Canvas 2D + React only — no game engine / heavy deps.
- Mobile-first, touch-first, single page, no scroll/zoom.
- Sprites needing transparency must use the magenta chroma-key pipeline.
