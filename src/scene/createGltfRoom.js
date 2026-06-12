import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PLAYER } from './constants.js';

const ROOM_URL = new URL('../assets/models/empty_coffeeroom.glb', import.meta.url).href;
const CHAIR_URL = new URL('../assets/models/cover_chair.glb', import.meta.url).href;

// The source model is ~2.9 units across with a 0.48-unit ceiling; this
// scale brings it to walkable meters (ceiling ≈ 2.4 m).
const ROOM_SCALE = 5;

// empty_coffeeroom.glb is the same export as the original coffeshop_room
// with all seating/tables already removed, so there is nothing to strip.
// (The original's merged chair meshes were 'pCube427_coffeechair_0' and
// 'pCylinder383_coffeechair1_0' — keep the mechanism in case a future
// room ships furniture again.)
const CHAIR_MESH_NAMES = [];

// Per-chair footprints recovered by clustering the original room's merged
// chair geometry offline (model-space coordinates, pre-scaling). The
// coordinate system is unchanged in the empty room, so the spots remain
// sensible seating positions. `face` is the point the chair is turned
// toward.
const CHAIR_PLACEMENTS = [
  // box-style coffee chairs
  { x: 1.62, z: 0.29, face: { x: 1.62, z: 0.54 } },
  { x: 1.06, z: 0.54, face: { x: 1.62, z: 0.54 } },
  { x: 2.12, z: 0.54, face: { x: 1.62, z: 0.54 } },
  { x: 1.16, z: 1.47, face: { x: 1.16, z: 1.06 } },
  // round chairs near the sofa and side table
  { x: 1.21, z: -0.16, face: { x: 0.96, z: 0.03 } },
  { x: 0.96, z: 0.03, face: { x: 1.21, z: -0.16 } },
  { x: 2.66, z: 0.58, face: { x: 2.67, z: 0.26 } },
  { x: 2.67, z: 0.26, face: { x: 2.66, z: 0.58 } },
];

// Original chairs are ~0.21 model units tall; match that so the
// replacements sit naturally at the tables.
const CHAIR_TARGET_HEIGHT = 0.21;

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

function prepareChairTemplate(gltf) {
  const template = gltf.scene;
  const box = new THREE.Box3().setFromObject(template);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Normalize: feet on y=0, centered on its own origin, CHAIR_TARGET_HEIGHT tall.
  const wrapper = new THREE.Group();
  wrapper.name = 'chairTemplate';
  const s = CHAIR_TARGET_HEIGHT / size.y;
  template.scale.setScalar(s);
  template.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  wrapper.add(template);
  return wrapper;
}

// Loads the café room, strips the merged original-chair meshes, and places
// cover-chair clones at the recovered per-chair positions. Returns the room
// root plus the walkable bounds and spawn derived from the floor.
export async function createGltfRoom() {
  const [roomGltf, chairGltf] = await Promise.all([loadGltf(ROOM_URL), loadGltf(CHAIR_URL)]);

  const model = roomGltf.scene;

  // Strip the original chairs.
  CHAIR_MESH_NAMES.forEach((name) => {
    const mesh = model.getObjectByName(name);
    if (mesh) mesh.removeFromParent();
    else console.warn(`Chair mesh not found in room model: ${name}`);
  });

  // Place replacement chairs (clones share geometry and materials).
  const chairTemplate = prepareChairTemplate(chairGltf);
  const chairs = new THREE.Group();
  chairs.name = 'chairs';
  CHAIR_PLACEMENTS.forEach((p, i) => {
    const chair = chairTemplate.clone();
    chair.name = `coverChair${i}`;
    chair.position.set(p.x, 0, p.z);
    chair.rotation.y = Math.atan2(p.face.x - p.x, p.face.z - p.z);
    chairs.add(chair);
  });
  model.add(chairs);

  // Recenter on the floor and scale to meters: floor center -> origin,
  // floor top -> y = 0.
  model.updateMatrixWorld(true);
  const floorMesh = model.getObjectByName(FLOOR_MESH_NAME);
  const floorBox = new THREE.Box3().setFromObject(floorMesh);
  const floorCenter = floorBox.getCenter(new THREE.Vector3());

  const room = new THREE.Group();
  room.name = 'room';
  model.position.set(-floorCenter.x, -floorBox.max.y, -floorCenter.z);
  room.add(model);
  room.scale.setScalar(ROOM_SCALE);

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
