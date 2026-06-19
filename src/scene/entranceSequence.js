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
  let flash = 0; // 0..1 warm-bloom overlay that masks the teleport cut
  let cafeArmed = false; // arms café->tunnel only after you step away from the portal
  Object.assign(liveBounds, STREET);

  // Pose to drop into when stepping from the café back into the tunnel: at the
  // exit end, facing +z up the tunnel toward the street.
  const tunnelReturnPose = { x: 0, z: exitZ + 1.3, yaw: Math.PI };
  const portalX = entrance.cafePortal?._x ?? 0;
  const portalZ = entrance.cafePortal?._z ?? cafeBounds.maxZ;

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
    flash = 1; // white-out covers the cut
    player.teleport(tunnelReturnPose);
    Object.assign(liveBounds, { minX: -doorwayHalf, maxX: doorwayHalf, minZ: exitZ + 0.6, maxZ: facadeZ - 0.5 });
    audio.setPlace('tunnel');
    audio.armHush(0); // coming from the café, music carries straight over
  }
  function toCafe() {
    place = 'cafe';
    pendingClose = false;
    cafeArmed = false; // don't immediately re-trigger at the arrival spot
    flash = 1; // white-out covers the cut
    player.teleport(entrance.arrivalPose);
    Object.assign(liveBounds, cafeBounds);
    audio.setPlace('cafe');
  }

  return {
    get place() {
      return place;
    },
    get flash() {
      return flash;
    },
    update(dt) {
      const pos = camera.position;
      const { footstep } = entrance.update(dt, pos, place);
      flash *= Math.exp(-dt * 3.2); // fade any active bloom; ramps/cuts re-raise it

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

          // As you step through the open exit, the warm café light floods in,
          // peaking at the cut so the teleport is hidden inside the bloom.
          if (exitThrough) flash = Math.max(flash, Math.min(1, (exitZ + 1.4 - pos.z) / 1.6));

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
          // The portal sits at the built-in tunnel-corridor mouth; trigger by
          // proximity (orientation-agnostic), with the bloom building as you
          // reach it.
          const d = Math.hypot(pos.x - portalX, pos.z - portalZ);
          if (d > openDist) cafeArmed = true; // stepped away — now it can re-fire
          entrance.doors.cafe.open(cafeArmed && d < openDist);
          if (cafeArmed && entrance.doors.cafe.ratio > 0.5) {
            flash = Math.max(flash, Math.min(1, (openDist - d) / openDist));
          }
          if (cafeArmed && d < 0.7) toTunnelFromCafe();
          break;
        }
      }
    },
  };
}
