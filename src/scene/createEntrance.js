import * as THREE from 'three';
import { ENTRANCE } from './constants.js';

// The entrance experience:
//   - a daytime Zürich street (sky, cobbles, Altstadt townhouses),
//   - a towering clean-brutalist BLACK café façade with a single door,
//   - a round tunnel whose white neon rings form its skeleton: the lit zone
//     runs ~ringLead ahead of the player and advances as they walk, so faded
//     rings light up one by one at the frontier and stay lit behind,
//   - a reactive floor that builds a glowing trail under footsteps,
//   - and a matching door inside the café (the return portal).
//
// Everything is unlit (MeshBasic / emissive color) so the global café lights
// never touch it. The tall façade occludes the café from the street and vice
// versa, so the daytime sky never bleeds into the night-themed café.
//
// createEntrance({ accent, cafeBounds }) returns:
//   { group, cafePortal, doors:{entry,exit,cafe}, arrivalPose,
//     setAccent, resetRings, update, dispose }

const {
  tunnelRadius,
  tunnelHeight,
  doorwayHalf,
  facadeZ,
  exitZ,
  streetBackZ,
  wingHalfWidth,
  streetHalf,
  facadeHeight,
  cafeWidth,
  doorWidth,
  doorHeight,
  stepLength,
  tile,
  ringSpacing,
  ringLead,
} = ENTRANCE;

const SKY_TOP = 40; // sky height (independent of the now-normal building height)

const SLAB_BLACK = 0x080808;
const TUNNEL_BLACK = 0x040404;
const DOOR_OPEN_ANGLE = 1.55;
const DOOR_SPEED = 5.5;

function slab(w, h, d, color = SLAB_BLACK) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
}

// A vertical two-stop gradient texture (top -> bottom).
function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A flat building-facade texture: base colour with a tidy grid of windows.
const facadeTexCache = new Map();
function facadeTexture(baseHex) {
  if (facadeTexCache.has(baseHex)) return facadeTexCache.get(baseHex);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(30,30,40,0.85)';
  const cols = 4;
  const rows = 8;
  const ww = 18;
  const wh = 22;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = 14 + col * 26;
      const y = 14 + r * 30;
      g.fillRect(x, y, ww, wh);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  facadeTexCache.set(baseHex, tex);
  return tex;
}

// A triangular-prism gable roof, ridge running along z, sitting on y=0.
function gableRoof(width, height, depth, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}

// One Altstadt townhouse: a windowed body + a gable roof.
const ZURICH_WALLS = ['#d9cdb4', '#cdb38a', '#b7c2b0', '#c9c2bd', '#d7c7a0', '#b8c4cf', '#c8a98c'];
const ZURICH_ROOFS = ['#7a4a3a', '#6e4636', '#83533f', '#5f4a42'];
function townhouse(width, bodyH, depth, wallHex, roofHex) {
  const house = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ map: facadeTexture(wallHex) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, bodyH, depth), bodyMat);
  body.position.y = bodyH / 2;
  const roof = gableRoof(width * 1.06, width * 0.5, depth * 1.04, roofHex);
  roof.position.y = bodyH;
  house.add(body, roof);
  return house;
}

// A hinged door leaf with one crisp accent seam down its leading edge.
function makeDoor(name, accentTargets) {
  const group = new THREE.Group();
  group.name = name;
  const leaf = slab(doorWidth, doorHeight, 0.08, 0x0a0a0a);
  leaf.position.set(doorWidth / 2, doorHeight / 2, 0);
  group.add(leaf);

  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  accentTargets.push({ material: seamMat, factor: 1 });
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, doorHeight * 0.78, 0.1), seamMat);
  seam.position.set(doorWidth - 0.09, doorHeight / 2, 0.02);
  group.add(seam);

  let ratio = 0;
  let target = 0;
  return {
    group,
    open(yes) {
      target = yes ? 1 : 0;
    },
    get ratio() {
      return ratio;
    },
    update(dt) {
      ratio += (target - ratio) * Math.min(1, dt * DOOR_SPEED);
      group.rotation.y = ratio * DOOR_OPEN_ANGLE;
    },
  };
}

// A crisp accent line tracing a doorway opening (jambs + head).
function doorwayFrame(z, accentTargets, faceDir = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  accentTargets.push({ material: mat, factor: 0.6 });
  const half = doorWidth / 2;
  const jamb = (x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorHeight, 0.05), mat);
    m.position.set(x, doorHeight / 2, z + 0.12 * faceDir);
    return m;
  };
  const head = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.08, 0.04, 0.05), mat);
  head.position.set(0, doorHeight, z + 0.12 * faceDir);
  group.add(jamb(-half - 0.02), jamb(half + 0.02), head);
  return group;
}

export function createEntrance({ accent: initialAccent = 0x4fd8ff, cafeBounds } = {}) {
  const group = new THREE.Group();
  group.name = 'entrance';

  const accent = new THREE.Color(initialAccent);
  const accentTargets = [];

  // ---- Daytime sky. The continuous building row across the street end + this
  // high cap occlude the night café and the dark background behind them. The
  // top cap stops short of the café (z >= skyTopMinZ) so the café keeps its
  // own dark ceiling — daytime never reaches it. ---------------------------
  const skyTop = SKY_TOP;
  const skyBack = streetBackZ + 22;
  const skyTopMinZ = exitZ + 2; // cap covers over the rooftops, not the café
  const skyGrad = () =>
    new THREE.MeshBasicMaterial({ map: gradientTexture('#6aa6e6', '#dfeaf3'), side: THREE.DoubleSide });
  const skyBackPlane = new THREE.Mesh(new THREE.PlaneGeometry(wingHalfWidth * 2.4, skyTop * 1.4), skyGrad());
  skyBackPlane.position.set(0, skyTop * 0.5, skyBack);
  const skyL = new THREE.Mesh(new THREE.PlaneGeometry(skyBack - skyTopMinZ + 8, skyTop * 1.4), skyGrad());
  skyL.rotation.y = Math.PI / 2;
  skyL.position.set(-wingHalfWidth, skyTop * 0.5, (skyTopMinZ + skyBack) / 2);
  const skyR = skyL.clone();
  skyR.rotation.y = -Math.PI / 2;
  skyR.position.x = wingHalfWidth;
  const skyTopPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(wingHalfWidth * 2.4, skyBack - skyTopMinZ + 8),
    new THREE.MeshBasicMaterial({ color: 0x6aa6e6, side: THREE.DoubleSide })
  );
  skyTopPlane.rotation.x = Math.PI / 2;
  skyTopPlane.position.set(0, skyTop, (skyTopMinZ + skyBack) / 2);
  group.add(skyBackPlane, skyL, skyR, skyTopPlane);

  // ---- Cobbled street ground ----------------------------------------------
  const cobble = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#8f8a80';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(60,56,50,0.5)';
    g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 30);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(wingHalfWidth * 2, skyBack - facadeZ + 12),
    new THREE.MeshBasicMaterial({ map: cobble })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (facadeZ + skyBack) / 2 - 3);
  group.add(ground);

  // ---- The café building: a clean-brutalist BLACK Zürich building, normal
  // sized, filling the end of the alley with one door (the tunnel entry cap). -
  const facade = new THREE.Group();
  facade.name = 'facade';
  const half = doorWidth / 2;
  const cafeSide = (cafeWidth - doorWidth) / 2;
  const fl = slab(cafeSide, facadeHeight, 0.5);
  fl.position.set(-(half + cafeSide / 2), facadeHeight / 2, facadeZ);
  const fr = slab(cafeSide, facadeHeight, 0.5);
  fr.position.set(half + cafeSide / 2, facadeHeight / 2, facadeZ);
  const lintelH = facadeHeight - doorHeight;
  const ft = slab(doorWidth, lintelH, 0.5);
  ft.position.set(0, doorHeight + lintelH / 2, facadeZ);
  // A slim cornice so it reads as a building rather than a slab.
  const cornice = slab(cafeWidth + 0.6, 0.5, 1.0);
  cornice.position.set(0, facadeHeight + 0.25, facadeZ + 0.25);
  facade.add(fl, fr, ft, cornice, doorwayFrame(facadeZ, accentTargets, 1));
  group.add(facade);

  // ---- The Zürich streetfront flanking the café across the alley end. This
  // continuous row (not the café) is what occludes the night café / dark
  // background, so the café can be a normal building. -----------------------
  const endRow = new THREE.Group();
  endRow.name = 'streetfront';
  let es = 7;
  const erand = () => {
    es = (es * 9301 + 49297) % 233280;
    return es / 233280;
  };
  [-1, 1].forEach((sideSign) => {
    let x = cafeWidth / 2 + 0.15;
    while (x < wingHalfWidth - 4) {
      const w = 4.5 + erand() * 3;
      const bodyH = 15 + erand() * 11;
      const depth = 5 + erand() * 3;
      const wall = ZURICH_WALLS[(erand() * ZURICH_WALLS.length) | 0];
      const roof = ZURICH_ROOFS[(erand() * ZURICH_ROOFS.length) | 0];
      const h = townhouse(w, bodyH, depth, wall, roof);
      h.position.set(sideSign * (x + w / 2), 0, facadeZ + depth / 2);
      endRow.add(h);
      x += w + 0.25;
    }
  });
  group.add(endRow);

  // ---- Zürich Altstadt townhouses lining the street -----------------------
  const houses = new THREE.Group();
  houses.name = 'altstadt';
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  [-1, 1].forEach((sideSign) => {
    let z = facadeZ + 3;
    while (z < streetBackZ + 4) {
      const w = 4 + rand() * 2.5;
      const bodyH = 12 + rand() * 12;
      const depth = 5 + rand() * 3;
      const wall = ZURICH_WALLS[(rand() * ZURICH_WALLS.length) | 0];
      const roof = ZURICH_ROOFS[(rand() * ZURICH_ROOFS.length) | 0];
      const h = townhouse(w, bodyH, depth, wall, roof);
      // Line the narrow alley: inner faces just outside the walkable width.
      h.position.set(sideSign * (streetHalf + 0.4 + depth / 2), 0, z + w / 2);
      h.rotation.y = sideSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      houses.add(h);
      z += w + 0.4 + rand() * 0.6;
    }
  });
  group.add(houses);

  // A distant Grossmünster nod: twin square towers down the street.
  [-7, -12.5].forEach((x, i) => {
    const tower = new THREE.Group();
    const shaft = slab(4.2, 30, 4.2, '#9a8f7e');
    shaft.position.y = 15;
    const cap = gableRoof(4.6, 3.4, 4.6, '#5d7d74');
    cap.position.y = 30;
    cap.rotation.y = Math.PI / 4;
    tower.add(shaft, cap);
    tower.position.set(x, 0, streetBackZ + 6 + i * 1.5);
    group.add(tower);
  });

  // ---- Round tunnel: dark shell, neon ring skeleton, end caps -------------
  const tunLen = facadeZ - exitZ;
  const tunMidZ = (facadeZ + exitZ) / 2;
  const tunCenterY = tunnelRadius;

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(tunnelRadius + 0.05, tunnelRadius + 0.05, tunLen, 36, 1, true),
    new THREE.MeshBasicMaterial({ color: TUNNEL_BLACK, side: THREE.BackSide })
  );
  shell.rotation.x = Math.PI / 2;
  shell.position.set(0, tunCenterY, tunMidZ);
  group.add(shell);

  // White neon rings (the skeleton). Each gets its own material so it can be
  // lit independently; activation runs a frontier ahead of the player.
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(tunnelRadius - 0.03, 0.035, 8, 40);
  const nRings = Math.max(2, Math.floor(tunLen / ringSpacing) - 1);
  const ringStart = exitZ + (tunLen - (nRings - 1) * ringSpacing) / 2;
  for (let i = 0; i < nRings; i++) {
    const z = ringStart + i * ringSpacing;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(0, tunCenterY, z);
    group.add(ring);
    rings.push({ mat, z, activated: false, bright: 0.05 });
  }

  // Exit end-cap wall (café side) + the warm café bloom behind its door.
  const exitWall = new THREE.Group();
  const ew = tunnelRadius + 0.4;
  const el = slab(ew - half, tunnelHeight, 0.2);
  el.position.set(-(half + (ew - half) / 2), tunnelHeight / 2, exitZ);
  const er = slab(ew - half, tunnelHeight, 0.2);
  er.position.set(half + (ew - half) / 2, tunnelHeight / 2, exitZ);
  const etH = tunnelHeight - doorHeight;
  const et = slab(doorWidth, etH, 0.2);
  et.position.set(0, doorHeight + etH / 2, exitZ);
  // Cap the round cross-section above/around the rectangular cap so no void
  // shows through the tube's circular opening.
  const ering = new THREE.Mesh(
    new THREE.RingGeometry(ew, tunnelRadius + 0.1, 32),
    new THREE.MeshBasicMaterial({ color: TUNNEL_BLACK, side: THREE.DoubleSide })
  );
  ering.position.set(0, tunCenterY, exitZ);
  exitWall.add(el, er, et, ering, doorwayFrame(exitZ, accentTargets, 1));
  group.add(exitWall);

  const bloom = new THREE.Mesh(
    new THREE.PlaneGeometry(doorWidth * 0.92, doorHeight * 0.92),
    new THREE.MeshBasicMaterial({ color: 0xfff1d8, side: THREE.DoubleSide })
  );
  bloom.position.set(0, doorHeight / 2, exitZ - 0.3);
  group.add(bloom);

  // ---- Reactive floor: a soft grid that lights under footsteps -----------
  const cols = Math.max(1, Math.floor((doorwayHalf * 2 + 0.4) / tile));
  const rows = Math.max(1, Math.floor(tunLen / tile));
  const count = cols * rows;
  const startX = -((cols * tile) / 2) + tile / 2;
  const startZ = exitZ + (tunLen - rows * tile) / 2 + tile / 2;

  const floorBase = slab(doorwayHalf * 2 + 0.6, 0.1, tunLen, TUNNEL_BLACK);
  floorBase.position.set(0, -0.05, tunMidZ);
  group.add(floorBase);

  const floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(tile * 0.88, 0.04, tile * 0.88), floorMat, count);
  tiles.name = 'reactiveFloor';
  tiles.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const tileX = new Float32Array(count);
  const tileZ = new Float32Array(count);
  const build = new Float32Array(count);
  const pulse = new Float32Array(count);
  const m4 = new THREE.Matrix4();
  const dark = new THREE.Color(0x000000);
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const i = r * cols + cc;
      tileX[i] = startX + cc * tile;
      tileZ[i] = startZ + r * tile;
      m4.makeTranslation(tileX[i], 0, tileZ[i]);
      tiles.setMatrixAt(i, m4);
      tiles.setColorAt(i, dark);
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  group.add(tiles);

  // ---- The café-side portal: a matching black door standing in the café. --
  // Walking through it teleports back into the tunnel (the two are far apart).
  const cafePortal = new THREE.Group();
  cafePortal.name = 'cafePortal';
  let arrivalPose = { x: 0, z: 0, yaw: 0 };
  if (cafeBounds) {
    const px = -3.0;
    const pz = cafeBounds.maxZ + 0.25; // against the back wall
    const cpFrameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    accentTargets.push({ material: cpFrameMat, factor: 0.6 });
    const post = (x) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorHeight + 0.1, 0.12), cpFrameMat);
      m.position.set(px + x, (doorHeight + 0.1) / 2, pz);
      return m;
    };
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.34, 0.12, 0.12), cpFrameMat);
    lintel.position.set(px, doorHeight + 0.05, pz);
    const back = slab(doorWidth + 0.34, doorHeight + 0.1, 0.06);
    back.position.set(px, (doorHeight + 0.1) / 2, pz + 0.1);
    const cafeLeaf = makeDoor('cafePortalDoor', accentTargets);
    cafeLeaf.group.position.set(px - doorWidth / 2, 0, pz - 0.05);
    cafePortal.add(post(-half - 0.1), post(half + 0.1), lintel, back, cafeLeaf.group);
    cafePortal._door = cafeLeaf;
    cafePortal._x = px;
    cafePortal._z = pz;
    arrivalPose = { x: px, z: cafeBounds.maxZ - 1.2, yaw: 0 };
  }

  // ---- Footstep cadence + per-frame update --------------------------------
  let lastX = null;
  let lastZ = null;
  let stepAccum = 0;
  const colorScratch = new THREE.Color();
  const RADIUS = 1.5; // wider pool so the path reads clearly
  const RADIUS2 = RADIUS * RADIUS;
  const GLOW_BIAS = 1.1; // bias the glow this far ahead, in the walk direction
  const white = new THREE.Color(0xffffff);

  function setAccent(hex) {
    accent.set(hex);
    accentTargets.forEach((t) => t.material.color.copy(accent).multiplyScalar(t.factor));
  }
  setAccent(initialAccent);

  function resetRings() {
    rings.forEach((r) => {
      r.activated = false;
    });
  }

  const doors = {
    entry: makeDoor('entryDoor', accentTargets),
    exit: makeDoor('exitDoor', accentTargets),
    cafe: cafePortal._door || makeDoor('noopDoor', accentTargets),
  };
  doors.entry.group.position.set(-doorWidth / 2, 0, facadeZ);
  doors.exit.group.position.set(-doorWidth / 2, 0, exitZ);
  group.add(doors.entry.group, doors.exit.group);

  function update(dt, pos, place) {
    doors.entry.update(dt);
    doors.exit.update(dt);
    doors.cafe.update(dt);

    // Footstep accumulation + a glow centre biased ahead in the walk
    // direction, so the path lights up before you reach it.
    let footstep = false;
    let glowX = pos.x;
    let glowZ = pos.z;
    if (lastX !== null) {
      const mvx = pos.x - lastX;
      const mvz = pos.z - lastZ;
      const len = Math.hypot(mvx, mvz);
      stepAccum += len;
      if (stepAccum >= stepLength) {
        stepAccum -= stepLength;
        footstep = true;
      }
      if (len > 1e-4) {
        glowX = pos.x + (mvx / len) * GLOW_BIAS;
        glowZ = pos.z + (mvz / len) * GLOW_BIAS;
      }
    }
    lastX = pos.x;
    lastZ = pos.z;

    // Neon ring frontier (only while in the tunnel). A ring activates once the
    // player is within ringLead ahead of it (and everything behind stays lit);
    // brightness eases so rings light up one by one as the frontier passes.
    if (place === 'tunnel') {
      for (const r of rings) {
        if (pos.z - r.z <= ringLead) r.activated = true;
      }
    }
    for (const r of rings) {
      const tgt = r.activated ? 1 : 0.05;
      r.bright += (tgt - r.bright) * Math.min(1, dt * 4);
      r.mat.color.copy(white).multiplyScalar(r.bright);
    }

    // Reactive floor.
    const pulseDecay = Math.exp(-dt * 2.6);
    for (let i = 0; i < count; i++) {
      const dx = tileX[i] - glowX;
      const dz = tileZ[i] - glowZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS2) {
        const f = 1 - Math.sqrt(d2) / RADIUS;
        build[i] = Math.min(0.45, build[i] + f * dt * 2.2);
        if (footstep && d2 < 0.42 * 0.42) pulse[i] = Math.max(pulse[i], 0.9 * f + 0.4);
      }
      pulse[i] *= pulseDecay;
      colorScratch.copy(white).multiplyScalar(Math.min(1, build[i] + pulse[i]));
      tiles.setColorAt(i, colorScratch);
    }
    tiles.instanceColor.needsUpdate = true;

    return { footstep };
  }

  function dispose() {
    [group, cafePortal].forEach((g) =>
      g.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
      })
    );
  }

  return { group, cafePortal, bloom, doors, arrivalPose, setAccent, resetRings, update, dispose };
}
