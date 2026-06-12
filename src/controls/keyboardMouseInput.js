// WASD + pointer-lock mouse. Produces the normalized intent the player
// controller consumes: a move vector and an accumulated look delta.
export function createKeyboardMouseInput(domElement) {
  const keys = new Set();
  let lookDX = 0;
  let lookDY = 0;

  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  // Pointer lock survives tab switches but keyup events don't.
  window.addEventListener('blur', () => keys.clear());

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== domElement) return;
    lookDX += e.movementX;
    lookDY += e.movementY;
  });

  return {
    // x: strafe right +, y: forward +
    getMove() {
      const x = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    // Mouse look is per-event pixels, not a rate — consumed once per frame.
    consumeLookDelta() {
      const delta = { x: lookDX, y: lookDY };
      lookDX = 0;
      lookDY = 0;
      return delta;
    },
  };
}
