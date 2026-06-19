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
import { ENTRANCE } from './scene/constants.js';

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

  const { room, bounds, windowScreen, tunnelMouth } = await createGltfRoom();
  scene.add(room);
  const lights = createLights(bounds);
  scene.add(lights);

  // --- Entrance experience (street -> dark tunnel -> arrival) ---------------
  // Built before the theme is applied so the first selectTheme() also tints
  // the entrance accent and audio. Lives far down +z; the player spawns here
  // and is teleported into the café on arrival.
  const themeAccent = (id) => THEMES[id]?.lighting.lampColors[0] ?? 0x4fd8ff;
  const entrance = createEntrance({ cafeBounds: bounds, tunnelMouth });
  scene.add(entrance.group, entrance.cafePortal);
  const audio = createEntranceAudio();

  // Street video filling the café window, switched with the city theme — look
  // out onto Tokyo or New York. Files are compressed/muted/looping in
  // public/videos; cover-cropped to the window's wide ribbon aspect.
  const videoBase = import.meta.env.BASE_URL || './';
  const THEME_VIDEO = { tokyo: 'videos/tokyo.mp4', newyork: 'videos/newyork.mp4' };
  const windowAspect = windowScreen.geometry.parameters.width / windowScreen.geometry.parameters.height;
  const videoSurface = createVideoSurface([windowScreen], { coverAspect: windowAspect });
  const applyThemeVideo = (id) => videoSurface.setSource(THEME_VIDEO[id] ? videoBase + THEME_VIDEO[id] : null);
  let activeTheme = null;

  // Warm light-bloom overlay that masks the tunnel<->café teleport: it floods
  // as you step through a portal door and fades to reveal the other side, so
  // it reads as "emerging into light" rather than a cut. Driven each frame
  // from sequence.flash (0..1).
  const flash = document.getElementById('flash');

  // --- City theme (one active; rotated monthly, toggle top right) ----------
  const themeManager = createThemeManager({ scene, lights, bounds });
  const themeButtons = document.querySelectorAll('#theme-toggle button');

  function selectTheme(id) {
    themeManager.setTheme(id);
    entrance.setAccent(themeAccent(id));
    audio.setTheme(id);
    applyThemeVideo(id);
    activeTheme = id;
    localStorage.setItem('globe-theme', id);
    themeButtons.forEach((b) => b.classList.toggle('active', b.dataset.theme === id));
  }

  const savedTheme = localStorage.getItem('globe-theme');
  selectTheme(themeManager.has(savedTheme) ? savedTheme : 'tokyo');
  themeButtons.forEach((b) => b.addEventListener('click', () => selectTheme(b.dataset.theme)));

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
    if (activeTheme) applyThemeVideo(activeTheme); // ensure playback after a gesture
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
      if (flash) flash.style.opacity = sequence.flash.toFixed(3);
    }

    renderer.render(scene, camera);
  });
}

init().catch((err) => {
  loadingCard.textContent = 'Failed to load the café — see console.';
  console.error(err);
});
