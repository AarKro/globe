import * as THREE from 'three';

// Shared building blocks for theme decor. Everything is procedural —
// primitives + canvas textures — so themes need no extra model assets.

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
