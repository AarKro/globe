const DEAD_ZONE = 0.15;

// Radial dead zone: ignore small drift, rescale the rest so movement ramps
// smoothly from zero at the dead-zone edge to full at stick extent.
function applyDeadZone(x, y) {
  const mag = Math.hypot(x, y);
  if (mag < DEAD_ZONE) return { x: 0, y: 0 };
  const scaled = Math.min((mag - DEAD_ZONE) / (1 - DEAD_ZONE), 1);
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

// Standard-mapping gamepad (Xbox): left stick moves, right stick looks.
// Gamepads must be polled — connected pads only expose fresh state via
// navigator.getGamepads() each frame.
export function createGamepadInput() {
  let padIndex = null;

  window.addEventListener('gamepadconnected', (e) => {
    if (padIndex === null) padIndex = e.gamepad.index;
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (padIndex === e.gamepad.index) padIndex = null;
  });

  return {
    // move: x strafe right +, y forward +. look: x/y as a rate in [-1, 1].
    // anyInput is true on any stick or button activity (used to dismiss the
    // start overlay without requiring a mouse click).
    getState() {
      const pad = padIndex !== null ? navigator.getGamepads()[padIndex] : null;
      if (!pad) return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, anyInput: false };

      const move = applyDeadZone(pad.axes[0], -pad.axes[1]);
      const look = applyDeadZone(pad.axes[2], pad.axes[3]);
      const anyInput =
        move.x !== 0 ||
        move.y !== 0 ||
        look.x !== 0 ||
        look.y !== 0 ||
        pad.buttons.some((b) => b.pressed);
      return { move, look, anyInput };
    },
  };
}
