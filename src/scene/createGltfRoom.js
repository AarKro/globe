import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER } from './constants.js';

const ROOM_URL = new URL('../assets/models/empty_coffeeroom.glb', import.meta.url).href;
const TABLE_SET_URL = new URL('../assets/models/wooden_table_set.glb', import.meta.url).href;

// The source model is ~2.9 units across with a 0.48-unit ceiling; this
// scale brings it to walkable meters (ceiling ≈ 2.4 m).
const ROOM_SCALE = 5;

// empty_coffeeroom.glb is the same export as the original coffeshop_room
// with all seating/tables already removed, so there is nothing to strip.
// (The original's merged chair meshes were 'pCube427_coffeechair_0' and
// 'pCylinder383_coffeechair1_0' — keep the mechanism in case a future
// room ships furniture again.)
const STRIP_MESH_NAMES = [];

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

// Interior wall faces, raycast-measured in final world meters (the floor
// and the building shell both extend past the interior room — exterior
// pavement/terrace — so no mesh bounding box gives these). Re-measure if
// the room GLB or ROOM_SCALE changes. Note: the empty room has no ceiling
// mesh and its back wall is glass left of the counter.
const INTERIOR = { minX: -7.19, maxX: 4.79, minZ: -6.0, maxZ: 6.0 };

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

  const room = new THREE.Group();
  room.name = 'room';
  room.add(shell, furniture);

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

  return { room, bounds, spawn };
}
