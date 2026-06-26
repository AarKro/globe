import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER } from './constants.js';

const ROOM_URL = new URL('../assets/models/room.glb', import.meta.url).href;
const TABLE_SET_URL = new URL('../assets/models/wooden_table_set.glb', import.meta.url).href;

// The source model is ~2.9 units across with a 0.48-unit ceiling; this
// scale brings it to walkable meters (ceiling ≈ 2.4 m).
const ROOM_SCALE = 5;

// empty_coffeeroom.glb is the same export as the original coffeshop_room
// with all seating/tables already removed, so there is nothing to strip.
// (The original's merged chair meshes were 'pCube427_coffeechair_0' and
// 'pCylinder383_coffeechair1_0' — keep the mechanism in case a future
// room ships furniture again.)
// The model's built-in corridor tube (`Cube002`, the -x-wall stub) is a messy
// export that clips with the clean programmed tunnel mapped onto it — strip it
// and let createEntrance build a clean dark tunnel shell in the same place.
const STRIP_MESH_NAMES = ['Cube002'];

// Each wooden table set (table + four stools + lamp) is normalized to this
// horizontal footprint, café-table sized so several fit in the room.
const TABLE_SET_FOOTPRINT = 2.2;

// Where the table sets stand (world meters, y = floor) and how they're
// turned. Spots keep the spawn corner, the counter approach (z > 3) and
// the right-side kiosk area clear, with walking gaps between sets.
const TABLE_SET_PLACEMENTS = [
  { x: -4.8, z: -3.6, rotY: 0.4 },
  { x: -1.2, z: -4.2, rotY: -0.9 },
  { x: 2.2, z: -3.8, rotY: 1.6 },
  { x: -5.2, z: 0.2, rotY: 2.3 },
  { x: -1.6, z: -0.6, rotY: -0.2 },
  { x: 2.0, z: 0.3, rotY: 0.9 },
];

const FLOOR_MESH_NAME = 'group1pasted__pPlane180_FLOOR_0';

// Interior in final world meters (recenter on the floor, ×5). room.glb's floor
// and walls share the same footprint (no exterior pavement), so this is the
// floor extent minus a little. Re-measure if the room GLB or ROOM_SCALE
// changes. The counter sits back-right, the window is on the -z wall, and a
// built-in tunnel corridor pokes out the -x wall at the back-left.
const INTERIOR = { minX: -5.8, maxX: 5.8, minZ: -5.8, maxZ: 5.8 };

// Ceiling height in final world meters (the box's centre; its underside sits
// ~at the wall tops, ≈ 2.39 m in room.glb).
const CEILING_Y = 2.42;

// The street-video screen on the -z wall (world meters). The model's actual
// glass cut-out is a ribbon (y ≈ 1.05..2.3), but we paint the video as a tall
// storefront window — down the solid wall to near the floor and up to the
// ceiling — so it reads as a big picture window rather than a thin slot. The
// plane sits just proud of the wall; the runtime ceiling caps its top.
const WINDOW = { cx: 1.8, cy: 1.42, z: -5.97, w: 6.0, h: 2.04 };
const TUNNEL_MOUTH = { x: -5.9, z: 4.77 };

const loader = new GLTFLoader();
const loadGltf = (url) =>
  new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

// Normalize a furniture asset: feet on y=0, centered on its own origin,
// scaled so its larger horizontal extent equals `footprint` meters.
function prepareTemplate(gltf, name, footprint) {
  const template = gltf.scene;
  const box = new THREE.Box3().setFromObject(template);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.name = name;
  const s = footprint / Math.max(size.x, size.z);
  template.scale.setScalar(s);
  template.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  wrapper.add(template);
  return wrapper;
}

// Loads the café room shell and furnishes it with wooden table sets.
// Returns the room root plus the walkable bounds and spawn.
export async function createGltfRoom() {
  const [roomGltf, tableSetGltf] = await Promise.all([
    loadGltf(ROOM_URL),
    loadGltf(TABLE_SET_URL),
  ]);

  const model = roomGltf.scene;
  STRIP_MESH_NAMES.forEach((name) => {
    const mesh = model.getObjectByName(name);
    if (mesh) mesh.removeFromParent();
    else console.warn(`Mesh to strip not found in room model: ${name}`);
  });

  // Recenter on the floor and scale to meters: floor center -> origin,
  // floor top -> y = 0. The shell wrapper carries the model scale so
  // furniture can be placed in plain world meters next to it.
  model.updateMatrixWorld(true);
  const floorMesh = model.getObjectByName(FLOOR_MESH_NAME);
  const floorBox = new THREE.Box3().setFromObject(floorMesh);
  const floorCenter = floorBox.getCenter(new THREE.Vector3());

  const shell = new THREE.Group();
  shell.name = 'shell';
  model.position.set(-floorCenter.x, -floorBox.max.y, -floorCenter.z);
  shell.add(model);
  shell.scale.setScalar(ROOM_SCALE);

  // Table sets (clones share geometry and materials).
  const template = prepareTemplate(tableSetGltf, 'tableSetTemplate', TABLE_SET_FOOTPRINT);
  const furniture = new THREE.Group();
  furniture.name = 'furniture';
  TABLE_SET_PLACEMENTS.forEach((p, i) => {
    const set = template.clone();
    set.name = `tableSet${i}`;
    set.position.set(p.x, 0, p.z);
    set.rotation.y = p.rotY;
    furniture.add(set);
  });

  // The empty room GLB has its ceiling stripped, so looking up shows the
  // scene background / distant entrance rooftops ("clipping skyline"). Cap the
  // interior with a simple ceiling in plain world meters (like the furniture),
  // lit from below by the warm lamps. Height matches the model's original
  // ceiling (~2.4 m); it overhangs the interior so it seats on the wall tops
  // with no gap. Re-check CEILING_Y if the room GLB or ROOM_SCALE changes.
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(INTERIOR.maxX - INTERIOR.minX + 1.4, 0.2, INTERIOR.maxZ - INTERIOR.minZ + 1.4),
    new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.95, metalness: 0 })
  );
  ceiling.name = 'ceiling';
  ceiling.position.set(
    (INTERIOR.minX + INTERIOR.maxX) / 2,
    CEILING_Y,
    (INTERIOR.minZ + INTERIOR.maxZ) / 2
  );

  // Window screen: a plane filling the -z wall ribbon, facing into the room.
  // createVideoSurface swaps in the street video (per theme); until then a
  // gradient stands in. PlaneGeometry faces +z by default — toward the room.
  const windowScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(WINDOW.w, WINDOW.h),
    new THREE.MeshBasicMaterial({ color: 0x223044 })
  );
  windowScreen.name = 'windowScreen';
  windowScreen.position.set(WINDOW.cx, WINDOW.cy, WINDOW.z);

  // Blackout panels over the -x wall. That wall has a row of window/arch
  // openings (z ≈ -4.5, -1, 2.5..3.5, 6.5..8) plus the built-in corridor mouth
  // (z ≈ 3.68..5.86, where the entrance now connects). The openings used to
  // show the dark background, but the entrance's daytime sky dome encloses the
  // whole scene, so they'd leak daylight into the night café. Seal everything
  // except the corridor band with two dark panels (the corridor stays open as
  // the tunnel into the café). Re-measure CORRIDOR_BAND if the room GLB changes.
  // The café's -x wall has a corridor mouth (z ≈ 3.6..5.95) and the other walls
  // have glass/window openings, so daylight would leak through. Box the café in
  // dark "night sky" backdrop panels just outside its walls — reading as dark
  // night beyond the glass. Openings kept: the -z storefront window
  // (windowScreen) and the -x corridor mouth (the tunnel in). Re-measure
  // CORRIDOR_BAND / the panel z-extents if the room GLB changes.
  const CORRIDOR_BAND = { min: 3.6, max: 5.95 };
  const backH = CEILING_Y + 0.6;
  const back = (name, w, ry, x, z) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, backH),
      new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.DoubleSide })
    );
    panel.name = name;
    panel.rotation.y = ry;
    panel.position.set(x, backH / 2, z);
    return panel;
  };
  // -x wall: two panels flanking the corridor mouth, within the café's
  // z-footprint (≈ -6.1..6.1) so they don't poke past the entrance façade.
  const xWall = INTERIOR.minX - 0.12;
  const sealA = back('xWallSealLeft', CORRIDOR_BAND.min - (INTERIOR.minZ - 0.3), Math.PI / 2, xWall, (INTERIOR.minZ - 0.3 + CORRIDOR_BAND.min) / 2);
  const sealB = back('xWallSealRight', INTERIOR.maxZ + 0.4 - CORRIDOR_BAND.max, Math.PI / 2, xWall, (CORRIDOR_BAND.max + INTERIOR.maxZ + 0.4) / 2);
  // The other walls: dark backdrops just outside, behind the glass.
  const xWide = INTERIOR.maxX - INTERIOR.minX + 4;
  const zWide = INTERIOR.maxZ - INTERIOR.minZ + 4;
  const sealBack = back('zWallSealBack', xWide, Math.PI, 0, INTERIOR.maxZ + 0.3); // +z back (glass) wall
  const sealFront = back('zWallSealFront', xWide, 0, 0, INTERIOR.minZ - 0.3); // -z, behind the window
  const sealPosX = back('xWallSealFar', zWide, -Math.PI / 2, INTERIOR.maxX + 0.3, 0); // +x wall

  const room = new THREE.Group();
  room.name = 'room';
  room.add(shell, furniture, ceiling, windowScreen, sealA, sealB, sealBack, sealFront, sealPosX);

  const m = PLAYER.boundsMargin;
  const bounds = {
    minX: INTERIOR.minX + m,
    maxX: INTERIOR.maxX - m,
    minZ: INTERIOR.minZ + m,
    maxZ: INTERIOR.maxZ - m,
  };

  // Spawn near the floor's -x/+z corner, facing into the room
  // (yaw 0 faces -z; -PI/4 turns toward +x/-z).
  const spawn = {
    x: bounds.minX + 1.2,
    z: bounds.maxZ - 1.2,
    yaw: -Math.PI / 4,
  };

  return { room, bounds, spawn, windowScreen, tunnelMouth: TUNNEL_MOUTH };
}
