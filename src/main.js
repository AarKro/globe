import * as THREE from 'three';
import { createScene } from './scene/createScene.js';
import { createGltfRoom } from './scene/createGltfRoom.js';
import { createLights } from './scene/createLights.js';
import { createVideoSurface } from './scene/createVideoSurface.js';
import { createPlayerController } from './controls/playerController.js';
import { createKeyboardMouseInput } from './controls/keyboardMouseInput.js';
import { createGamepadInput } from './controls/gamepadInput.js';
import { createThemeManager } from './themes/themeManager.js';
import { createEntrance } from './scene/createEntrance.js';
import { createEntranceAudio } from './audio/entranceAudio.js';
import { createEntranceSequence } from './scene/entranceSequence.js';
import { THEMES } from './themes/themes.js';
import { ENTRANCE, PLAYER, FOV } from './scene/constants.js';

const canvas = document.getElementById('app');
const overlay = document.getElementById('overlay');
const loadingCard = document.getElementById('loading');
const startCard = document.getElementById('start');
const enterButton = document.getElementById('enter');
const hint = document.getElementById('hint');

// async because the room is a GLTF load (top-level await would raise
// Vite's default build target).
async function init() {
  const { scene, camera, renderer } = createScene(canvas);

  const { room, bounds } = await createGltfRoom();
  scene.add(room);
  const lights = createLights(bounds);
  scene.add(lights);

  // --- Entrance experience (street -> dark tunnel -> arrival) ---------------
  // Built before the theme is applied so the first selectTheme() also tints
  // the entrance accent and audio. Lives far down +z; the player spawns here
  // and is teleported into the café on arrival.
  const themeAccent = (id) => THEMES[id]?.lighting.lampColors[0] ?? 0x4fd8ff;
  const entrance = createEntrance({ cafeBounds: bounds });
  scene.add(entrance.group, entrance.cafePortal);
  const audio = createEntranceAudio();

  // --- Live café view through the exit door --------------------------------
  // The tunnel and café are far apart (a teleport bridges them), so the warm
  // "bloom" behind the exit door is a render-to-texture window: a camera at
  // the café entrance renders the real café into the door each frame as it
  // opens. Crossing teleports the player to this exact viewpoint, so the
  // reveal is seamless. Only rendered while near the exit (it's a 2nd pass).
  const portalRT = new THREE.WebGLRenderTarget(512, 640);
  portalRT.texture.colorSpace = THREE.SRGBColorSpace;
  // Flip horizontally so it reads as a true window (not a mirror).
  portalRT.texture.wrapS = THREE.RepeatWrapping;
  portalRT.texture.repeat.x = -1;
  portalRT.texture.offset.x = 1;
  const portalCam = new THREE.PerspectiveCamera(FOV, 512 / 640, 0.05, 50);
  const portalX = entrance.cafePortal?._x ?? 0;
  portalCam.position.set(portalX, PLAYER.eyeHeight, bounds.maxZ - 0.35);
  portalCam.lookAt(portalX, PLAYER.eyeHeight, bounds.maxZ - 4);
  entrance.bloom.material.map = portalRT.texture;
  entrance.bloom.material.color.set(0xffffff);
  entrance.bloom.material.needsUpdate = true; // adding a map recompiles the shader

  function renderPortal() {
    entrance.group.visible = false;
    entrance.cafePortal.visible = false;
    renderer.setRenderTarget(portalRT);
    renderer.render(scene, portalCam);
    renderer.setRenderTarget(null);
    entrance.group.visible = true;
    entrance.cafePortal.visible = true;
  }

  // --- City theme (one active; rotated monthly, toggle top right) ----------
  const themeManager = createThemeManager({ scene, lights, bounds });
  const themeButtons = document.querySelectorAll('#theme-toggle button');

  function selectTheme(id) {
    themeManager.setTheme(id);
    entrance.setAccent(themeAccent(id));
    audio.setTheme(id);
    localStorage.setItem('globe-theme', id);
    themeButtons.forEach((b) => b.classList.toggle('active', b.dataset.theme === id));
  }

  const savedTheme = localStorage.getItem('globe-theme');
  selectTheme(themeManager.has(savedTheme) ? savedTheme : 'tokyo');
  themeButtons.forEach((b) => b.addEventListener('click', () => selectTheme(b.dataset.theme)));

  // The GLTF room has no dedicated media mesh yet; the video surface module
  // stays wired for when one is reserved (window pane or wall screen).
  const videoSurface = createVideoSurface([]);
  // Drop footage into src/assets/videos and point at it here, e.g.:
  // videoSurface.setSource(new URL('./assets/videos/street.mp4', import.meta.url).href);
  void videoSurface;

  // The player clamps to a single mutable rect; the entrance sequence evolves
  // it (street -> tunnel -> café) and swaps in the café bounds on arrival.
  const liveBounds = { minX: -6, maxX: 6, minZ: 0, maxZ: 0 };
  const player = createPlayerController(camera, liveBounds, ENTRANCE.spawn);
  const keyboard = createKeyboardMouseInput(canvas);
  const gamepad = createGamepadInput();

  const sequence = createEntranceSequence({
    entrance,
    audio,
    camera,
    player,
    liveBounds,
    cafeBounds: bounds,
  });

  if (import.meta.env.DEV) {
    // Handle for headless smoke tests and console tinkering.
    // freecam.enabled pauses the player controller so scripted cameras
    // (smoke tests) can position the camera without being overwritten.
    window.__globe = { scene, camera, bounds, liveBounds, entrance, sequence, audio, THREE, freecam: { enabled: false } };
  }

  // --- Overlay / pointer lock ----------------------------------------------
  let started = false;

  function dismissOverlay() {
    started = true;
    overlay.classList.add('hidden');
    audio.resume(); // any start path (click, gamepad, pointer lock) unlocks audio
  }

  // Pointer lock can be unavailable (headless browsers, some iframes);
  // keyboard strafing and gamepad look still work without it.
  function tryPointerLock() {
    try {
      const result = canvas.requestPointerLock();
      if (result?.catch) result.catch(() => {});
    } catch {
      /* fall through — see above */
    }
  }

  enterButton.addEventListener('click', () => {
    tryPointerLock();
    dismissOverlay();
  });

  // Sound on/off (audio starts on; surprise audio is rude).
  const soundButton = document.getElementById('sound-toggle');
  if (soundButton) {
    soundButton.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      soundButton.classList.toggle('muted', audio.muted);
      soundButton.textContent = audio.muted ? 'Sound off' : 'Sound on';
    });
  }

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    hint.classList.toggle('hidden', !locked);
    if (locked) dismissOverlay();
  });

  // Once started, clicking the scene re-engages mouse look after Esc.
  canvas.addEventListener('click', () => {
    if (started && document.pointerLockElement !== canvas) {
      tryPointerLock();
    }
  });

  loadingCard.classList.add('hidden');
  startCard.classList.remove('hidden');

  // --- Render loop -----------------------------------------------------------
  const clock = new THREE.Clock();

  function clamp1(v) {
    return Math.max(-1, Math.min(1, v));
  }

  renderer.setAnimationLoop(() => {
    // Clamp delta so a backgrounded tab doesn't teleport the player.
    const dt = Math.min(clock.getDelta(), 0.1);

    const pad = gamepad.getState();
    if (!started && pad.anyInput) dismissOverlay();

    const kbMove = keyboard.getMove();
    const move = {
      x: clamp1(kbMove.x + pad.move.x),
      y: clamp1(kbMove.y + pad.move.y),
    };
    const mouseDelta = keyboard.consumeLookDelta();

    const freecam = import.meta.env.DEV && window.__globe?.freecam.enabled;
    if (started && !freecam) {
      player.update(dt, move, mouseDelta, pad.look);
      sequence.update(dt);
      audio.update(dt);
    }

    // Refresh the café-through-the-door view only while approaching the exit.
    if (started && sequence.place === 'tunnel' && camera.position.z < ENTRANCE.exitZ + 9) {
      renderPortal();
    }

    renderer.render(scene, camera);
  });
}

init().catch((err) => {
  loadingCard.textContent = 'Failed to load the café — see console.';
  console.error(err);
});
