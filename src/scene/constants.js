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

// Entrance experience — a daytime street, a brutalist black café façade with
// one door, and a neon-ringed tunnel that leads into the café. It is laid out
// along the -x axis, centred on the line z = corridorZ, mapped directly onto
// room.glb's built-in corridor (the `Cube002` stub): that corridor IS the
// tunnel. The player walks +x: street -> façade door -> corridor -> café mouth
// -> café. One continuous space — no teleport. Forward (+x) is yaw -PI/2, so
// the spawn already looks down the street toward the façade.
//
// Both thresholds (street<->tunnel at the façade, tunnel<->café at the mouth)
// are real openings: bounds swap as the door swings, no cut. The 8.6 m dark
// corridor with a door at each end keeps the daytime street out of the night
// café. Audio is silent outside; see entranceAudio.js.
export const ENTRANCE = {
  corridorZ: 4.77, // world-z centre line of the model corridor (Cube002)
  corridorHalf: 0.82, // walkable half-width across the corridor (in z)
  corridorHeight: 2.19, // model corridor interior height
  mouthX: -6.0, // café end of the corridor — the door into the café
  facadeX: -14.6, // street end of the corridor — façade + entry door
  streetBackX: -31, // how far back (-x) the open street extends
  streetHalf: 2.5, // walkable half-width of the street alley (in z) — keeps the
  // player on-axis so the façade always occludes the café building behind it
  facadeHeight: 6.7, // height of the black café building at the street end
  facadeDepth: 1.4, // thickness (x) so it reads as a black building, not a wall
  // The façade must span the café building's full z-footprint (the café behind
  // it is only ~2.4 m tall but reaches z ≈ -6.1..6.1) so it fully occludes it
  // from the street. Door stays at corridorZ, so the building is asymmetric.
  facadeZMin: -7.5,
  facadeZMax: 7.5,
  doorWidth: 1.6,
  doorHeight: 2.0, // must clear the 2.19 m corridor ceiling
  ringRadius: 0.95, // neon hoop radius (fits the ~2.18 m-wide corridor)
  openDist: 3.4, // how close you get before a door swings open
  stepLength: 0.72, // footstep cadence, in meters of travel
  tile: 0.4, // reactive floor tile pitch
  ringSpacing: 1.4, // neon ring spacing along the corridor
  ringLead: 3.2, // the lit frontier runs this far ahead of the player
  spawn: { x: -28, z: 4.77, yaw: -Math.PI / 2 }, // on the street, facing +x toward the café
};
