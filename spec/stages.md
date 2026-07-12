# Stage Specifications

Each stage implements the common stage interface (see
[`architecture.md`](./architecture.md)): `init`, `update`, `render`,
`isComplete`, `didFail`, `getStats`.

---

## Stage 1 — Speedboat Dash  ✅ implemented

**Perspective:** behind / top-down endless-runner. Water scrolls toward the
player; Emi's boat sits near the bottom.

**Goal:** race to the diving site — reach the distance/progress goal without
crashing.

**Gameplay:**
- The player steers the boat horizontally (drag anywhere, or arrows/WASD).
- Sea obstacles (rocks, buoys, barrels) spawn ahead and scroll down.
- **Difficulty ramp:** obstacle speed *and* spawn density increase over time /
  distance, so the course accelerates and gets denser toward the end.
- Collision with any obstacle = wipeout (fail).
- A progress bar shows distance to the diving site; reaching it clears the stage.

**Difficulty multipliers** (base = "Adventurer"; see
[`game-design.md`](./game-design.md)): `speedMul` scales base/max boat speed and
ramp rate, `spawnMul` scales spawn interval (frequency), `densityBonus` shifts
the per-wave obstacle cap (base 3 → Rookie 2, Indiana 4), and `hitScale` tweaks
the collision radius. Concretely: Rookie ≈ slower water and ≤2 obstacles/wave;
Indiana ≈ ~1.2× faster with up to 4/wave and tighter hitboxes.

**HUD:** score/distance, progress bar, pause button.

**Outro animations:** the result is not shown instantly — the sim plays a short
in-canvas sequence first, then flips `status` (which reveals the overlay):
- **Crash (~1.25s):** the boat spins out, sinks, and fades; a radial burst of
  water-droplet particles erupts at the impact point with a screen shake and a
  quick white flash. The "Splash!" overlay then animates in.
- **Finish (~1.5s):** the boat surges forward and rockets off the top of the
  screen trailing golden sparkles/bubbles with a warm flash, then the
  "Diving Site!" overlay animates in.

These are driven by an internal `AnimPhase` ('none' | 'crash' | 'finish') plus a
lightweight particle list, screen-shake, and flash values, all reset on
`reset()`. Overlays use `tw-animate-css` (`animate-in`, `zoom-in`, `fade-in`).

**Stats written:** best score/distance, attempts, wipeouts.

---

## Stage 2 — Deep Dive  🚧 stubbed

**Perspective:** side-scrolling underwater swim.

**Goal:** descend past the sea monsters, defeat/pass the **Kraken**, and reach
the underwater dock of Atlantis.

**Core mechanic — Oxygen as the timer:**
- Emi has an **oxygen meter** that continuously drains; it is the natural time
  limit for the dive. If it empties, the dive fails.
- Emi can **punch** to swat enemies away, but each punch **costs extra oxygen** —
  a risk/reward trade between fighting and conserving air.

**Enemies:**
- **Sharks** and **mermaids** — patrol/chase hazards that can be dodged or
  swatted.
- **Kraken (boss):** long tentacles with individual hitboxes sweeping the lane;
  the player must weave through / swat past. Clearing the Kraken opens the path
  to the Atlantis dock.

**Win:** reach the Atlantis dock. **Lose:** oxygen depleted or a fatal hit.

**Stats:** best clear time, oxygen efficiency (oxygen remaining / punches used),
attempts, deaths.

---

## Stage 3 — Atlantis Run + Connect-4  🚧 stubbed

**Perspective:** classic side-view platformer (Mario-style).

**Part A — Platform run:**
- Run and jump across platforms, over and around obstacles/hazards.
- Gravity + jump physics; static and moving obstacles.
- Reaching the throne room ends the platform section.

**Part B — Connect-4 vs the Queen:**
- A **four-in-a-row** duel against the Queen of Atlantis on a 7×6 board.
- Player drops discs into columns; first to connect four (row, column, or
  diagonal) wins.
- The Queen is driven by a lightweight AI (minimax-style with limited depth /
  heuristic) tuned to be beatable but challenging.

**Win:** beat the Queen at Connect-4 → triggers the outro reunion.
**Lose:** fall/hit a fatal hazard in Part A, or lose the Connect-4 game.

**Stats:** platform clear time, Connect-4 wins/losses, attempts.

---

## Cutscenes

- **Intro:** sets up the story — Emi's parents leave for Atlantis and go missing
  (uses Mom + Dad portraits). ✅ implemented (player-advanced panels + skip).
- **Transition 1:** boat arrives at the diving site. 🚧 stubbed.
- **Transition 2:** Emi reaches the Atlantis dock. 🚧 stubbed.
- **Outro:** happy family reunion, using `happy-ending.png`. 🚧 stubbed.
