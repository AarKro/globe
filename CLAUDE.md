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

- `src/scene/constants.js` — ALL tunables: room dimensions, eye height, walk speed, look sensitivities, FOV, bounds margin. Tune feel here, not inline.
- `src/scene/createScene.js` — scene, camera, renderer, resize handling. Pixel ratio clamped to 2.
- `src/scene/createRoom.js` — placeholder room geometry in named groups (`shell`, `windows`, `furniture`, `decor`) under one root group named `room`. Returns `{ room, mediaSurfaces }`. The root group is designed to be replaced 1:1 by a GLTF room later — keep the origin/orientation contract stable.
- `src/scene/createLights.js` — hemisphere fill + directional key + two lamp point lights. Lamp positions must match the bulb meshes in createRoom.
- `src/scene/createVideoSurface.js` — manages the window panes (`mediaSurfaces`). Gradient CanvasTexture fallback by default; `setSource(url)` swaps in a muted/looping/playsinline VideoTexture and falls back gracefully if autoplay is blocked.
- `src/controls/playerController.js` — first-person camera: yaw/pitch (YXZ euler, pitch clamped), ground-plane movement, position clamped to room bounds. Owns the camera; nothing else moves it.
- `src/controls/keyboardMouseInput.js` — WASD + pointer-lock mouse deltas.
- `src/controls/gamepadInput.js` — standard-mapping gamepad polling, radial dead zones. Left stick move, right stick look.

## Conventions and invariants

- **Input abstraction**: input modules produce normalized intent (move vector with x = strafe right, y = forward; look as delta or rate). The player controller never reads devices directly; new input methods (touch etc.) plug in by producing the same intent.
- Mouse look is an accumulated per-frame pixel delta (`consumeLookDelta`); gamepad look is a rate scaled by dt. Don't mix the two models up.
- Units are meters; player eye height 1.6 m, walk speed ~3 m/s, frame-rate independent via clamped `clock.getDelta()`.
- All meshes and groups are named — keep that up for future selection/animation.
- Materials are assigned per mesh and meant to be swappable; shared material constants live at the top of createRoom.js.
- Coordinate layout: counter on the back wall (-z), window/video wall on -x, player spawns near +z facing the counter (yaw 0 = facing -z).
- Keep it dependency-light: three + vite only. No framework, no physics engine (collision is a bounds clamp by design for v1).

## Non-goals (v1)

Jumping/crouching/head bob, physics, mobile touch walk controls, postprocessing, audio, multiplayer. See the brief's roadmap before adding scope.
