# Adventures of the Amazing Emi — Vol 1 · Specification

This folder is the source of truth for the game's design and technical
specification. It complements the developer guide in [`../AGENT.md`](../AGENT.md).

## Contents

- [`game-design.md`](./game-design.md) — story, characters, tone, player
  experience, and the game-wide rules (controls, pause, persistence).
- [`stages.md`](./stages.md) — detailed per-stage design: Stage 1 Speedboat
  Dash, Stage 2 Deep Dive, Stage 3 Atlantis Run + Connect-4.
- [`architecture.md`](./architecture.md) — technical architecture, module
  layout, the stage interface, game loop, and rendering model.
- [`assets.md`](./assets.md) — art direction, asset manifest, the
  magenta chroma-key pipeline, and the user-provided character portraits.
- [`roadmap.md`](./roadmap.md) — build status and remaining work.

## One-paragraph summary

Emi's explorer parents vanished searching for the lost city of Atlantis. Playing
as Emi, the player clears three back-to-back mini-games — a high-speed boat
dodge, an oxygen-limited dive past sea monsters and the Kraken, and an Atlantis
platform run ending in a Connect-4 duel with the Queen — to reach a happy family
reunion. It is a single-page, mobile-first, touch-first web game with cartoonish
art and cutscenes; all results and stats are stored in cookies.
