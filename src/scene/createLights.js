import * as THREE from 'three';
import { ROOM } from './constants.js';

// Warm café lighting: hemisphere fill, one key light angled in through the
// window wall, and two warm point lights matching the hanging lamp bulbs.
export function createLights() {
  const lights = new THREE.Group();
  lights.name = 'lights';

  const fill = new THREE.HemisphereLight(0xfff1dd, 0x4a3522, 0.7);
  fill.name = 'fill';
  lights.add(fill);

  const key = new THREE.DirectionalLight(0xffd9a0, 1.1);
  key.name = 'key';
  key.position.set(-ROOM.width / 2 - 1, ROOM.height + 1, 1.5);
  key.target.position.set(1.5, 0, -0.5);
  lights.add(key, key.target);

  [-2.6, 2.4].forEach((x, i) => {
    const lamp = new THREE.PointLight(0xffc873, 6, 6, 2);
    lamp.name = `lamp${i}`;
    lamp.position.set(x, ROOM.height - 0.8, 1.4);
    lights.add(lamp);
  });

  return lights;
}
