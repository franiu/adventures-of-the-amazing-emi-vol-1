# Assets & Art Pipeline

## Directory

```
public/game/
  menu-bg.png                 → title / main-menu background
  characters/                 → user-provided character portraits
    emi.png
    dad.png
    mom.png
    happy-ending.png
  stage1/
    sea-bg.png                → scrolling water (full-frame, NOT keyed)
    boat-emi.png              → Emi's speedboat (chroma-keyed)
    obstacle-rock.png         → obstacle (chroma-keyed)
    obstacle-buoy.png         → obstacle (chroma-keyed)
    obstacle-barrel.png       → obstacle (chroma-keyed)
```

All in-game art is produced with the image generator; user-provided portraits
are the exception and are used as delivered.

## Asset registry

`lib/game/assets/manifest.ts` maps short keys → paths (`IMAGES`), groups the
assets each stage needs (e.g. `STAGE1_ASSETS`), and lists which sprites must be
chroma-keyed (`CHROMA_KEY_ASSETS`). `lib/game/assets/loader.ts` preloads a
stage's assets (with progress for the loading screen) and caches them.

## Chroma-key pipeline (critical)

The image generator **cannot output true alpha transparency** — asking for a
"transparent background" bakes an opaque checkerboard pattern into the PNG.
Workaround:

1. **Generate on flat magenta.** Prompt the sprite on a *solid flat uniform
   `#FF00FF` magenta background, no checkerboard/gradient/texture*, and make sure
   magenta does not appear on the subject itself.
2. **Register it.** Add the sprite's key to `CHROMA_KEY_ASSETS` in
   `manifest.ts`.
3. **Key it out at load.** `loader.ts` draws the image to an offscreen canvas and
   sets magenta pixels transparent using a color-distance threshold, with an
   edge band that feathers alpha and lifts green to remove pink fringing. It
   returns a processed `<canvas>` (the renderer draws it like any image).
4. **Measure opaque bounds.** During the same pixel scan, the loader records the
   sprite's opaque bounding box (normalized center + half-extents) and exposes it
   via `getContentBounds(key)`. Gameplay uses this to fit collision circles and
   drawing to the *visible* art rather than the padded frame — sprites can have
   large transparent margins, so this keeps hitboxes matching what players see.

### Sprite orientation

Action sprites are generated already facing their in-game travel direction so no
runtime rotation is needed. The Stage 1 boat travels *up* the screen, so
`boat-emi.png` is drawn from behind with the **bow pointing up** and the wake
baked into the lower part of the frame (the code draws no separate wake). Avoid
baked-in text/numbers in sprites — request "no text, no letters, no numbers".

**Do not** chroma-key full-frame backgrounds (e.g. `sea-bg.png`); they are drawn
edge-to-edge and have no background to remove.

## Character portraits (user-provided)

`public/game/characters/*.png` are selfie/portrait-style illustrations, not game
sprites. Usage:

- **Emi** — menu character card and HUD portrait; also the visual reference for
  any generated in-game Emi sprites (hair, coloring, braces) for continuity.
- **Mom + Dad** — the intro cutscene (parents leaving / going missing).
- **happy-ending.png** — used directly as the hero art for the outro reunion.

Because they are portraits, moving in-game characters (running/diving/jumping
Emi, etc.) are generated separately as sprites and chroma-keyed as above.

## Art direction

Cartoonish, playful, colorful, bold outlines. Ocean-forward palette matching the
theme tokens in `app/globals.css`. Keep sprites centered with padding so keying
and scaling stay clean.
