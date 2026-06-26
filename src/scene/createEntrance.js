import * as THREE from 'three';
import { ENTRANCE } from './constants.js';

const LOGO_URL = new URL('../assets/images/logo_globe.png', import.meta.url).href;

// The entrance experience, laid out along the -x axis and mapped onto room.glb's
// built-in corridor (the `Cube002` stub on the café's -x wall): that corridor
// IS the tunnel, so the whole thing is one continuous space — no teleport.
//
//   street (sky dome + black façade)  -->  façade door  -->  the model corridor
//   (dark, neon-ring skeleton, reactive floor)  -->  café-mouth door  -->  café.
//
// The player walks +x. Everything here is unlit (MeshBasic / emissive) so the
// global café lights never touch it; the 8.6 m dark corridor with a door at
// each end keeps the daytime street out of the night café.
//
// createEntrance({ accent }) returns:
//   { group, doors:{entry,cafe}, setAccent, resetRings, update, dispose }

const {
  corridorZ,
  corridorHalf,
  corridorHeight,
  mouthX,
  facadeX,
  streetBackX,
  facadeHeight,
  facadeDepth,
  facadeZMin,
  facadeZMax,
  doorWidth,
  doorHeight,
  ringRadius,
  stepLength,
  tile,
  ringSpacing,
  ringLead,
} = ENTRANCE;

const SLAB_BLACK = 0x080808;
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

// A hinged door leaf (built in the x-y plane, hinge about +y at its -x edge)
// with one crisp accent seam down its leading edge.
function makeDoor(name, accentTargets, rims) {
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
  rims?.push(seam);

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

// Orient a door onto an x-normal wall at `wallX`: the leaf spans z (hinge at the
// +z side of the doorway), thin in x. The inner door still swings on its own y.
function placeDoorX(door, wallX) {
  const wrap = new THREE.Group();
  wrap.rotation.y = Math.PI / 2; // local +x -> world -z
  wrap.position.set(wallX, 0, corridorZ + doorWidth / 2);
  wrap.add(door.group);
  return wrap;
}

// The GLOBE logo as glowing white strokes on transparent: the source art is
// dark line-art on white, so we invert luminance into alpha (dark → opaque
// white, light → transparent). On the black café wall it reads as a glowing
// sign. Drawn async once the image loads. NOTE: this assumes dark-on-light
// source art — if LOGO_URL is later replaced with a white-on-transparent file,
// use its texture directly instead of inverting.
function makeGlowLogo(url, size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(img, 0, 0, 512, 512);
    const d = ctx.getImageData(0, 0, 512, 512);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = 255 - lum;
    }
    ctx.putImageData(d, 0, 0);
    tex.needsUpdate = true;
  };
  img.src = url;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  mesh.name = 'doorLogo';
  return mesh;
}

// A crisp accent line tracing a doorway opening on an x-normal wall.
function doorFrameX(wallX, accentTargets, faceDir = -1, rims) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  accentTargets.push({ material: mat, factor: 0.6 });
  rims?.push(group);
  const half = doorWidth / 2;
  const x = wallX + 0.12 * faceDir;
  const jamb = (z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, doorHeight, 0.04), mat);
    m.position.set(x, doorHeight / 2, z);
    return m;
  };
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, doorWidth + 0.08), mat);
  head.position.set(x, doorHeight, corridorZ);
  group.add(jamb(corridorZ - half - 0.02), jamb(corridorZ + half + 0.02), head);
  return group;
}

export function createEntrance({ accent: initialAccent = 0x4fd8ff } = {}) {
  const group = new THREE.Group();
  group.name = 'entrance';

  const accent = new THREE.Color(initialAccent);
  const accentTargets = [];
  // Door neon rims (frame + leaf seam), grouped per door. A door's rim shows
  // only when it's shut and viewed from outside the tunnel (street / café); it
  // hides the moment the door starts opening (so you don't see a lit rim through
  // the doorway) and whenever the player is inside the tunnel (pure black).
  const entryRims = [];
  const cafeRims = [];

  // ---- Daytime sky: a single seamless dome over the street. The café (far +x,
  // through the corridor) is enclosed by its own opaque walls/ceiling/window
  // screen, so the daytime dome never reaches its interior. ----
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 16),
    new THREE.MeshBasicMaterial({ map: gradientTexture('#6aa6e6', '#dfeaf3'), side: THREE.BackSide })
  );
  skyDome.name = 'skyDome';
  skyDome.position.set((streetBackX + mouthX) / 2, 0, corridorZ);
  group.add(skyDome);

  // ---- Cobbled street ground (capped at the façade so it never reaches the
  // café/corridor floor) ----------------------------------------------------
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
    tex.repeat.set(80, 80);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const groundMinX = streetBackX - 50;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(facadeX - groundMinX, 260),
    new THREE.MeshBasicMaterial({ map: cobble })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((groundMinX + facadeX) / 2, 0, corridorZ);
  group.add(ground);

  // ---- The black café building: a clean-brutalist black box capping the
  // corridor's street end (x = facadeX), with one door. Faces -x, toward the
  // street. It spans the whole café-building footprint in z so the (low, 2.4 m)
  // café behind it is fully occluded — the door at corridorZ makes it
  // asymmetric. Built with depth so it reads as a building, not a wall. -------
  const facade = new THREE.Group();
  facade.name = 'facade';
  const half = doorWidth / 2;
  const fx = facadeX + facadeDepth / 2 - 0.5; // front (street) face near facadeX
  const leftZ0 = facadeZMin;
  const leftZ1 = corridorZ - half;
  const rightZ0 = corridorZ + half;
  const rightZ1 = facadeZMax;
  const fl = slab(facadeDepth, facadeHeight, leftZ1 - leftZ0);
  fl.position.set(fx, facadeHeight / 2, (leftZ0 + leftZ1) / 2);
  const fr = slab(facadeDepth, facadeHeight, rightZ1 - rightZ0);
  fr.position.set(fx, facadeHeight / 2, (rightZ0 + rightZ1) / 2);
  const lintelH = facadeHeight - doorHeight;
  const ft = slab(facadeDepth, lintelH, doorWidth);
  ft.position.set(fx, doorHeight + lintelH / 2, corridorZ);
  // A slim cornice so it reads as a building rather than a slab.
  const cornice = slab(facadeDepth + 0.5, 0.5, facadeZMax - facadeZMin + 0.6);
  cornice.position.set(fx + 0.1, facadeHeight + 0.25, (facadeZMin + facadeZMax) / 2);
  facade.add(fl, fr, ft, cornice, doorFrameX(facadeX, accentTargets, -1, entryRims));
  // Glowing GLOBE logo above the door, on the façade's street-facing face.
  const logo = makeGlowLogo(LOGO_URL, 1.4);
  logo.rotation.y = -Math.PI / 2; // face -x, toward the street
  logo.position.set(facadeX - 0.53, doorHeight + 0.95, corridorZ); // 0.03 m proud of the front face (facadeX - 0.5)
  facade.add(logo);
  group.add(facade);

  // ---- Programmed tunnel shell. The model's built-in corridor (`Cube002`) is
  // stripped (it's a messy export that clips with the rings); this is the clean
  // dark tube that replaces it, in the same place — from the façade to the café
  // mouth, sized to clear the neon hoops. Ends are open (capped by the façade
  // at the street end and the café's -x wall at the mouth). -------------------
  const corLen = mouthX - facadeX;
  const tunMidX = (facadeX + mouthX) / 2;
  const tunHalfZ = ringRadius + 0.15;
  const tunTop = corridorHeight;
  const tunMat = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
  const tunnel = new THREE.Group();
  tunnel.name = 'tunnelShell';
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(corLen, tunHalfZ * 2), tunMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(tunMidX, tunTop, corridorZ);
  const floorBase = new THREE.Mesh(new THREE.PlaneGeometry(corLen, tunHalfZ * 2), tunMat);
  floorBase.rotation.x = -Math.PI / 2;
  floorBase.position.set(tunMidX, 0, corridorZ);
  const sideN = new THREE.Mesh(new THREE.PlaneGeometry(corLen, tunTop), tunMat);
  sideN.position.set(tunMidX, tunTop / 2, corridorZ - tunHalfZ);
  const sideP = new THREE.Mesh(new THREE.PlaneGeometry(corLen, tunTop), tunMat);
  sideP.position.set(tunMidX, tunTop / 2, corridorZ + tunHalfZ);
  tunnel.add(ceil, floorBase, sideN, sideP);
  group.add(tunnel);

  // ---- Neon ring skeleton inside the tunnel. Full hoops (in the y-z plane) the
  // player walks through; each gets its own material so the lit frontier can run
  // ahead of the player as they advance toward the café. ---------------------
  const rings = [];
  const ringGeo = new THREE.TorusGeometry(ringRadius, 0.035, 8, 36);
  const ringY = corridorHeight / 2;
  const nRings = Math.max(2, Math.floor(corLen / ringSpacing) - 1);
  const ringStart = facadeX + (corLen - (nRings - 1) * ringSpacing) / 2;
  for (let i = 0; i < nRings; i++) {
    const x = ringStart + i * ringSpacing;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(x, ringY, corridorZ);
    ring.rotation.y = Math.PI / 2; // lie in the y-z plane (faces ±x)
    group.add(ring);
    rings.push({ mat, x, activated: false, bright: 0.05 });
  }

  // ---- Reactive floor: a soft grid on the corridor floor that lights under
  // footsteps. Sits just above the model floor to avoid z-fighting. ---------
  const cols = Math.max(1, Math.floor((corridorHalf * 2 + 0.3) / tile));
  const rows = Math.max(1, Math.floor(corLen / tile));
  const count = cols * rows;
  const startZ = corridorZ - ((cols * tile) / 2) + tile / 2;
  const startX = facadeX + (corLen - rows * tile) / 2 + tile / 2;

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
      tileX[i] = startX + r * tile;
      tileZ[i] = startZ + cc * tile;
      m4.makeTranslation(tileX[i], 0.03, tileZ[i]);
      tiles.setMatrixAt(i, m4);
      tiles.setColorAt(i, dark);
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  group.add(tiles);

  // ---- Doors: entry (street end, at the façade) and café (the corridor mouth
  // in the café's -x wall). Both are real openings; walking through swaps the
  // bounds, no teleport. -----------------------------------------------------
  const doors = {
    entry: makeDoor('entryDoor', accentTargets, entryRims),
    cafe: makeDoor('cafePortalDoor', accentTargets, cafeRims),
  };
  group.add(placeDoorX(doors.entry, facadeX));
  group.add(placeDoorX(doors.cafe, mouthX), doorFrameX(mouthX, accentTargets, -1, cafeRims));

  // ---- Accent + per-frame update ------------------------------------------
  let lastX = null;
  let lastZ = null;
  let stepAccum = 0;
  const colorScratch = new THREE.Color();
  const RADIUS = 1.5;
  const RADIUS2 = RADIUS * RADIUS;
  const GLOW_BIAS = 1.1;
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

  function update(dt, pos, place) {
    doors.entry.update(dt);
    doors.cafe.update(dt);

    // Both doors' rims hide as soon as *either* door starts opening (so no lit
    // rim shows through the open doorway, near or far) and whenever inside the
    // tunnel (pure black). They show only when both doors are shut and the
    // player is outside the tunnel.
    const anyDoorOpening = doors.entry.ratio > 0.02 || doors.cafe.ratio > 0.02;
    const showRims = place !== 'tunnel' && !anyDoorOpening;
    for (const r of entryRims) r.visible = showRims;
    for (const r of cafeRims) r.visible = showRims;

    // Footstep accumulation + a glow centre biased ahead in the walk direction.
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

    // Neon ring frontier (only in the corridor). A ring activates once the
    // player is within ringLead before it (café-ward is +x); behind stays lit.
    if (place === 'tunnel') {
      for (const r of rings) {
        if (pos.x >= r.x - ringLead) r.activated = true;
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
    group.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
  }

  return { group, doors, setAccent, resetRings, update, dispose };
}
