import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared building blocks for theme decor. Everything is procedural —
// primitives + canvas textures — so themes need no extra model assets.

// Paper-lantern GLB (replaces the procedural makeLantern). Hung at each [x,y,z],
// normalized so each lantern is `height` m tall and centred on its position.
// Async (GLB load), and loaded fresh per call so theme-switch disposal stays
// clean (clones share this load's resources, which are disposed with the decor
// group). Skips populating if the decor group was already removed mid-load.
const lanternLoader = new GLTFLoader();
const LANTERN_URL = new URL('../assets/models/japanese_paper_lantern.glb', import.meta.url).href;
export function addPaperLanterns(decor, positions, { height = 0.5 } = {}) {
  lanternLoader.load(LANTERN_URL, (gltf) => {
    if (!decor.parent) return; // theme switched away before the model loaded
    const src = gltf.scene;
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = height / size.y;
    positions.forEach(([x, y, z]) => {
      const lantern = src.clone();
      lantern.name = 'paperLantern';
      lantern.scale.setScalar(s);
      // Recenter the model's bounding box onto (x, y, z).
      lantern.position.set(x - center.x * s, y - center.y * s, z - center.z * s);
      decor.add(lantern);
    });
  });
}

const PX_PER_METER = 300;

// A flat sign panel with text drawn to a CanvasTexture. MeshBasicMaterial so
// it reads as self-lit signage regardless of room lighting.
export function makeTextPanel({
  text,
  width,
  height,
  background = '#111111',
  color = '#ffffff',
  border = null,
  glow = null,
  fontFamily = 'sans-serif',
  vertical = false,
}) {
  const cw = Math.max(64, Math.round(width * PX_PER_METER));
  const ch = Math.max(64, Math.round(height * PX_PER_METER));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, cw, ch);

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = Math.round(PX_PER_METER * 0.035);
    const inset = ctx.lineWidth * 1.2;
    ctx.strokeRect(inset, inset, cw - inset * 2, ch - inset * 2);
  }

  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = PX_PER_METER * 0.07;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (vertical) {
    const chars = [...text];
    const cell = (ch * 0.86) / chars.length;
    const size = Math.min(cw * 0.6, cell * 0.85);
    ctx.font = `bold ${size}px ${fontFamily}`;
    chars.forEach((c, i) => {
      ctx.fillText(c, cw / 2, ch * 0.07 + (i + 0.5) * cell);
    });
  } else {
    let size = ch * 0.5;
    ctx.font = `bold ${size}px ${fontFamily}`;
    while (ctx.measureText(text).width > cw * 0.84 && size > 8) {
      size *= 0.92;
      ctx.font = `bold ${size}px ${fontFamily}`;
    }
    ctx.fillText(text, cw / 2, ch / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  return mesh;
}

// A bright bar that reads as a neon tube.
export function makeNeonTube(length, color, radius = 0.02) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.rotation.z = Math.PI / 2; // horizontal by default
  return mesh;
}

// A glowing paper lantern hanging on a short cord.
export function makeLantern(bodyColor, glowColor) {
  const lantern = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 12),
    new THREE.MeshStandardMaterial({
      color: bodyColor,
      emissive: glowColor,
      emissiveIntensity: 1.1,
    })
  );
  body.scale.y = 1.25;
  const capMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12 });
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), capMat);
  capTop.position.y = 0.165;
  const capBottom = capTop.clone();
  capBottom.position.y = -0.165;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), capMat);
  cord.position.y = 0.28;
  lantern.add(body, capTop, capBottom, cord);
  return lantern;
}

// A sagging string of warm bulbs between two points.
export function makeBulbString(from, to, { count = 12, sag = 0.3, color = 0xffd27a } = {}) {
  const group = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);

  const points = [];
  const bulbGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t); // parabolic sag
    points.push(p);
    if (i > 0 && i < count) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.copy(p).y -= 0.045;
      group.add(bulb);
    }
  }
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x1a140e })
  );
  group.add(wire);
  return group;
}

// A vermilion torii gate — two tapered pillars, a curved upper lintel (kasagi)
// and a straight lower beam (nuki). Built facing +z, standing on y=0.
export function makeTorii({ height = 2.0, color = 0xd83b2a } = {}) {
  const gate = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.7 });
  const span = height * 0.78;
  const pillarR = height * 0.05;
  const pillar = (x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(pillarR * 0.85, pillarR, height, 12), mat);
    p.position.set(x, height / 2, 0);
    return p;
  };
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(span + pillarR * 4, height * 0.1, pillarR * 3.2), mat);
  kasagi.position.set(0, height - height * 0.05, 0);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(span + pillarR * 6, height * 0.05, pillarR * 2.2), mat);
  ridge.position.set(0, height + height * 0.03, 0);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(span + pillarR, height * 0.07, pillarR * 2), mat);
  nuki.position.set(0, height * 0.78, 0);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(pillarR * 2.4, height * 0.12, pillarR), mat);
  plaque.position.set(0, height * 0.89, 0);
  gate.add(pillar(-span / 2), pillar(span / 2), nuki, kasagi, ridge, plaque);
  return gate;
}

// A matte metal pipe (industrial loft accent). Horizontal by default.
export function makePipe(length, { color = 0x4a4640, radius = 0.05 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.7 })
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

// A bare warm Edison bulb on a short cord — exposed-fixture loft lighting.
export function makeEdisonPendant({ cord = 0.5, color = 0xffd9a0 } = {}) {
  const group = new THREE.Group();
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, cord, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a140e })
  );
  wire.position.y = -cord / 2;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4 })
  );
  bulb.position.y = -cord;
  bulb.scale.y = 1.35;
  group.add(wire, bulb);
  return group;
}

// A glowing Japanese vending machine: a dark metal body with a backlit display
// of drink cans on shelves and an accent trim. Floor-standing, faces +z.
export function makeVendingMachine({ width = 0.95, height = 1.85, depth = 0.5, accent = 0xff5fa2 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5, metalness: 0.4 })
  );
  body.position.y = height / 2;
  group.add(body);

  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#f5f3ee'; // bright backlit display
  g.fillRect(0, 0, 128, 200);
  const cans = ['#e8443b', '#3bb0e8', '#e8c23b', '#46c46a', '#e8743b', '#9b6be0'];
  for (let r = 0; r < 4; r++) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 10 + r * 46, 128, 4); // shelf line
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cans[(r * 5 + i) % cans.length];
      g.fillRect(6 + i * 20, 16 + r * 46, 14, 32);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.86, height * 0.66),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  display.position.set(0, height * 0.6, depth / 2 + 0.01);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: accent }));
  trim.position.set(0, height * 0.24, depth / 2 + 0.02);
  const tray = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.7, height * 0.12),
    new THREE.MeshBasicMaterial({ color: 0x080808 })
  );
  tray.position.set(0, height * 0.12, depth / 2 + 0.011);
  group.add(display, trim, tray);
  return group;
}

// A round diner wall clock: pale face, dark rim, two hands. Faces +z.
export function makeWallClock({ radius = 0.32 } = {}) {
  const group = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.6, emissive: 0x3a3018, emissiveIntensity: 0.4 })
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.09, 10, 36),
    new THREE.MeshStandardMaterial({ color: 0x17120c, metalness: 0.6, roughness: 0.4 })
  );
  rim.position.z = 0.01;
  const handMat = new THREE.MeshBasicMaterial({ color: 0x17120c });
  const makeHand = (len, ang) => {
    const h = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.022, 0.012), handMat);
    bar.position.x = len / 2;
    h.add(bar);
    h.rotation.z = ang;
    h.position.z = 0.02;
    return h;
  };
  group.add(face, rim, makeHand(radius * 0.55, Math.PI / 2 - 0.5), makeHand(radius * 0.82, Math.PI / 2 - 1.9));
  return group;
}

// A framed picture from an image file (e.g. a promo poster). Self-lit
// (MeshBasic) so it reads like a backlit lightbox in the dark night café.
const textureLoader = new THREE.TextureLoader();
export function makeImagePanel({ url, width, height, frame = '#15100a', frameDepth = 0.05 }) {
  const group = new THREE.Group();
  const tex = textureLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  const frameMesh = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, height + 0.08, frameDepth),
    new THREE.MeshStandardMaterial({ color: frame, roughness: 0.6 })
  );
  frameMesh.position.z = -frameDepth / 2 - 0.005;
  group.add(frameMesh, picture);
  return group;
}

// A framed city-skyline silhouette picture.
export function makeSkylinePanel({ width, height, sky = ['#2b3a5c', '#d98a4a'], buildings = '#10131c' }) {
  const cw = Math.round(width * PX_PER_METER);
  const ch = Math.round(height * PX_PER_METER);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, sky[0]);
  grad.addColorStop(1, sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  const heights = [0.5, 0.8, 0.62, 0.9, 0.55, 0.75, 0.6, 0.95, 0.7, 0.82, 0.58, 0.88];
  const bw = cw / heights.length;
  ctx.fillStyle = buildings;
  heights.forEach((h, i) => {
    ctx.fillRect(i * bw, ch * (1 - h * 0.8), bw * 0.86, ch);
  });
  // lit windows
  ctx.fillStyle = 'rgba(255, 214, 140, 0.8)';
  heights.forEach((h, i) => {
    for (let r = 0; r < Math.floor(h * 7); r++) {
      if ((i * 7 + r) % 3 === 0) continue; // leave some dark
      ctx.fillRect(i * bw + bw * 0.2, ch * (1 - h * 0.8) + 14 + r * 26, bw * 0.16, 10);
      ctx.fillRect(i * bw + bw * 0.55, ch * (1 - h * 0.8) + 14 + r * 26, bw * 0.16, 10);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Group();
  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.6 })
  );
  frame.position.z = -0.025;
  panel.add(frame, picture);
  return panel;
}
