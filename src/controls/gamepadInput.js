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
  let prevPressed = []; // last frame's button states, for rising-edge detection

  window.addEventListener('gamepadconnected', (e) => {
    if (padIndex === null) padIndex = e.gamepad.index;
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (padIndex === e.gamepad.index) {
      padIndex = null;
      prevPressed = [];
    }
  });

  return {
    // move: x strafe right +, y forward +. look: x/y as a rate in [-1, 1].
    // anyInput is true on any stick or button activity (used to dismiss the
    // start overlay without requiring a mouse click). justPressed is the list
    // of button indices that went down *this frame* (standard mapping: A=0, B=1,
    // X=2, Y=3 …) for edge-triggered actions. Poll once per frame.
    getState() {
      const pad = padIndex !== null ? navigator.getGamepads()[padIndex] : null;
      if (!pad) {
        prevPressed = [];
        return { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, anyInput: false, justPressed: [] };
      }

      const move = applyDeadZone(pad.axes[0], -pad.axes[1]);
      const look = applyDeadZone(pad.axes[2], pad.axes[3]);

      const justPressed = [];
      pad.buttons.forEach((b, i) => {
        if (b.pressed && !prevPressed[i]) justPressed.push(i);
      });
      prevPressed = pad.buttons.map((b) => b.pressed);

      const anyInput =
        move.x !== 0 || move.y !== 0 || look.x !== 0 || look.y !== 0 || prevPressed.some(Boolean);
      return { move, look, anyInput, justPressed };
    },
  };
}
