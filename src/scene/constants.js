// Shared spatial constants, in meters. The room root group sits at the
// origin so a future GLTF room can replace it 1:1.
export const ROOM = {
  width: 10, // x axis
  depth: 7, // z axis
  height: 3.2,
};

export const PLAYER = {
  eyeHeight: 1.6,
  walkSpeed: 3.0, // m/s
  // Keep the camera this far away from the walls.
  boundsMargin: 0.45,
  spawn: { x: 0, z: 2.4 },
  // Yaw 0 faces -z, toward the counter at the back wall.
  spawnYaw: 0,
};

export const LOOK = {
  mouseSensitivity: 0.0022, // radians per pixel
  padYawSpeed: 2.6, // radians per second at full stick
  padPitchSpeed: 1.8,
  // Stop just short of straight up/down so the view never flips.
  pitchLimit: Math.PI / 2 - 0.05,
};

export const FOV = 72;
