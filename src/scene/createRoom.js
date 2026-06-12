import * as THREE from 'three';
import { ROOM } from './constants.js';

const WOOD = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 });
const WOOD_DARK = new THREE.MeshStandardMaterial({ color: 0x5c3a20, roughness: 0.8 });
const PLASTER = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.95 });
const FLOOR_MAT = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.85 });
const CEILING_MAT = new THREE.MeshStandardMaterial({ color: 0xd8cdbb, roughness: 1 });
const FRAME_MAT = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 });
const SEAT_MAT = new THREE.MeshStandardMaterial({ color: 0x9c4a3c, roughness: 0.9 });

function box(name, material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

// Builds the placeholder café room. Returns the replaceable root group and
// the meshes reserved for video textures (the window panes on the -x wall).
export function createRoom() {
  const room = new THREE.Group();
  room.name = 'room';

  const { width: W, depth: D, height: H } = ROOM;
  const wallT = 0.15;

  // --- Shell -------------------------------------------------------------
  const shell = new THREE.Group();
  shell.name = 'shell';
  shell.add(
    box('floor', FLOOR_MAT, W, wallT, D, 0, -wallT / 2, 0),
    box('ceiling', CEILING_MAT, W, wallT, D, 0, H + wallT / 2, 0),
    box('wallBack', PLASTER, W, H, wallT, 0, H / 2, -D / 2 - wallT / 2),
    box('wallFront', PLASTER, W, H, wallT, 0, H / 2, D / 2 + wallT / 2),
    box('wallWindow', PLASTER, wallT, H, D, -W / 2 - wallT / 2, H / 2, 0),
    box('wallSide', PLASTER, wallT, H, D, W / 2 + wallT / 2, H / 2, 0)
  );
  room.add(shell);

  // --- Window wall (-x): three framed panes reserved for video ------------
  const mediaSurfaces = [];
  const windows = new THREE.Group();
  windows.name = 'windows';
  const paneW = 1.6;
  const paneH = 1.7;
  const paneY = 1.5;
  const paneX = -W / 2 + 0.02; // just inside the wall face
  [-2.4, 0, 2.4].forEach((z, i) => {
    const frame = box(`windowFrame${i}`, FRAME_MAT, 0.06, paneH + 0.2, paneW + 0.2, paneX, paneY, z);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(paneW, paneH),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    pane.name = `windowPane${i}`;
    pane.position.set(paneX + 0.05, paneY, z);
    pane.rotation.y = Math.PI / 2; // face into the room
    windows.add(frame, pane);
    mediaSurfaces.push(pane);
  });
  room.add(windows);

  // --- Furniture -----------------------------------------------------------
  const furniture = new THREE.Group();
  furniture.name = 'furniture';

  // Counter along the back wall.
  const counter = new THREE.Group();
  counter.name = 'counter';
  counter.add(
    box('counterBody', WOOD_DARK, 5, 1.0, 0.7, 0, 0.5, -D / 2 + 0.8),
    box('counterTop', WOOD, 5.2, 0.06, 0.8, 0, 1.03, -D / 2 + 0.8),
    box('backBar', WOOD_DARK, 4.6, 1.1, 0.35, 0, 1.9, -D / 2 + 0.2)
  );
  furniture.add(counter);

  // Tables with stools in the seating area.
  const tableSpots = [
    { x: -2.6, z: 0.6 },
    { x: -2.6, z: 2.2 },
    { x: 2.4, z: 0.6 },
    { x: 2.4, z: 2.2 },
  ];
  tableSpots.forEach(({ x, z }, i) => {
    const table = new THREE.Group();
    table.name = `table${i}`;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 24), WOOD);
    top.name = `tableTop${i}`;
    top.position.set(x, 0.75, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.75, 12), FRAME_MAT);
    leg.name = `tableLeg${i}`;
    leg.position.set(x, 0.375, z);
    table.add(top, leg);
    [-0.7, 0.7].forEach((dz, j) => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.48, 16), SEAT_MAT);
      stool.name = `stool${i}-${j}`;
      stool.position.set(x, 0.24, z + dz);
      table.add(stool);
    });
    furniture.add(table);
  });

  // Shelf on the +x wall.
  furniture.add(
    box('shelfLow', WOOD, 0.3, 0.05, 3.0, W / 2 - 0.2, 1.2, 0),
    box('shelfHigh', WOOD, 0.3, 0.05, 3.0, W / 2 - 0.2, 1.8, 0)
  );
  room.add(furniture);

  // --- Décor placeholders ---------------------------------------------------
  const decor = new THREE.Group();
  decor.name = 'decor';

  // Sign above the counter; emissive so it reads as backlit.
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.5, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0x2a1a0c,
      emissive: 0xe8b86d,
      emissiveIntensity: 0.55,
    })
  );
  sign.name = 'sign';
  sign.position.set(0, 2.55, -D / 2 + 0.25);
  decor.add(sign);

  // Hanging lamps over the seating area (bulb meshes only; the matching
  // point lights live in createLights so light count stays tunable there).
  [-2.6, 2.4].forEach((x, i) => {
    const cord = box(`lampCord${i}`, FRAME_MAT, 0.02, 0.7, 0.02, x, H - 0.35, 1.4);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffe2b0,
        emissive: 0xffc873,
        emissiveIntensity: 1.4,
      })
    );
    bulb.name = `lampBulb${i}`;
    bulb.position.set(x, H - 0.75, 1.4);
    decor.add(cord, bulb);
  });
  room.add(decor);

  return { room, mediaSurfaces };
}
