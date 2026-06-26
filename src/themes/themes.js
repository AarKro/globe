import * as THREE from 'three';
import {
  makeTextPanel,
  makeNeonTube,
  makeBulbString,
  makeSkylinePanel,
  makeTorii,
  makePipe,
  makeEdisonPendant,
  makeImagePanel,
  makeVendingMachine,
  makeWallClock,
  addPaperLanterns,
} from './decor.js';

// Theme poster art (Vite resolves these to hashed URLs).
const JP_POSTERS = {
  japan: new URL('../assets/images/japan_2.png', import.meta.url).href,
  drink: new URL('../assets/images/japan_drink.png', import.meta.url).href,
};
const NY_POSTERS = {
  newyork: new URL('../assets/images/new-york.png', import.meta.url).href,
};

// City themes. Each theme keeps the core shop untouched and contributes:
// - `lighting`: colors/intensities applied to the existing lights
// - `buildDecor(bounds)`: a self-contained decor group placed against the
//   walls and ceiling (never in the walking area)
// Adding next month's city = one more entry here.

// Wall mount lines (world meters), measured against room_without_tunnel_and_door
// (interior x ≈ ±5.99, z ≈ ±5.9; walls ~2.4 high). Decor sits a touch proud of
// each wall, facing into the room. Avoid: the −z window wall (street video), the
// −x doorway band (z 3.6..5.95, the tunnel), and the bar (counter + shelves at
// +x/+z, roughly x>2.3 & z>2.3). Re-measure if the room GLB changes.
const BACK_WALL_Z = 5.88; // +z wall, decor faces −z (rotation.y = π)
const LEFT_WALL_X = -5.85; // −x wall, decor faces +x (rotation.y = π/2)
const RIGHT_WALL_X = 5.85; // +x wall, decor faces −x (rotation.y = −π/2)

const JP_FONT = '"Hiragino Sans", "Yu Gothic", sans-serif';
const NY_FONT = 'Futura, "Helvetica Neue", Arial, sans-serif';

export const THEMES = {
  tokyo: {
    label: 'Tokyo',
    lighting: {
      background: 0x0b0e1a,
      fillSky: 0xcfd8ff,
      fillGround: 0x2a2440,
      fillIntensity: 1.7,
      keyColor: 0x9fb8ff,
      keyIntensity: 1.0,
      lampColors: [0xff5fa2, 0x4fd8ff],
      lampIntensity: 10,
    },
    buildDecor() {
      const decor = new THREE.Group();
      const plate = (text, color, border) =>
        makeTextPanel({ text, width: 0.62, height: 0.54, background: '#0c0a12', color, border, glow: color, fontFamily: JP_FONT });

      // ---- BACK wall (+z): the vertical hero sign + the Japan posters --------
      const sign = makeTextPanel({
        text: 'グローブ珈琲', width: 0.5, height: 1.8, vertical: true,
        background: '#14101e', color: '#7df4ff', border: '#ff5fa2', glow: '#ff5fa2', fontFamily: JP_FONT,
      });
      sign.position.set(-0.3, 1.3, BACK_WALL_Z);
      sign.rotation.y = Math.PI;
      decor.add(sign);

      [
        { url: JP_POSTERS.japan, aspect: 673 / 952, x: -2.6 },
        { url: JP_POSTERS.drink, aspect: 635 / 952, x: -3.85 },
      ].forEach((p) => {
        const h = 1.4;
        const panel = makeImagePanel({ url: p.url, width: h * p.aspect, height: h });
        panel.position.set(p.x, 1.45, BACK_WALL_Z);
        panel.rotation.y = Math.PI;
        decor.add(panel);
      });

      // ---- Neon tubes rimming the tops of all three solid walls -------------
      const backTube = makeNeonTube(7.5, 0xff5fa2);
      backTube.position.set(-1.5, 2.32, BACK_WALL_Z - 0.02);
      const leftTube = makeNeonTube(8.5, 0x4fd8ff);
      leftTube.rotation.y = Math.PI / 2;
      leftTube.position.set(LEFT_WALL_X + 0.02, 2.32, -1);
      const rightTube = makeNeonTube(6.5, 0xffd23f);
      rightTube.rotation.y = Math.PI / 2;
      rightTube.position.set(RIGHT_WALL_X - 0.02, 2.32, -2.2);
      decor.add(backTube, leftTube, rightTube);

      // ---- LEFT wall (−x): noren banners, two neon plates, a vending machine -
      ['珈', '琲'].forEach((char, i) => {
        const banner = makeTextPanel({ text: char, width: 0.55, height: 0.9, background: '#a32638', color: '#f3e9dc', fontFamily: JP_FONT });
        banner.position.set(LEFT_WALL_X, 1.65, -3.4 + i * 1.1);
        banner.rotation.y = Math.PI / 2;
        decor.add(banner);
      });
      [
        { p: plate('寿司', '#ff4d6d', '#ffd23f'), z: -0.4 },
        { p: plate('茶', '#4dffd2', '#ff4d6d'), z: 0.7 },
      ].forEach(({ p, z }) => {
        p.position.set(LEFT_WALL_X, 1.78, z);
        p.rotation.y = Math.PI / 2;
        decor.add(p);
      });
      const vending = makeVendingMachine({ accent: 0x4fd8ff });
      vending.position.set(LEFT_WALL_X - 0.05, 0, -4.85);
      vending.rotation.y = Math.PI / 2;
      decor.add(vending);

      // ---- RIGHT wall (+x): the stacked Shinjuku signboard + a vertical sign -
      [
        plate('酒', '#ff4d6d', '#ffd23f'),
        plate('麺', '#4dffd2', '#ff4d6d'),
        plate('茶', '#ffd23f', '#4dd2ff'),
        plate('酎', '#c77dff', '#7df4ff'),
      ].forEach((p, i) => {
        p.position.set(RIGHT_WALL_X, 2.12 - i * 0.58, -3.4);
        p.rotation.y = -Math.PI / 2;
        decor.add(p);
      });
      const ramen = makeTextPanel({
        text: 'ラーメン', width: 0.5, height: 1.5, vertical: true,
        background: '#14101e', color: '#ffd23f', border: '#ff4d6d', glow: '#ffd23f', fontFamily: JP_FONT,
      });
      ramen.position.set(RIGHT_WALL_X, 1.2, -0.8);
      ramen.rotation.y = -Math.PI / 2;
      decor.add(ramen);

      // ---- Paper lanterns (GLB) hung in three rows over the seating ---------
      const lanternSpots = [];
      [-1.2, -3.0, -4.6].forEach((z) => {
        for (let x = -5; x <= 4; x += 2.25) lanternSpots.push([x, 2.0, z]);
      });
      addPaperLanterns(decor, lanternSpots);

      // ---- Pink/cyan neon framing the tall street window (−z wall) ----------
      const winFrame = new THREE.Group();
      const fTop = makeNeonTube(6.0, 0xff5fa2);
      fTop.position.set(1.8, 2.42, 0);
      const fBot = makeNeonTube(6.0, 0x4fd8ff);
      fBot.position.set(1.8, 0.42, 0);
      const fL = makeNeonTube(2.0, 0x7df4ff);
      fL.rotation.set(0, 0, 0); // vertical (cylinder is along Y by default)
      fL.position.set(-1.2, 1.42, 0);
      const fR = fL.clone();
      fR.position.x = 4.8;
      winFrame.add(fTop, fBot, fL, fR);
      winFrame.position.set(0, 0, -5.82);
      decor.add(winFrame);

      // ---- A vermilion torii standing in the open back-centre of the room ---
      const torii = makeTorii({ height: 2.05, color: 0xe23b2a });
      torii.position.set(-0.3, 0, 4.4);
      torii.rotation.y = Math.PI;
      decor.add(torii);

      return decor;
    },
  },

  newyork: {
    label: 'New York',
    lighting: {
      background: 0x171210,
      fillSky: 0xffe9c9,
      fillGround: 0x3a2c1c,
      fillIntensity: 2.2,
      keyColor: 0xffd9a0,
      keyIntensity: 1.6,
      lampColors: [0xffb45f],
      lampIntensity: 9,
    },
    buildDecor() {
      const decor = new THREE.Group();

      // ---- BACK wall (+z): bulb marquee, the NY poster, the street sign ------
      const marquee = new THREE.Group();
      const board = makeTextPanel({
        text: 'GLOBE CAFÉ', width: 2.3, height: 0.6,
        background: '#0d0b09', color: '#ffe9c9', border: '#e8b86d', fontFamily: NY_FONT,
      });
      marquee.add(board);
      const bulbGeo = new THREE.SphereGeometry(0.03, 8, 6);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      const perEdge = 12;
      for (let i = 0; i <= perEdge; i++) {
        const x = -1.15 + (2.3 * i) / perEdge;
        [[x, 0.34], [x, -0.34]].forEach(([bx, by]) => {
          const bulb = new THREE.Mesh(bulbGeo, bulbMat);
          bulb.position.set(bx, by, 0.02);
          marquee.add(bulb);
        });
      }
      marquee.position.set(-1.5, 1.9, BACK_WALL_Z);
      marquee.rotation.y = Math.PI;
      decor.add(marquee);

      const nyPoster = makeImagePanel({ url: NY_POSTERS.newyork, width: 1.6 * (1024 / 1536), height: 1.6 });
      nyPoster.position.set(-3.9, 1.45, BACK_WALL_Z);
      nyPoster.rotation.y = Math.PI;
      decor.add(nyPoster);

      const street = makeTextPanel({
        text: 'GLOBE AVE', width: 1.4, height: 0.34,
        background: '#0a5a2f', color: '#ffffff', border: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif',
      });
      street.position.set(0.9, 2.15, BACK_WALL_Z);
      street.rotation.y = Math.PI;
      decor.add(street);

      // ---- LEFT wall (−x): subway sign, framed skyline, steam pipes ---------
      const subway = makeTextPanel({
        text: '● GLOBE ST STATION', width: 2.2, height: 0.45,
        background: '#0a0a0a', color: '#ffffff', border: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif',
      });
      subway.position.set(LEFT_WALL_X, 1.75, -0.6);
      subway.rotation.y = Math.PI / 2;
      decor.add(subway);

      const skyline = makeSkylinePanel({ width: 2.6, height: 1.2 });
      skyline.position.set(LEFT_WALL_X, 1.55, -3.5);
      skyline.rotation.y = Math.PI / 2;
      decor.add(skyline);

      const pipes = new THREE.Group();
      const runA = makePipe(8, { radius: 0.06 });
      runA.rotation.set(Math.PI / 2, 0, 0); // run along z (cylinder is along Y)
      runA.position.set(LEFT_WALL_X + 0.12, 2.2, -1.5);
      const runB = makePipe(8, { radius: 0.045, color: 0x6b4a2a });
      runB.rotation.set(Math.PI / 2, 0, 0);
      runB.position.set(LEFT_WALL_X + 0.12, 1.98, -1.5);
      [-4.2, 1.6].forEach((z) => {
        const drop = makePipe(0.55, { radius: 0.045 });
        drop.rotation.set(0, 0, 0); // vertical
        drop.position.set(LEFT_WALL_X + 0.12, 1.72, z);
        pipes.add(drop);
      });
      pipes.add(runA, runB);
      decor.add(pipes);

      // ---- RIGHT wall (+x): OPEN neon, a diner clock, a COFFEE sign ---------
      const open = makeTextPanel({
        text: 'OPEN', width: 1.0, height: 0.42,
        background: '#0b0908', color: '#ff5a4d', border: '#5ad1ff', glow: '#ff5a4d', fontFamily: 'Georgia, "Times New Roman", serif',
      });
      open.position.set(RIGHT_WALL_X, 2.0, -0.8);
      open.rotation.y = -Math.PI / 2;
      decor.add(open);

      const clock = makeWallClock({ radius: 0.34 });
      clock.position.set(RIGHT_WALL_X, 1.85, -2.6);
      clock.rotation.y = -Math.PI / 2;
      decor.add(clock);

      const coffee = makeTextPanel({
        text: 'COFFEE', width: 1.4, height: 0.4,
        background: '#0b0908', color: '#ffb45f', border: '#ffe0b0', glow: '#ffb45f', fontFamily: NY_FONT,
      });
      coffee.position.set(RIGHT_WALL_X, 1.5, -4.4);
      coffee.rotation.y = -Math.PI / 2;
      decor.add(coffee);

      // ---- Exposed Edison-bulb pendants (two columns over the seating) ------
      [
        { x: -1.2, zs: [-3.4, -1.4, 0.6] },
        { x: 1.5, zs: [-2.4, -0.2] },
      ].forEach(({ x, zs }) => {
        zs.forEach((z) => {
          const pendant = makeEdisonPendant({ cord: 0.55 });
          pendant.position.set(x, 2.3, z);
          decor.add(pendant);
        });
      });

      // ---- Warm string lights criss-crossing the ceiling -------------------
      decor.add(
        makeBulbString([-6.5, 2.3, -4.2], [4.3, 2.2, -0.5], { count: 16, sag: 0.35 }),
        makeBulbString([-6.5, 2.25, 1.5], [4.3, 2.3, -2.5], { count: 16, sag: 0.3 }),
        makeBulbString([-6.5, 2.28, -1.2], [4.3, 2.28, 2.0], { count: 16, sag: 0.32 })
      );

      return decor;
    },
  },
};
