import * as THREE from 'three';

// Warm café lighting, positioned relative to the walkable bounds so it works
// for both the placeholder room and a loaded GLTF room.
export function createLights(bounds) {
  const lights = new THREE.Group();
  lights.name = 'lights';

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  const fill = new THREE.HemisphereLight(0xfff1dd, 0x4a3522, 2.2);
  fill.name = 'fill';
  lights.add(fill);

  const key = new THREE.DirectionalLight(0xffd9a0, 1.6);
  key.name = 'key';
  key.position.set(centerX - spanX / 2, 4, centerZ + spanZ / 4);
  key.target.position.set(centerX, 0, centerZ);
  lights.add(key, key.target);

  // Two warm ceiling-height fills over the seating area.
  [-0.22, 0.22].forEach((t, i) => {
    const lamp = new THREE.PointLight(0xffc873, 8, 10, 2);
    lamp.name = `lamp${i}`;
    lamp.position.set(centerX + spanX * t, 2.2, centerZ + spanZ * t * 0.5);
    lights.add(lamp);
  });

  return lights;
}
