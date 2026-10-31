# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris on HTML5 Canvas. No dependencies, no `package.json`, no build, no linter, no test suite. UI text and README are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve the folder statically (recommended):

```bash
python3 -m http.server 8000   # then http://localhost:8000
npx serve .
```

Verification is manual: play the game in a browser.

## Architecture

Three files: `index.html` (DOM + two canvases + overlay), `style.css` (dark theme), `game.js` (all logic, global script, `'use strict'`, no modules).

Key invariants in `game.js`:

- **Cell value = piece type = color index.** `PIECES[type]` matrices store `type` (1–7) in filled cells; `merge()` copies those values into `board`; `drawBlock` looks them up in `COLORS[index]`. Adding/reordering pieces requires keeping `PIECES`, `COLORS`, and `randomPiece()`'s `* 7` in sync.
- **Global mutable state** (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …) is declared once at top and reset in `init()`. Restart button calls `init()`.
- **Piece lifecycle:** `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and calls `endGame()` if the new piece collides immediately. Gravity (`loop`), soft drop, and hard drop all funnel into `lockPiece()`.
- **Rotation:** `rotateCW` (transpose + reverse), `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]`. Not SRS.
- **Loop:** `requestAnimationFrame` with `dropAccum` vs `dropInterval`. Level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)`, recomputed only inside `clearLines()`.
- **HUD** is updated via `updateHUD()`; call it after any score/lines/level change.
- Board size: changing `COLS`, `ROWS`, or `BLOCK` requires updating `<canvas id="board">` `width`/`height` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). The next-piece preview assumes a 4×4 grid of 30px in a 120×120 canvas.

## Known quirks (current code)

- Unpausing (`togglePause`) does not hide the overlay.
- `endGame()` cancels the RAF, but `loop()` re-requests a frame right after `lockPiece()` returns, so the loop keeps running after game over.
