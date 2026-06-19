import { ENTRANCE } from './constants.js';

// Reversible place machine for the entrance: street <-> tunnel <-> café.
//
//   street <-> tunnel : a real opening at the façade — bounds swap at the
//                       threshold, no teleport. Entering from the street arms
//                       the audio "hush then swell".
//   tunnel <-> café   : the two are far apart, so a teleport portal bridges
//                       the tunnel's exit door and a matching door in the café.
//
// Owns the single mutable `liveBounds` rect the player clamps to, opens doors
// by proximity, and drives the audio place/intensity. The player walks in -z,
// so the forward (café-ward) limit is liveBounds.minZ.

const { facadeZ, exitZ, streetBackZ, streetHalf, doorwayHalf, openDist } = ENTRANCE;

const STREET = { minX: -streetHalf, maxX: streetHalf, minZ: facadeZ + 0.6, maxZ: streetBackZ - 0.5 };

export function createEntranceSequence({ entrance, audio, camera, player, liveBounds, cafeBounds }) {
  let place = 'street';
  let pendingClose = false; // awaiting the entry door to shut behind us
  Object.assign(liveBounds, STREET);

  // Pose to drop into when stepping from the café back into the tunnel: at the
  // exit end, facing +z up the tunnel toward the street.
  const tunnelReturnPose = { x: 0, z: exitZ + 1.3, yaw: Math.PI };
  const portalX = entrance.cafePortal?._x ?? 0;

  function toStreet() {
    place = 'street';
    pendingClose = false;
    Object.assign(liveBounds, STREET);
    audio.setPlace('street');
  }
  function toTunnelFromStreet() {
    place = 'tunnel';
    pendingClose = true; // hush + clunk fire once the door shuts behind us
    entrance.resetRings();
    audio.setPlace('tunnel');
    audio.hold(); // silent until the door closes
  }
  function toTunnelFromCafe() {
    place = 'tunnel';
    pendingClose = false;
    player.teleport(tunnelReturnPose);
    Object.assign(liveBounds, { minX: -doorwayHalf, maxX: doorwayHalf, minZ: exitZ + 0.6, maxZ: facadeZ - 0.5 });
    audio.setPlace('tunnel');
    audio.armHush(0); // coming from the café, music carries straight over
  }
  function toCafe() {
    place = 'cafe';
    pendingClose = false;
    player.teleport(entrance.arrivalPose);
    Object.assign(liveBounds, cafeBounds);
    audio.setPlace('cafe');
  }

  return {
    get place() {
      return place;
    },
    update(dt) {
      const pos = camera.position;
      const { footstep } = entrance.update(dt, pos, place);

      switch (place) {
        case 'street': {
          const open = pos.z < facadeZ + openDist;
          entrance.doors.entry.open(open);
          const through = entrance.doors.entry.ratio > 0.55 && Math.abs(pos.x) < doorwayHalf + 0.05;
          liveBounds.minX = -streetHalf;
          liveBounds.maxX = streetHalf;
          liveBounds.maxZ = streetBackZ - 0.5;
          liveBounds.minZ = through ? facadeZ - 1.2 : facadeZ + 0.6;
          if (pos.z < facadeZ - 0.4) {
            toTunnelFromStreet();
            liveBounds.minX = -doorwayHalf;
            liveBounds.maxX = doorwayHalf;
          }
          break;
        }
        case 'tunnel': {
          if (footstep) audio.footstep();

          // Entry door (street end): opens when you approach it from inside.
          const entryNear = pos.z > facadeZ - openDist;
          entrance.doors.entry.open(entryNear);
          const entryThrough = entrance.doors.entry.ratio > 0.55 && Math.abs(pos.x) < doorwayHalf + 0.05;

          // The moment it has shut behind you: clunk, then the hush begins.
          if (pendingClose && entrance.doors.entry.ratio < 0.08) {
            audio.doorClose();
            audio.armHush();
            pendingClose = false;
          }

          // Exit door (café end).
          const exitNear = pos.z < exitZ + openDist;
          entrance.doors.exit.open(exitNear);
          const exitThrough = entrance.doors.exit.ratio > 0.55;

          liveBounds.minX = -doorwayHalf;
          liveBounds.maxX = doorwayHalf;
          liveBounds.maxZ = entryThrough ? facadeZ + 1.2 : facadeZ - 0.5;
          liveBounds.minZ = exitThrough ? exitZ - 1.2 : exitZ + 0.6;

          audio.setIntensity((facadeZ - pos.z) / (facadeZ - exitZ));

          if (pos.z > facadeZ + 0.4) toStreet();
          else if (pos.z < exitZ - 0.3) toCafe();
          break;
        }
        case 'cafe': {
          if (footstep) audio.footstep();
          const near = Math.abs(pos.x - portalX) < openDist * 0.7 && cafeBounds.maxZ - pos.z < openDist;
          entrance.doors.cafe.open(near);
          // Walk through the café portal (toward the back wall) -> tunnel.
          if (Math.abs(pos.x - portalX) < doorwayHalf && pos.z > cafeBounds.maxZ - 0.35) {
            toTunnelFromCafe();
          }
          break;
        }
      }
    },
  };
}
