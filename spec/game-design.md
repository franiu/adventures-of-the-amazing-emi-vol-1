# Game Design

## Premise

Emi is a brave young girl whose parents — world-famous explorers — sailed off to
find the lost city of **Atlantis** and never returned. Emi sets out to rescue
them. To reach Atlantis and free them she must beat three challenges in
sequence, then reunite with her family.

## Characters

- **Emi** — the hero and player character. Long dirt-blonde hair, blue-grey
  eyes, braces, adventurous and fearless. (Portrait: `public/game/characters/emi.png`.)
- **Dad** — Emi's father, a captured explorer. Bearded, warm, easy-going.
  (Portrait: `dad.png`.)
- **Mom** — Emi's mother, a captured explorer. Blonde, sharp, determined.
  (Portrait: `mom.png`.)
- **The Queen of Atlantis** — the final challenger; tests Emi in a game of
  four-in-a-row rather than combat.
- **Enemies** — sea obstacles (Stage 1), sharks and mermaids (Stage 2), the
  **Kraken** boss with long tentacles (Stage 2 climax), platform hazards
  (Stage 3).

## Tone & art direction

Playful, cartoonish, and colorful — a family-friendly storybook adventure.
Bright ocean palette, bold outlines, exaggerated motion, and light comedy in the
animation sequences. Each stage uses the perspective that best fits its action
(see [`stages.md`](./stages.md)) with a loose isometric flavor.

## Structure & flow

```
Boot → Main Menu → Intro cutscene
     → Stage 1 (Speedboat Dash) → Transition 1
     → Stage 2 (Deep Dive)      → Transition 2
     → Stage 3 (Atlantis Run + Connect-4)
     → Outro cutscene (family reunion) → Results
```

- **Intro, transitions, and outro** are funny animated cutscene sequences that
  carry the story between stages.
- **Stages must be beaten in order.** Clearing a stage advances the story;
  failing sends the player to a game-over that can retry the current stage or
  quit to the menu.

## Cross-cutting rules

### Platform & UX
- **Single page**, mobile-first, and touch-friendly. The play surface is a
  fixed, non-scrolling, non-zooming portrait canvas.
- Desktop keyboard input is supported as a convenience for testing/play.

### Controls
- **Touch:** drag / tap zones to steer; an action button where a stage needs one
  (e.g. Stage 2 punch, Stage 3 jump).
- **Keyboard:** arrows / WASD to move, space for the action, `P` / `Esc` to pause.

### Pause / resume
- A pause control is available during every stage.
- The game **auto-pauses** when the tab is hidden or backgrounded.
- Pausing freezes the simulation; resuming continues without a time jump.

### Persistence (cookies only)
All results and stats are stored in cookies — no server storage. Tracked:
- highest stage reached, per-stage best time/score,
- Stage 2 oxygen efficiency,
- total attempts, wipeouts/deaths, and the completion flag.

The main menu and results screen surface these stats, and progress survives a
page reload.

## Win & lose conditions (summary)

| Stage | Win | Lose |
|-------|-----|------|
| 1 — Speedboat Dash | Reach the diving site (distance goal) | Crash into an obstacle |
| 2 — Deep Dive | Pass the Kraken and reach the Atlantis dock | Oxygen runs out or fatal hit |
| 3 — Atlantis Run | Clear the platform run, then win Connect-4 vs the Queen | Fall/hit hazard, or lose Connect-4 |

Full details for each stage are in [`stages.md`](./stages.md).
