import * as THREE from 'three';
import { THEMES } from './themes.js';

// Swaps the active city theme: retunes the existing lights and scene
// background, and replaces the theme's decor group. The core shop (room
// model, furniture, player) is never touched.
export function createThemeManager({ scene, lights, bounds }) {
  let decor = null;
  let current = null;

  const fill = lights.getObjectByName('fill');
  const key = lights.getObjectByName('key');
  const lamps = [];
  lights.traverse((o) => {
    if (o.isPointLight) lamps.push(o);
  });

  function disposeGroup(group) {
    group.traverse((o) => {
      o.geometry?.dispose();
      const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
  }

  return {
    get current() {
      return current;
    },
    has(id) {
      return Object.hasOwn(THEMES, id);
    },
    setTheme(id) {
      const theme = THEMES[id];
      if (!theme || id === current) return;

      if (decor) {
        scene.remove(decor);
        disposeGroup(decor);
      }
      decor = theme.buildDecor(bounds);
      decor.name = `decor-${id}`;
      scene.add(decor);

      const s = theme.lighting;
      scene.background = new THREE.Color(s.background);
      fill.color.set(s.fillSky);
      fill.groundColor.set(s.fillGround);
      fill.intensity = s.fillIntensity;
      key.color.set(s.keyColor);
      key.intensity = s.keyIntensity;
      lamps.forEach((lamp, i) => {
        lamp.color.set(s.lampColors[i % s.lampColors.length]);
        lamp.intensity = s.lampIntensity;
      });

      current = id;
    },
  };
}
