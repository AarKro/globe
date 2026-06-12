# Café 3D Room Project Brief

## Overview
Build a small, implementation-ready prototype of a café interior in 3D using Three.js.

The scene should represent one stylized room that can later evolve into a more detailed café concept. The codebase must remain intentionally small, easy to read, and easy to extend.

## Product goal
Create a browser-based room preview that lets us:
- inspect a simple 3D café interior
- replace placeholder geometry with a GLTF room later
- map video textures onto wall or window surfaces
- iterate on lighting, materials, and layout without changing the overall architecture

## Recommended stack
Use a vanilla front end with a lightweight build setup:

- HTML for the entry point
- CSS for page layout and loading states
- JavaScript with ES modules
- Three.js as the 3D engine
- OrbitControls for camera inspection
- GLTFLoader for future room imports
- VideoTexture for animated wall or window surfaces

Recommended project setup:
- Vite with the vanilla template, or an equivalent minimal dev server
- no framework
- no state management library
- no UI library unless it is required later

This keeps the source code as simple HTML/CSS/JS while still giving us a reliable module-based workflow.

## Core requirements
The first implementation must include:

### Scene
- A Three.js scene with a perspective camera
- WebGL renderer with correct resize handling
- Pixel ratio clamped for performance, for example up to 2
- A room constructed from placeholder geometry
- At least one surface reserved for a future video texture
- Basic lighting that makes the room readable and visually pleasant

### Interaction
- Orbit-style camera controls
- Damping enabled for smoother movement
- Reasonable min and max zoom distance so the camera stays inside the room
- Optional autorotation only if it does not hurt usability

### Layout
- A simple full-page canvas
- Optional overlay for loading or short instructions
- Responsive behavior on desktop and mobile viewport sizes

## Scene specification
The room should be built from simple primitives at first.

### Geometry to include
- floor plane or box
- ceiling plane or box
- four walls
- window openings or wall panels
- a counter or bar element
- tables or seating blocks
- a few décor placeholders such as shelves, lamps, or signs

### Spatial assumptions
- Use meters or meter-like units consistently
- Keep the room proportionate and believable
- Make the origin and camera setup predictable so later GLTF replacement is straightforward
- Position the camera so the full room can be inspected immediately on load

### Materials
- Use simple, readable materials first
- Prefer MeshStandardMaterial or MeshPhysicalMaterial for future lighting realism
- Keep material assignment modular so it is easy to replace per mesh later
- Reserve at least one mesh for a video-driven material

## Lighting spec
Use lighting that is simple but believable.

Minimum lighting setup:
- one ambient or hemisphere light for fill
- one directional light or spot light for key illumination
- optional area-like fill through additional soft lights or emissive elements

If possible, make the lighting feel like a warm café interior rather than a neutral test scene.

## Video surface spec
We want the scene to support animated wall or window surfaces.

Implementation requirements:
- create one dedicated mesh or material slot for a video texture
- use HTML video elements as the source for the texture
- set the texture to update continuously while the video plays
- ensure the video is muted and plays inline where browser policies require it
- design the API so the video source can be swapped without rewriting the room setup

Preferred usage:
- window panes with animated exterior footage
- wall-mounted screens
- backlit glass panels

If browser autoplay restrictions block playback, the app should fail gracefully and keep the rest of the room visible.

## Asset strategy
Start with placeholders only.

Current assets:
- generated geometry only
- no external model dependency required for the first version

Future assets:
- a GLTF room model
- image textures for walls, wood, concrete, or signage
- video files for window and wall surfaces

Asset directories should be prepared now even if they are empty.

## Suggested file structure
- index.html
- src/
  - main.js
  - style.css
  - scene/
    - createScene.js
    - createRoom.js
    - createLights.js
    - createVideoSurface.js
  - assets/
    - models/
    - textures/
    - videos/

If the project is kept flatter than this, the code should still follow the same separation of concerns:
- scene setup
- room construction
- lighting
- controls
- video texture handling

## Implementation notes for the agent
When creating the project, follow these rules:

1. Keep the app dependency-light and framework-free.
2. Use Three.js modules instead of a bundled demo scaffold.
3. Build the room from placeholder geometry first.
4. Keep the scene graph organized with named groups for floor, walls, furniture, and media surfaces.
5. Make the camera and controls easy to tune.
6. Isolate video texture logic so a future GLTF room can reuse it.
7. Keep the code readable, with small functions and explicit naming.
8. Add comments only where they clarify non-obvious 3D or video details.

## Technical implementation guidance
The implementation should ideally include:

- `THREE.Scene()` with a neutral background color or subtle environment tone
- `THREE.PerspectiveCamera()` placed outside the room and aimed toward the center
- `THREE.WebGLRenderer({ antialias: true, alpha: false })`
- resize handling tied to `window.innerWidth` and `window.innerHeight`
- `OrbitControls` with damping
- a room root `Group` that can later be replaced with a GLTF root node
- named meshes for easier future selection and animation
- optional helper constants for room width, depth, and height

Video-specific details:
- create the video element in JavaScript or reference it from the DOM
- set `crossOrigin` only if the source requires it
- call `texture.needsUpdate = true` while the video plays
- use `LinearFilter` or equivalent safe defaults if needed for performance
- set wrapping and aspect ratio intentionally so the video does not distort unexpectedly

## Non-goals for the first version
Do not add these yet unless they are required to make the prototype work:
- physics simulation
- character controls
- complex postprocessing pipeline
- lighting bake workflow
- material editor UI
- full scene graph editor
- advanced animation system

## Future roadmap
After the first version, the project can expand into:
- importing a real café room with GLTFLoader
- replacing placeholders with authored furniture and props
- adding multiple video windows or digital signs
- improving light response with better materials and environment maps
- adding interactive hotspots or camera bookmarks
- adding ambience with audio, reflections, and subtle postprocessing

## Definition of done
The project is ready when all of the following are true:

- the page loads in the browser without manual setup beyond the documented dev command
- the user sees a stylized café room in 3D
- the room is made from placeholder geometry, not a final model
- the camera can orbit and zoom within sensible limits
- at least one surface is prepared for or already using a video texture
- the scene structure is clean enough that a GLTF room can replace the placeholder room later
- the project remains simple enough for another agent or developer to extend quickly

## Implementation checklist
- [ ] set up the minimal build and dev workflow
- [ ] create the HTML entry point and full-page canvas layout
- [ ] build the Three.js scene and renderer
- [ ] add orbit controls and resize handling
- [ ] create the room from placeholder geometry
- [ ] add warm, readable lighting
- [ ] reserve or implement a video-textured wall or window surface
- [ ] organize code so GLTF support can be added later
- [ ] verify the prototype runs cleanly in the browser
