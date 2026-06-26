import { ENTRANCE } from './constants.js';

// Reversible place machine for the continuous entrance: street <-> tunnel <->
// café, all laid out along +x with no teleport. Both thresholds are real
// openings — bounds swap as the door swings:
//
//   street <-> tunnel : the façade door at facadeX. Entering from the street
//                       arms the audio "hush then swell" and replays the rings.
//   tunnel <-> café   : the door at the corridor mouth (mouthX) in the café's
//                       -x wall. Music carries straight across.
//
// Owns the single mutable `liveBounds` rect the player clamps to, opens doors by
// proximity, and drives the audio place/intensity. The player walks +x, so the
// café-ward limit is liveBounds.maxX and the corridor cross-axis is z.

const {
  corridorZ,
  corridorHalf,
  streetHalf,
  mouthX,
  facadeX,
  streetBackX,
  openDist,
} = ENTRANCE;

const STREET = {
  minX: streetBackX + 0.5,
  maxX: facadeX - 0.6,
  minZ: corridorZ - streetHalf,
  maxZ: corridorZ + streetHalf,
};

export function createEntranceSequence({ entrance, audio, camera, liveBounds, cafeBounds }) {
  let place = 'street';
  let pendingClose = false; // awaiting the façade door to shut behind us
  Object.assign(liveBounds, STREET);

  function toStreet() {
    place = 'street';
    pendingClose = false;
    Object.assign(liveBounds, STREET, { maxX: facadeX + 1.2 });
    audio.setPlace('street');
  }
  function toTunnelFromStreet() {
    place = 'tunnel';
    pendingClose = true; // door-close clunk fires once the door shuts behind us
    entrance.resetRings();
    audio.setPlace('tunnel');
    // Music swells in immediately on stepping into the tunnel — no hold/hush.
    // It starts near-silent (swell ~0.04 at the façade) and rises toward the café.
    audio.armHush(0);
  }
  function toTunnelFromCafe() {
    place = 'tunnel';
    pendingClose = false;
    audio.setPlace('tunnel');
    audio.armHush(0); // coming from the café, music carries straight over
  }
  function toCafe() {
    place = 'cafe';
    pendingClose = false;
    // Start in the mouth channel so the clamp doesn't shove us off the
    // threshold; the café case widens to the full rect once we step away.
    Object.assign(liveBounds, {
      minX: mouthX - 1.2,
      maxX: cafeBounds.maxX,
      minZ: corridorZ - corridorHalf,
      maxZ: corridorZ + corridorHalf,
    });
    audio.setPlace('cafe');
  }

  return {
    get place() {
      return place;
    },
    get flash() {
      return 0; // continuous space — no teleport white-out
    },
    update(dt) {
      const pos = camera.position;
      const { footstep } = entrance.update(dt, pos, place);
      const inBand = Math.abs(pos.z - corridorZ) < corridorHalf;

      switch (place) {
        case 'street': {
          const open = pos.x > facadeX - openDist;
          entrance.doors.entry.open(open);
          const through = entrance.doors.entry.ratio > 0.55 && Math.abs(pos.z - corridorZ) < corridorHalf + 0.05;
          liveBounds.minX = STREET.minX;
          liveBounds.minZ = STREET.minZ;
          liveBounds.maxZ = STREET.maxZ;
          liveBounds.maxX = through ? facadeX + 1.2 : facadeX - 0.6;
          if (pos.x > facadeX + 0.4) {
            toTunnelFromStreet();
            liveBounds.minZ = corridorZ - corridorHalf;
            liveBounds.maxZ = corridorZ + corridorHalf;
          }
          break;
        }
        case 'tunnel': {
          if (footstep) audio.footstep();

          // Façade door (street end): opens when you approach it from inside.
          const entryNear = pos.x < facadeX + openDist;
          entrance.doors.entry.open(entryNear);
          const entryThrough = entrance.doors.entry.ratio > 0.55 && inBand;

          // The moment it has shut behind you: a satisfying door-close clunk
          // (the music is already swelling in, so no hush here).
          if (pendingClose && entrance.doors.entry.ratio < 0.08) {
            audio.doorClose();
            pendingClose = false;
          }

          // Café-mouth door.
          const cafeNear = pos.x > mouthX - openDist;
          entrance.doors.cafe.open(cafeNear);
          const cafeThrough = entrance.doors.cafe.ratio > 0.55 && inBand;

          liveBounds.minZ = corridorZ - corridorHalf;
          liveBounds.maxZ = corridorZ + corridorHalf;
          liveBounds.minX = entryThrough ? facadeX - 1.2 : facadeX + 0.5;
          liveBounds.maxX = cafeThrough ? mouthX + 1.2 : mouthX - 0.6;

          audio.setIntensity((pos.x - facadeX) / (mouthX - facadeX));

          if (pos.x < facadeX - 0.4) toStreet();
          else if (pos.x > mouthX + 0.4) toCafe();
          break;
        }
        case 'cafe': {
          if (footstep) audio.footstep();

          // Open a channel through the -x wall back into the corridor when you
          // reach the mouth's z-band; clamp to the band there so you can't pass
          // through solid wall elsewhere.
          const approachingMouth = pos.x < mouthX + openDist + 0.5 && Math.abs(pos.z - corridorZ) < corridorHalf + 0.4;
          entrance.doors.cafe.open(approachingMouth);
          const through = entrance.doors.cafe.ratio > 0.55 && inBand;

          liveBounds.minX = through ? mouthX - 1.2 : cafeBounds.minX;
          liveBounds.maxX = cafeBounds.maxX;
          liveBounds.minZ = through ? corridorZ - corridorHalf : cafeBounds.minZ;
          liveBounds.maxZ = through ? corridorZ + corridorHalf : cafeBounds.maxZ;

          if (pos.x < mouthX - 0.3) toTunnelFromCafe();
          break;
        }
      }
    },
  };
}
