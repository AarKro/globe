import * as THREE from 'three';
import { PLAYER, LOOK } from '../scene/constants.js';

// First-person walk controller. Owns the camera's position and orientation;
// all input arrives as normalized intent (move vector + look delta/rate), so
// keyboard/mouse and gamepad are interchangeable without a mode switch.
// `bounds` is the walkable rect {minX, maxX, minZ, maxZ}; `spawn` is
// {x, z, yaw} with yaw 0 facing -z.
export function createPlayerController(camera, bounds, spawn) {
  let yaw = spawn.yaw;
  let pitch = 0;

  camera.position.set(spawn.x, PLAYER.eyeHeight, spawn.z);

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function applyOrientation() {
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);
  }
  applyOrientation();

  return {
    // mouseDelta: accumulated pixels this frame.
    // padLook: stick rate in [-1, 1], scaled by time.
    // move: combined intent, x strafe right +, y forward +.
    update(dt, move, mouseDelta, padLook) {
      yaw -= mouseDelta.x * LOOK.mouseSensitivity;
      pitch -= mouseDelta.y * LOOK.mouseSensitivity;
      yaw -= padLook.x * LOOK.padYawSpeed * dt;
      pitch -= padLook.y * LOOK.padPitchSpeed * dt;
      pitch = THREE.MathUtils.clamp(pitch, -LOOK.pitchLimit, LOOK.pitchLimit);
      applyOrientation();

      // Walk on the ground plane relative to facing direction.
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const step = PLAYER.walkSpeed * dt;
      const dx = (move.x * cos - move.y * sin) * step;
      const dz = (-move.x * sin - move.y * cos) * step;

      camera.position.x = THREE.MathUtils.clamp(camera.position.x + dx, bounds.minX, bounds.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + dz, bounds.minZ, bounds.maxZ);
      camera.position.y = PLAYER.eyeHeight;
    },
  };
}
