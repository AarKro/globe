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

// Entrance experience — a daytime Zürich street, a towering brutalist black
// café façade with one door, and a round neon-ringed tunnel that transitions
// you into the café. It lives far down the +z axis so the lit café (which the
// camera still renders) is occluded by the tall façade and shares no light
// with it. The player walks in -z: street -> façade door -> tunnel -> café.
// Yaw 0 faces -z (toward the façade), so the spawn already looks at the door.
//
// It is fully reversible: street <-> tunnel is a real opening at the façade;
// tunnel <-> café is a teleport portal (a matching door inside the café),
// since the two are far apart. Audio is silent outside; see entranceAudio.js.
export const ENTRANCE = {
  tunnelRadius: 1.6, // interior radius of the round tunnel
  tunnelHeight: 3.4, // height of the flat end-cap walls holding the doors
  doorwayHalf: 0.85, // walkable half-width through a doorway and the tunnel
  facadeZ: 42, // the café building's front, with the entry door
  exitZ: 16, // far wall, with the exit door / café-side portal
  streetBackZ: 66, // how far back the open street extends
  wingHalfWidth: 50, // (legacy) former building-row half-extent in x; the sky is now a dome
  streetHalf: 3.5, // walkable half-width of the alley approaching the café
  facadeHeight: 6.7, // a low café building (≈1/3 of its neighbours) at the alley end
  cafeWidth: 7, // façade width of the café building (fills the alley end)
  doorWidth: 1.9,
  doorHeight: 2.35,
  openDist: 3.4, // how close you get before a door swings open
  stepLength: 0.72, // footstep cadence, in meters of travel
  tile: 0.4, // reactive floor tile pitch
  ringSpacing: 1.5, // neon ring spacing along the tunnel
  ringLead: 3.5, // the lit frontier runs this far ahead of the player
  spawn: { x: 0, z: 54, yaw: 0 },
};
