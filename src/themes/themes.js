import * as THREE from 'three';
import {
  makeTextPanel,
  makeNeonTube,
  makeLantern,
  makeBulbString,
  makeSkylinePanel,
  makeTorii,
  makePipe,
  makeEdisonPendant,
} from './decor.js';

// City themes. Each theme keeps the core shop untouched and contributes:
// - `lighting`: colors/intensities applied to the existing lights
// - `buildDecor(bounds)`: a self-contained decor group placed against the
//   walls and ceiling (never in the walking area)
// Adding next month's city = one more entry here.

// Mount points measured against the loaded room model (world meters,
// interior x -7.19..4.79, z -6.0..6.0, walls ≈ 2.35 high, no ceiling
// mesh). The back (+z) wall is glass (window) left of the counter, solid
// near x 0. Decor sits ~0.1 m proud of the walls to avoid z-fighting.
// Re-measure if the room GLB changes.
const BACK_WALL_Z = 5.88;
const LEFT_WALL_X = -7.05;

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

      // Vertical neon sign on the clear section of the back wall.
      const sign = makeTextPanel({
        text: 'グローブ珈琲',
        width: 0.5,
        height: 1.8,
        vertical: true,
        background: '#14101e',
        color: '#7df4ff',
        border: '#ff5fa2',
        glow: '#ff5fa2',
        fontFamily: JP_FONT,
      });
      sign.position.set(-1.8, 1.3, BACK_WALL_Z);
      sign.rotation.y = Math.PI;
      decor.add(sign);

      // Neon tube accents along the tops of the back and left walls.
      const backTube = makeNeonTube(6, 0xff5fa2);
      backTube.position.set(-3, 2.28, BACK_WALL_Z - 0.02);
      const sideTube = makeNeonTube(8, 0x4fd8ff);
      sideTube.rotation.y = Math.PI / 2;
      sideTube.position.set(LEFT_WALL_X, 2.28, 0);
      decor.add(backTube, sideTube);

      // Rows of paper lanterns over the seating area.
      [-1.2, -4.0].forEach((z) => {
        for (let x = -5; x <= 4; x += 2.25) {
          const lantern = makeLantern(0xff6b5e, 0xff8a3c);
          lantern.position.set(x, 2.0, z);
          decor.add(lantern);
        }
      });

      // Noren-style hanging banners above the left wall bar.
      ['珈', '琲'].forEach((char, i) => {
        const banner = makeTextPanel({
          text: char,
          width: 0.55,
          height: 0.9,
          background: '#a32638',
          color: '#f3e9dc',
          fontFamily: JP_FONT,
        });
        banner.position.set(LEFT_WALL_X, 1.65, -3.4 + i * 1.1);
        banner.rotation.y = Math.PI / 2;
        decor.add(banner);
      });

      // A stacked neon signboard tower on the back wall — the unmistakable
      // Shinjuku alley look: small kanji plates glowing in clashing colors.
      const stack = [
        { text: '酒', color: '#ff4d6d', border: '#ffd23f' },
        { text: '麺', color: '#4dffd2', border: '#ff4d6d' },
        { text: '茶', color: '#ffd23f', border: '#4dd2ff' },
        { text: '酎', color: '#c77dff', border: '#7df4ff' },
      ];
      stack.forEach((s, i) => {
        const plate = makeTextPanel({
          text: s.text,
          width: 0.62,
          height: 0.52,
          background: '#0c0a12',
          color: s.color,
          border: s.border,
          glow: s.color,
          fontFamily: JP_FONT,
        });
        plate.position.set(3.1, 2.15 - i * 0.56, BACK_WALL_Z);
        plate.rotation.y = Math.PI;
        decor.add(plate);
      });

      // Pink/cyan neon framing the tall street window (-z wall) so it pops.
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

      // A vermilion torii standing in the open back-centre of the room.
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

      // Bulb-rimmed marquee on the clear section of the back wall.
      const marquee = new THREE.Group();
      const board = makeTextPanel({
        text: 'GLOBE CAFÉ',
        width: 2.3,
        height: 0.6,
        background: '#0d0b09',
        color: '#ffe9c9',
        border: '#e8b86d',
        fontFamily: NY_FONT,
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
      marquee.position.set(-1.8, 1.85, BACK_WALL_Z);
      marquee.rotation.y = Math.PI;
      decor.add(marquee);

      // Subway-style station sign above the left wall bar.
      const subway = makeTextPanel({
        text: '● GLOBE ST STATION',
        width: 2.2,
        height: 0.45,
        background: '#0a0a0a',
        color: '#ffffff',
        border: '#ffffff',
        fontFamily: 'Helvetica, Arial, sans-serif',
      });
      subway.position.set(LEFT_WALL_X, 1.7, -0.9);
      subway.rotation.y = Math.PI / 2;
      decor.add(subway);

      // Framed Manhattan skyline at dusk, further down the same wall.
      const skyline = makeSkylinePanel({ width: 2.6, height: 1.2 });
      skyline.position.set(LEFT_WALL_X, 1.6, -3.3);
      skyline.rotation.y = Math.PI / 2;
      decor.add(skyline);

      // Warm string lights criss-crossing the ceiling above the seating.
      decor.add(
        makeBulbString([-6.5, 2.3, -4.2], [4.3, 2.2, -0.5], { count: 16, sag: 0.35 }),
        makeBulbString([-6.5, 2.25, 1.5], [4.3, 2.3, -2.5], { count: 16, sag: 0.3 })
      );

      // Red neon "OPEN" diner sign on the back wall.
      const open = makeTextPanel({
        text: 'OPEN',
        width: 1.0,
        height: 0.42,
        background: '#0b0908',
        color: '#ff5a4d',
        border: '#5ad1ff',
        glow: '#ff5a4d',
        fontFamily: 'Georgia, "Times New Roman", serif',
      });
      open.position.set(3.2, 2.05, BACK_WALL_Z);
      open.rotation.y = Math.PI;
      decor.add(open);

      // Exposed Edison-bulb pendants on a rail down the centre of the room —
      // the warm loft fixture that defines the look.
      [-3.4, -1.4, 0.6].forEach((z) => {
        const pendant = makeEdisonPendant({ cord: 0.55 });
        pendant.position.set(-1.2, 2.3, z);
        decor.add(pendant);
      });

      // Industrial steam pipes running along the top of the left wall.
      const pipes = new THREE.Group();
      const runA = makePipe(7.5, { radius: 0.06 });
      runA.rotation.set(Math.PI / 2, 0, 0); // run along z (cylinder is along Y)
      runA.position.set(LEFT_WALL_X + 0.12, 2.18, -1.2);
      const runB = makePipe(7.5, { radius: 0.045, color: 0x6b4a2a });
      runB.rotation.set(Math.PI / 2, 0, 0);
      runB.position.set(LEFT_WALL_X + 0.12, 1.95, -1.2);
      // A couple of elbow drops so the run reads as plumbing, not a bar.
      [-3.6, 1.4].forEach((z) => {
        const drop = makePipe(0.55, { radius: 0.045 });
        drop.rotation.set(0, 0, 0); // vertical
        drop.position.set(LEFT_WALL_X + 0.12, 1.7, z);
        pipes.add(drop);
      });
      pipes.add(runA, runB);
      decor.add(pipes);

      // A green NYC street sign high on the back wall.
      const street = makeTextPanel({
        text: 'GLOBE AVE',
        width: 1.4,
        height: 0.34,
        background: '#0a5a2f',
        color: '#ffffff',
        border: '#ffffff',
        fontFamily: 'Helvetica, Arial, sans-serif',
      });
      street.position.set(-4.6, 2.18, BACK_WALL_Z);
      street.rotation.y = Math.PI;
      decor.add(street);

      return decor;
    },
  },
};
