import * as THREE from 'three';
import { createScene } from './scene/createScene.js';
import { createGltfRoom } from './scene/createGltfRoom.js';
import { createLights } from './scene/createLights.js';
import { createVideoSurface } from './scene/createVideoSurface.js';
import { createPlayerController } from './controls/playerController.js';
import { createKeyboardMouseInput } from './controls/keyboardMouseInput.js';
import { createGamepadInput } from './controls/gamepadInput.js';

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

  const { room, bounds, spawn } = await createGltfRoom();
  scene.add(room);
  scene.add(createLights(bounds));

  // The GLTF room has no dedicated media mesh yet; the video surface module
  // stays wired for when one is reserved (window pane or wall screen).
  const videoSurface = createVideoSurface([]);
  // Drop footage into src/assets/videos and point at it here, e.g.:
  // videoSurface.setSource(new URL('./assets/videos/street.mp4', import.meta.url).href);
  void videoSurface;

  const player = createPlayerController(camera, bounds, spawn);
  const keyboard = createKeyboardMouseInput(canvas);
  const gamepad = createGamepadInput();

  if (import.meta.env.DEV) {
    // Handle for headless smoke tests and console tinkering.
    window.__globe = { scene, camera };
  }

  // --- Overlay / pointer lock ----------------------------------------------
  let started = false;

  function dismissOverlay() {
    started = true;
    overlay.classList.add('hidden');
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

    if (started) {
      player.update(dt, move, mouseDelta, pad.look);
    }

    renderer.render(scene, camera);
  });
}

init().catch((err) => {
  loadingCard.textContent = 'Failed to load the café — see console.';
  console.error(err);
});
