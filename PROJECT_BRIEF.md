# Globe Café — 3D Walkable Room — Project Brief

## Overview
Build a small, implementation-ready prototype of the Globe Café interior in 3D using Three.js.

The scene represents one stylized café room that the user can **walk through in first person**. It will later evolve into a more detailed café concept with authored assets. The codebase must remain intentionally small, easy to read, and easy to extend.

---

## 1. Business intent

### Why this exists
- Create a browser-based, explorable 3D version of the Globe Café concept — a digital space that communicates the café's atmosphere before (and beyond) any physical or photographic representation.
- Validate the *feel* of the space — proportions, lighting, warmth, ambience — cheaply, using placeholder geometry, before investing in authored 3D assets (GLTF room, furniture, signage).
- Serve as the foundation for future experience layers: animated window views, wall screens, ambient audio, interactive hotspots, and possibly menu or event content embedded in the scene.

### Success criteria (business level)
- A visitor opens a URL and is "inside" the café within seconds, no install, no instructions beyond a short overlay.
- The prototype is convincing enough to decide what to invest in next (real model, video footage, branding pass).
- The codebase stays small enough that one developer or agent can extend it in a single session.

### Constraints
- Dependency-light, framework-free, static-hostable. No backend.
- Iteration speed beats visual fidelity for this phase.

---

## 2. User context

### Who uses it
- **Visitors / stakeholders**: open the link in a desktop browser, walk around for 1–3 minutes, form an impression of the space. No 3D or gaming expertise assumed.
- **The project owner / designers**: iterate on layout, lighting, and materials between sessions; need predictable structure and tunable constants.
- **Future developers / agents**: must be able to replace placeholders (geometry → GLTF, image → video) without rearchitecting.

### Usage assumptions
- Primary: desktop browser with keyboard + mouse.
- Secondary: desktop browser with an Xbox-style gamepad connected (standard Gamepad API mapping).
- Mobile: the page must load and render responsively, but full walk controls on touch are **not** required for v1 (a graceful fallback such as a fixed or orbiting view is acceptable).
- Sessions are short; the scene must be readable and pleasant immediately on load.

### Accessibility / comfort
- Show a brief controls hint on load (keyboard/mouse and gamepad).
- Mouse look only activates via Pointer Lock after a deliberate click, with an obvious way out (Esc).
- Movement speed and look sensitivity defined as named constants so they are easy to tune; avoid nausea-inducing defaults (no head bob in v1, moderate FOV ~70–75°).

---

## 3. Information architecture

### Page structure
A single full-page canvas application:
- **Canvas layer**: the 3D scene fills the viewport.
- **Overlay layer (HTML/CSS)**:
  - loading state while the scene initializes
  - a start/instructions card: "Click to walk around — WASD + mouse, or use a controller"
  - a minimal persistent hint (e.g. "Esc to release mouse"), nothing else competing with the scene
- No navigation, no routes, no menus in v1. The scene *is* the content.

### Scene content structure (what the user finds in the space)
The room reads as a believable café with distinct zones, organized as named groups in the scene graph:
- **Entry zone** — where the camera starts, with a clear view across the room
- **Counter / bar** — the focal anchor of the room
- **Seating area** — tables and seating blocks
- **Window wall** — window panes reserved for animated (video) exterior views
- **Décor layer** — shelves, lamps, signs; placeholder volumes for future props

### Spatial assumptions
- Meters (or meter-like units) used consistently.
- Origin and orientation predictable so a future GLTF room can replace the placeholder root group 1:1.
- Player spawn position and facing direction defined as constants near the room dimensions.

---

## 4. System architecture

### Stack
- HTML entry point, CSS for layout/overlay, JavaScript with ES modules
- **Three.js** as the 3D engine
- **GLTFLoader** prepared for future room imports
- **VideoTexture** for animated wall/window surfaces
- **Pointer Lock** (e.g. `PointerLockControls` or equivalent) for first-person mouse look
- **Gamepad API** for Xbox controller support
- **Vite** (vanilla template) or an equivalent minimal dev server
- No framework, no state management library, no UI library

### Runtime architecture
- `THREE.Scene` with a warm, subtle background tone
- `THREE.PerspectiveCamera` at standing eye height (~1.6 m), FOV ~70–75°
- `THREE.WebGLRenderer({ antialias: true })`, pixel ratio clamped (e.g. max 2)
- Resize handling tied to `window.innerWidth/innerHeight`
- A single render loop that each frame: polls input (keyboard state + gamepad state), updates the player controller with delta time, updates video textures, renders
- A room root `Group` that can later be swapped for a GLTF root node; named meshes/groups for floor, walls, furniture, media surfaces

### Input abstraction
Keyboard/mouse and gamepad must feed the **same** player controller through a small input layer:
- the controller consumes a normalized intent: a 2D move vector and a 2D look vector
- keyboard/mouse and gamepad each produce that intent; neither is special-cased inside movement code
- this keeps future inputs (touch, on-screen joystick) cheap to add

### Repository hygiene
- A rudimentary **`.gitignore` is required** from the first commit, covering at minimum: `node_modules/`, `dist/`, `.DS_Store`, editor/IDE folders, and local env files (`.env*`).

### Suggested file structure
- `index.html`
- `.gitignore`
- `src/`
  - `main.js`
  - `style.css`
  - `scene/`
    - `createScene.js`
    - `createRoom.js`
    - `createLights.js`
    - `createVideoSurface.js`
  - `controls/`
    - `playerController.js` — movement, look, collision/bounds
    - `keyboardMouseInput.js` — WASD + pointer-lock mouse
    - `gamepadInput.js` — Gamepad API polling, dead zones
  - `assets/`
    - `models/`
    - `textures/`
    - `videos/`

If kept flatter, preserve the same separation of concerns: scene setup, room construction, lighting, player controls, input, video texture handling.

---

## 5. Style and brand

- The space should feel like a **warm, inviting café interior**, not a neutral tech demo — stylized and cozy rather than photoreal.
- Palette: warm woods, cream/plaster walls, amber light; avoid sterile grays.
- Lighting (minimum):
  - one ambient or hemisphere light for fill
  - one directional or spot light for key illumination
  - optional soft fills or emissive elements (lamps, backlit panels) to add warmth
- Materials: `MeshStandardMaterial` / `MeshPhysicalMaterial`, assigned modularly per mesh so they're easy to replace; simple and readable first.
- Animated surfaces are part of the brand language: window panes with exterior footage, wall-mounted screens, backlit glass panels — the room should feel alive, not static.
- Overlay UI: minimal, unobtrusive, typography-led; it frames the scene rather than competing with it. (A proper brand/typography pass is future work; v1 just needs to be clean.)

---

## 6. Functional modules

### 6.1 Scene bootstrap
- Scene, camera, renderer, resize handling, render loop with delta time.
- Pixel ratio clamped for performance.

### 6.2 Room builder
- Room constructed from placeholder primitives: floor, ceiling, four walls, window openings/panels, counter/bar, tables/seating blocks, décor placeholders.
- Organized in named groups (`floor`, `walls`, `furniture`, `media`), under one replaceable root group.
- Helper constants for room width, depth, height.

### 6.3 Lighting
- Warm café lighting per the style spec; tunable in one module.

### 6.4 Player controller (first-person walk-through) — core requirement
The user must be able to **walk through the scene** in first person.

Keyboard + mouse:
- `W/A/S/D` to move (forward/left/back/right relative to facing direction)
- Mouse to look, via Pointer Lock (click to engage, Esc to release)
- Movement on the ground plane only; vertical look clamped (no flipping past straight up/down)

Xbox controller (standard Gamepad API mapping):
- **Left stick** moves the player
- **Right stick** looks around
- Radial dead zones on both sticks; analog magnitude maps to movement speed
- Hot-plug friendly: detect connect/disconnect via `gamepadconnected` events and poll `navigator.getGamepads()` each frame
- Keyboard/mouse and gamepad work interchangeably without a mode switch

Movement feel:
- Walking speed roughly 2–4 m/s, frame-rate independent (delta time)
- Simple collision: keep the player inside the room (bounds clamp is acceptable for v1; per-furniture collision is optional)
- Eye height constant (~1.6 m); no jumping, no physics engine

Optional: keep an orbit/inspect camera as a debug mode behind a key toggle, but first-person walk is the default experience.

### 6.5 Input layer
- `keyboardMouseInput` and `gamepadInput` modules, each producing the normalized move/look intent consumed by the player controller (see System architecture).

### 6.6 Video surface
- At least one dedicated mesh/material slot for a video texture (window pane or wall screen preferred).
- HTML `<video>` element as source: muted, `playsinline`, looping; texture updates continuously while playing.
- API designed so the video source can be swapped without rewriting room setup.
- If autoplay is blocked, fail gracefully (static fallback material) and keep the rest of the room working.
- `crossOrigin` only if the source requires it; `LinearFilter`-style safe defaults; intentional wrapping/aspect so footage doesn't distort.

### 6.7 UI overlay
- Loading state, start/instructions card with controls hints (keyboard and gamepad), pointer-lock engage/release handling.

### 6.8 Asset loaders (prepared, not required for v1)
- GLTFLoader wired or trivially wireable; `assets/models`, `assets/textures`, `assets/videos` directories exist even if empty.

---

## Asset strategy
- **v1**: generated placeholder geometry only; no external model dependency.
- **Future**: a GLTF café room, image textures (wood, plaster, signage), video files for windows/screens.

---

## Implementation notes for the agent
1. Keep the app dependency-light and framework-free.
2. Use Three.js modules, not a bundled demo scaffold.
3. Build the room from placeholder geometry first.
4. Keep the scene graph organized with named groups; one replaceable room root.
5. Route all movement through the player controller; never read input devices inside movement code.
6. Make speeds, sensitivities, dead zones, eye height, and room dimensions named constants.
7. Isolate video texture logic so a future GLTF room can reuse it.
8. Keep code readable: small functions, explicit naming; comments only where 3D, input, or video behavior is non-obvious.
9. Add the `.gitignore` before the first commit.

---

## Non-goals for v1
- physics simulation (a bounds clamp is not physics)
- jumping, crouching, head bob
- touch/mobile walk controls (graceful static/orbit fallback only)
- complex postprocessing pipeline
- lighting bake workflow
- material editor or scene graph editor UI
- advanced animation system
- multiplayer/avatars, audio (future ambience work)

---

## Future roadmap
- Import a real café room with GLTFLoader; replace placeholders with authored furniture and props.
- Multiple video windows and digital signs.
- Better materials, environment maps, subtle postprocessing.
- Interactive hotspots (menu, events) and camera bookmarks.
- Ambient audio and reflections.
- Touch controls for mobile walk-through.
- Brand/typography pass on the overlay UI.

---

## Definition of done
- The page loads in the browser with no setup beyond the documented dev command.
- The user sees a stylized, warmly lit café room built from placeholder geometry.
- The user can walk through the room in first person with WASD + mouse (pointer lock), staying inside the room bounds.
- An Xbox controller works interchangeably: left stick moves, right stick looks, with sensible dead zones.
- At least one surface is prepared for or already using a video texture, with graceful autoplay fallback.
- A `.gitignore` exists covering node_modules, build output, and OS/editor junk.
- The scene structure is clean enough that a GLTF room can replace the placeholder room later.
- The project remains simple enough for another agent or developer to extend quickly.

## Implementation checklist
- [ ] set up the minimal build and dev workflow (Vite vanilla or equivalent)
- [ ] add a rudimentary `.gitignore`
- [ ] create the HTML entry point, full-page canvas, and overlay layer
- [ ] build the Three.js scene, renderer, resize handling, and delta-time loop
- [ ] create the room from placeholder geometry in named groups
- [ ] add warm, readable café lighting
- [ ] implement the player controller (first-person, eye height, bounds clamp)
- [ ] implement keyboard/mouse input with pointer lock
- [ ] implement gamepad input (left stick move, right stick look, dead zones, hot-plug)
- [ ] reserve or implement a video-textured window or wall surface with fallback
- [ ] add the start/instructions overlay with controls hints
- [ ] organize code so GLTF support can be added later
- [ ] verify the prototype runs cleanly in the browser with both input methods
