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
- `src/scene/createGltfRoom.js` — **the active room**: loads `empty_coffeeroom.glb` (the same café export as the unused `coffeshop_room.glb`, with all seating/tables and the ceiling already removed), recenters it (floor center → origin, floor top → y=0), scales it ×5 to meters inside a `shell` wrapper group, and places `wooden_table_set.glb` clones (table + 4 stools + glowing lamp, normalized to a 2.2 m footprint) at `TABLE_SET_PLACEMENTS`. Furniture lives in a sibling `furniture` group in plain world meters — only the shell carries the ×5 model scale. Returns `{ room, bounds, spawn }`. The mesh-strip mechanism (`STRIP_MESH_NAMES`) is kept but empty. `cover_chair.glb` and `coffeshop_room.glb` are unused leftovers (excluded from the build).
  Note: the table set's wood texture is genuinely pale ash — cream-colored furniture is the asset's real look, not a texture failure.
- `src/scene/createRoom.js` — the original placeholder room (named groups under a `room` root). Currently unused but kept as a dependency-free fallback; returns `{ room, mediaSurfaces }`.
- `src/scene/createLights.js` — hemisphere fill + directional key + two point lights, positioned relative to the walkable `bounds` so it works for any room.
- `src/scene/createVideoSurface.js` — media-surface manager. Gradient CanvasTexture fallback by default; `setSource(url)` swaps in a muted/looping/playsinline VideoTexture and falls back gracefully if autoplay is blocked. The GLTF room has no media mesh reserved yet, so it's wired with an empty mesh list in main.js.
- `src/controls/playerController.js` — first-person camera: yaw/pitch (YXZ euler, pitch clamped), ground-plane movement, position clamped to the walkable rect `{minX,maxX,minZ,maxZ}` passed in. Owns the camera; nothing else moves it.
- `src/themes/` — city theme system (one active; rotated monthly, toggled top right). `themes.js` defines each theme: a `lighting` block applied to the existing lights/background and a `buildDecor()` returning a procedural decor group (canvas-texture signs, neon tubes, lanterns, bulb strings from `decor.js`). `themeManager.js` swaps decor (with full geometry/material/texture disposal) and retunes lights. The core shop — room model, furniture, player — is never touched by themes. Adding a city = one entry in `THEMES` + a button in index.html. Choice persists in localStorage (`globe-theme`).
- `src/controls/keyboardMouseInput.js` — WASD + pointer-lock mouse deltas.
- `src/controls/gamepadInput.js` — standard-mapping gamepad polling, radial dead zones. Left stick move, right stick look.
- **Entrance experience** — the player *spawns in a daytime Zürich alley*, not in the café. A normal-sized clean-brutalist BLACK café building (one door) fills the alley end, with a round neon-ring tunnel behind it. It lives far down the +z axis (`ENTRANCE` in constants.js). The café is occluded from the street not by the café itself but by the **continuous Zürich streetfront row** across the alley end plus a high sky cap that stops short of the café (`skyTopMinZ`), so the daytime sky never bleeds into the night café. The walkable approach is a narrow alley (`streetHalf`) so the café building covers its whole end with no side gaps. **Everything in the entrance is unlit** (`MeshBasic`/emissive) so the global café lights can't touch it. It is **fully reversible**: street↔tunnel is a real opening at the façade (bounds swap, no teleport); tunnel↔café is a **teleport portal** (the tunnel's exit door ↔ a matching black door inside the café) because the two are far apart.
  - `src/scene/createEntrance.js` — geometry: daytime sky (street-side open box, capped by the façade), cobbled ground, Zürich Altstadt townhouses (procedural, windowed, gabled) + a distant twin-tower Grossmünster nod, the tall façade slab with its door, the **round tunnel** (dark cylinder shell), the **white neon ring skeleton** whose lit frontier runs `ringLead` ahead of the player and advances as they walk (`resetRings()` replays it on each street entry), the **reactive floor** (`InstancedMesh`; `build` trail + footstep `pulse`), the café "bloom" plane behind the exit door (a **live render-to-texture window** — main.js renders the real café from a camera at the café entrance into `bloom.material.map` each frame while you approach the exit, so the opening door reveals the actual café; crossing teleports you to that exact viewpoint, making the reveal seamless), and the café-side portal door. Returns `{ group, cafePortal, bloom, doors:{entry,exit,cafe}, arrivalPose, setAccent, resetRings, update, dispose }`. Door seams/frames carry the theme accent (a single crisp line — brutalist); the rings are white.
  - `src/scene/entranceSequence.js` — the reversible place machine (`street`/`tunnel`/`cafe`). Owns the single mutable `liveBounds` rect, opens doors by proximity (from either side), and on each portal crossing teleports + swaps bounds + sets the audio place. Entering the tunnel **from the street** arms the audio hush and resets the rings; entering **from the café** does neither. Pure logic (imports only constants) — verifiable in Node.
  - `src/audio/entranceAudio.js` — asset-free procedural music, gated by place: **silent on the street**; on entering the tunnel from the street it stays silent (`hold()`) until the entry door shuts behind you, at which point a procedural **door-close clunk** (`doorClose()`) plays and the timed hush begins (`armHush()`), then a pad + pentatonic arpeggio fade in and **swell louder toward the café** (and back down returning); **steady in the café**. `update(dt)` (called every frame) drives the swell, silence timer, and note scheduler. AudioContext is created lazily in `resume()` from a user gesture (any overlay-dismiss path); missing/blocked Web Audio is a silent no-op. Footsteps are diegetic (silent outside / during the hush). Sound on/off via the bottom-right toggle.

## Conventions and invariants

- **Input abstraction**: input modules produce normalized intent (move vector with x = strafe right, y = forward; look as delta or rate). The player controller never reads devices directly; new input methods (touch etc.) plug in by producing the same intent.
- Mouse look is an accumulated per-frame pixel delta (`consumeLookDelta`); gamepad look is a rate scaled by dt. Don't mix the two models up.
- Units are meters; player eye height 1.6 m, walk speed ~3 m/s, frame-rate independent via clamped `clock.getDelta()`.
- All meshes and groups are named — keep that up for future selection/animation.
- The walkable rect is the raycast-measured interior `INTERIOR` in createGltfRoom.js (x -7.19..4.79, z -6.0..6.0) — the floor and building shell extend past the interior room (exterior pavement), so mesh bounding boxes give wrong walls. The empty room has no ceiling mesh (the scene background shows above the walls, which read as a dark ceiling) and its back wall is glass left of the counter. Theme decor mounts on measured wall faces in themes.js (~0.1 m proud of the walls to avoid z-fighting). Re-measure both if the room GLB or its scale changes.
- Headless verification gotcha: the player controller re-applies yaw/pitch and clamps position every frame, so scripted `camera.lookAt()` is overwritten. In dev, set `window.__globe.freecam.enabled = true` first (exposed from main.js along with `scene/camera/bounds/liveBounds/entrance/sequence/THREE`). `bounds` is the fixed café rect; `liveBounds` is the mutable rect the player actually clamps to while the entrance sequence runs.
- The room GLB is a messy Sketchfab/Maya export (~1,100 nodes, 30 merged meshes, identified by `_<material>_0` name suffixes). Don't edit the GLB files; do model surgery at runtime in createGltfRoom.js.
- Keep it dependency-light: three + vite only. No framework, no physics engine (collision is a bounds clamp by design for v1).

## Non-goals (v1)

Jumping/crouching/head bob, physics, mobile touch walk controls, postprocessing, multiplayer. (Audio is now present — procedural ambience for the entrance; see `src/audio/entranceAudio.js`.) See the brief's roadmap before adding scope.
