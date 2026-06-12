# Globe Café — 3D walkable room

Browser-based first-person walk-through of a stylized café interior, built with Three.js and Vite. `project_brief.md` is the authoritative spec — read it before making non-trivial changes.

## Commands

```bash
npm install        # once
npm run dev        # dev server (Vite)
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

No tests and no linter are configured. Verify changes by running the dev server and walking the room.

## Deployment

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml` (build → upload `dist/` → deploy). Vite uses `base: './'` (relative paths) so the build works under any Pages repo path — keep asset references relative or via `new URL(..., import.meta.url)`; never absolute root paths.

## Architecture

Vanilla ES modules, no framework. `src/main.js` wires everything and owns the render loop and overlay/pointer-lock state.

- `src/scene/constants.js` — tunables: placeholder room dimensions, eye height, walk speed, look sensitivities, FOV, bounds margin. Tune feel here, not inline.
- `src/scene/createScene.js` — scene, camera, renderer, resize handling. Pixel ratio clamped to 2.
- `src/scene/createGltfRoom.js` — **the active room**: loads `coffeshop_room.glb`, recenters it (floor center → origin, floor top → y=0) and scales it ×5 to meters, strips the original merged chair meshes, and places `cover_chair.glb` clones at baked per-chair placements. Returns `{ room, bounds, spawn }`. The source GLB has chairs merged into two meshes by material (no per-chair nodes); the placement table in this file was recovered by clustering that geometry offline — if the room model is re-exported, re-derive it.
- `src/scene/createRoom.js` — the original placeholder room (named groups under a `room` root). Currently unused but kept as a dependency-free fallback; returns `{ room, mediaSurfaces }`.
- `src/scene/createLights.js` — hemisphere fill + directional key + two point lights, positioned relative to the walkable `bounds` so it works for any room.
- `src/scene/createVideoSurface.js` — media-surface manager. Gradient CanvasTexture fallback by default; `setSource(url)` swaps in a muted/looping/playsinline VideoTexture and falls back gracefully if autoplay is blocked. The GLTF room has no media mesh reserved yet, so it's wired with an empty mesh list in main.js.
- `src/controls/playerController.js` — first-person camera: yaw/pitch (YXZ euler, pitch clamped), ground-plane movement, position clamped to the walkable rect `{minX,maxX,minZ,maxZ}` passed in. Owns the camera; nothing else moves it.
- `src/themes/` — city theme system (one active; rotated monthly, toggled top right). `themes.js` defines each theme: a `lighting` block applied to the existing lights/background and a `buildDecor()` returning a procedural decor group (canvas-texture signs, neon tubes, lanterns, bulb strings from `decor.js`). `themeManager.js` swaps decor (with full geometry/material/texture disposal) and retunes lights. The core shop — room model, furniture, player — is never touched by themes. Adding a city = one entry in `THEMES` + a button in index.html. Choice persists in localStorage (`globe-theme`).
- `src/controls/keyboardMouseInput.js` — WASD + pointer-lock mouse deltas.
- `src/controls/gamepadInput.js` — standard-mapping gamepad polling, radial dead zones. Left stick move, right stick look.

## Conventions and invariants

- **Input abstraction**: input modules produce normalized intent (move vector with x = strafe right, y = forward; look as delta or rate). The player controller never reads devices directly; new input methods (touch etc.) plug in by producing the same intent.
- Mouse look is an accumulated per-frame pixel delta (`consumeLookDelta`); gamepad look is a rate scaled by dt. Don't mix the two models up.
- Units are meters; player eye height 1.6 m, walk speed ~3 m/s, frame-rate independent via clamped `clock.getDelta()`.
- All meshes and groups are named — keep that up for future selection/animation.
- The walkable rect is the raycast-measured interior `INTERIOR` in createGltfRoom.js (x -7.06..4.79, z -4.8..7.03) — the floor and building shell extend past the interior room (exterior terrace), so mesh bounding boxes give wrong walls. Theme decor mounts on measured wall faces in themes.js (~0.1 m proud of the slatted walls to avoid z-fighting). Re-measure both if the room GLB or its scale changes.
- Headless verification gotcha: the player controller re-applies yaw/pitch and clamps position every frame, so scripted `camera.lookAt()` is overwritten. In dev, set `window.__globe.freecam.enabled = true` first (exposed from main.js along with scene/camera/bounds/THREE).
- The room GLB is a messy Sketchfab/Maya export (~1,100 nodes, 30 merged meshes, identified by `_<material>_0` name suffixes). Don't edit the GLB files; do model surgery at runtime in createGltfRoom.js.
- Keep it dependency-light: three + vite only. No framework, no physics engine (collision is a bounds clamp by design for v1).

## Non-goals (v1)

Jumping/crouching/head bob, physics, mobile touch walk controls, postprocessing, audio, multiplayer. See the brief's roadmap before adding scope.
