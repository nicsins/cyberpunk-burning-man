const STORAGE = "dp_binds_v1";

export const ACTIONS = [
  { id: "moveForward", label: "Move forward", hold: true },
  { id: "moveBack", label: "Move back", hold: true },
  { id: "moveLeft", label: "Move left", hold: true },
  { id: "moveRight", label: "Move right", hold: true },
  { id: "sprint", label: "Sprint", hold: true },
  { id: "flyUp", label: "Fly / jump up", hold: true },
  { id: "flyDown", label: "Fly down", hold: true },
  { id: "shoot", label: "Pulse gun" },
  { id: "bomb", label: "Throw boom" },
  { id: "interact", label: "Talk / use / light" },
  { id: "drone", label: "Ride drone" },
  { id: "dragon", label: "Ride dragon" },
  { id: "cloak", label: "Cloak app" },
  { id: "jammer", label: "Jammer app" },
  { id: "douse", label: "Drone water run" },
  { id: "bench", label: "Field bench" },
  { id: "gallery", label: "Gallery" },
  { id: "vision", label: "Vision" },
  { id: "help", label: "Ops brief" },
  { id: "controls", label: "Open this mapper" },
];

export const DEFAULT_KB = {
  moveForward: { type: "key", code: "KeyW" },
  moveBack: { type: "key", code: "KeyS" },
  moveLeft: { type: "key", code: "KeyA" },
  moveRight: { type: "key", code: "KeyD" },
  sprint: { type: "key", code: "ShiftLeft" },
  flyUp: { type: "key", code: "Space" },
  flyDown: { type: "key", code: "ControlLeft" },
  shoot: { type: "mouse", button: 0 },
  bomb: { type: "key", code: "KeyG" },
  interact: { type: "key", code: "KeyE" },
  drone: { type: "key", code: "KeyF" },
  dragon: { type: "key", code: "KeyR" },
  cloak: { type: "key", code: "KeyQ" },
  jammer: { type: "key", code: "KeyJ" },
  douse: { type: "key", code: "KeyX" },
  bench: { type: "key", code: "KeyC" },
  gallery: { type: "key", code: "KeyM" },
  vision: { type: "key", code: "KeyV" },
  help: { type: "key", code: "KeyH" },
  controls: { type: "key", code: "KeyP" },
};

export const DEFAULT_PAD = {
  moveForward: { type: "axis", axis: 1, dir: -1 },
  moveBack: { type: "axis", axis: 1, dir: 1 },
  moveLeft: { type: "axis", axis: 0, dir: -1 },
  moveRight: { type: "axis", axis: 0, dir: 1 },
  sprint: { type: "pad", button: 10 },
  flyUp: { type: "pad", button: 12 },
  flyDown: { type: "pad", button: 13 },
  shoot: { type: "pad", button: 7 },
  bomb: { type: "pad", button: 1 },
  interact: { type: "pad", button: 0 },
  drone: { type: "pad", button: 4 },
  dragon: { type: "pad", button: 5 },
  cloak: { type: "pad", button: 2 },
  jammer: { type: "pad", button: 3 },
  douse: { type: "pad", button: 6 },
  bench: { type: "pad", button: 14 },
  gallery: { type: "pad", button: 15 },
  vision: { type: "pad", button: 8 },
  help: { type: "pad", button: 11 },
  controls: { type: "pad", button: 9 },
};

const PAD_NAMES = {
  0: "A",
  1: "B",
  2: "X",
  3: "Y",
  4: "LB",
  5: "RB",
  6: "LT",
  7: "RT",
  8: "View",
  9: "Menu",
  10: "LS click",
  11: "RS click",
  12: "D-pad up",
  13: "D-pad down",
  14: "D-pad left",
  15: "D-pad right",
};

const MOUSE_NAMES = { 0: "Left click", 1: "Middle click", 2: "Right click" };

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (!raw) return { kb: clone(DEFAULT_KB), pad: clone(DEFAULT_PAD) };
    return {
      kb: { ...clone(DEFAULT_KB), ...(raw.kb || {}) },
      pad: { ...clone(DEFAULT_PAD), ...(raw.pad || {}) },
    };
  } catch {
    return { kb: clone(DEFAULT_KB), pad: clone(DEFAULT_PAD) };
  }
}

export const binds = loadSaved();

export function pretty(bind) {
  if (!bind) return "—";
  if (bind.type === "key") {
    return (bind.code || "")
      .replace("Key", "")
      .replace("Digit", "")
      .replace("Left", " L")
      .replace("Right", " R")
      .replace("Control", "Ctrl")
      .replace("Shift", "Shift")
      .replace("Space", "Space");
  }
  if (bind.type === "mouse") return MOUSE_NAMES[bind.button] || `Mouse ${bind.button}`;
  if (bind.type === "pad") return PAD_NAMES[bind.button] || `Btn ${bind.button}`;
  if (bind.type === "axis") {
    const stick = bind.axis <= 1 ? "Left stick" : "Right stick";
    const names = { 0: "left", 1: "right", "-1": "up", 1: "down" };
    const dir = bind.axis % 2 === 0
      ? (bind.dir < 0 ? "left" : "right")
      : (bind.dir < 0 ? "up" : "down");
    return `${stick} ${dir}`;
  }
  return "—";
}

export const input = {
  scheme: "kb",
  padId: null,
  padIndex: -1,
  capturing: false,
  captureAction: null,
  captured: null,
  held: {},
  padHeld: {},
  lookX: 0,
  lookY: 0,
  handlers: {},
};

export function onAction(id, fn) {
  input.handlers[id] = fn;
}

export function fire(id) {
  const fn = input.handlers[id];
  if (fn) fn();
}

export function held(id) {
  const kb = binds.kb[id];
  if (kb?.type === "key" && input.held[kb.code]) return true;
  if (kb?.type === "mouse" && input.held[`mouse${kb.button}`]) return true;
  return !!input.padHeld[id];
}

export function lookAxes() {
  return { x: input.lookX, y: input.lookY };
}

function firstPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] && pads[i].connected) return pads[i];
  }
  return null;
}

export function pollGamepad() {
  const pad = firstPad();
  if (!pad) {
    if (input.padId) {
      input.padId = null;
      input.padIndex = -1;
      input.scheme = "kb";
    }
    input.lookX = 0;
    input.lookY = 0;
    Object.keys(input.padHeld).forEach((k) => { input.padHeld[k] = false; });
    return;
  }
  input.padId = pad.id;
  input.padIndex = pad.index;
  if (!input.capturing) input.scheme = "pad";

  const dead = 0.28;
  const lx = Math.abs(pad.axes[0] || 0) > dead ? pad.axes[0] : 0;
  const ly = Math.abs(pad.axes[1] || 0) > dead ? pad.axes[1] : 0;
  const rx = Math.abs(pad.axes[2] || 0) > dead ? pad.axes[2] : 0;
  const ry = Math.abs(pad.axes[3] || 0) > dead ? pad.axes[3] : 0;
  input.lookX = rx;
  input.lookY = ry;

  if (input.capturing) {
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed && pad.buttons[i].value > 0.55) {
        input.captured = { type: "pad", button: i };
        renderCapture();
        return;
      }
    }
    if (Math.abs(lx) > 0.7) {
      input.captured = { type: "axis", axis: 0, dir: lx < 0 ? -1 : 1 };
      renderCapture();
    } else if (Math.abs(ly) > 0.7) {
      input.captured = { type: "axis", axis: 1, dir: ly < 0 ? -1 : 1 };
      renderCapture();
    }
    return;
  }

  ACTIONS.forEach((a) => {
    const b = binds.pad[a.id];
    if (!b) return;
    let down = false;
    if (b.type === "pad") {
      const btn = pad.buttons[b.button];
      down = !!(btn && (btn.pressed || btn.value > 0.45));
    } else if (b.type === "axis") {
      const v = pad.axes[b.axis] || 0;
      down = v * b.dir > 0.35;
    }
    const was = !!input.padHeld[a.id];
    input.padHeld[a.id] = down;
    if (down && !was && !a.hold) fire(a.id);
  });
}

function renderCapture() {
  const box = document.getElementById("bind-capture");
  if (box) box.value = pretty(input.captured);
}

export function startCapture(actionId) {
  input.capturing = true;
  input.captureAction = actionId;
  input.captured = null;
  renderCapture();
  const hint = document.getElementById("bind-hint");
  if (hint) hint.textContent = `Listening for ${ACTIONS.find((a) => a.id === actionId)?.label || actionId} — press a key, click, or tap a controller button.`;
}

export function saveCapture() {
  if (!input.captureAction || !input.captured) return false;
  const scheme = document.getElementById("bind-scheme")?.value || "kb";
  if (scheme === "pad") binds.pad[input.captureAction] = input.captured;
  else binds.kb[input.captureAction] = input.captured;
  persist();
  input.capturing = false;
  return true;
}

export function resetScheme(scheme) {
  if (scheme === "pad") binds.pad = clone(DEFAULT_PAD);
  else binds.kb = clone(DEFAULT_KB);
  persist();
}

function persist() {
  localStorage.setItem(STORAGE, JSON.stringify({ kb: binds.kb, pad: binds.pad }));
}

export function bindLabel(actionId, scheme) {
  return pretty((scheme === "pad" ? binds.pad : binds.kb)[actionId]);
}

export function attachListeners(opts) {
  const isBlocked = opts.isBlocked || (() => false);

  window.addEventListener("gamepadconnected", (e) => {
    input.padId = e.gamepad.id;
    input.padIndex = e.gamepad.index;
    input.scheme = "pad";
    if (opts.onPad) opts.onPad(e.gamepad);
  });
  window.addEventListener("gamepaddisconnected", () => {
    input.padId = null;
    if (opts.onPad) opts.onPad(null);
  });

  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (input.capturing) {
      e.preventDefault();
      if (e.code === "Escape") {
        input.capturing = false;
        input.captured = null;
        renderCapture();
        return;
      }
      input.captured = { type: "key", code: e.code };
      renderCapture();
      return;
    }
    input.held[e.code] = true;
    if (isBlocked()) return;
    const hit = Object.entries(binds.kb).find(([, b]) => b.type === "key" && b.code === e.code);
    if (hit) {
      const meta = ACTIONS.find((a) => a.id === hit[0]);
      if (meta && !meta.hold) fire(hit[0]);
    }
  });

  document.addEventListener("keyup", (e) => {
    input.held[e.code] = false;
  });

  document.addEventListener("mousedown", (e) => {
    if (input.capturing) {
      input.captured = { type: "mouse", button: e.button };
      renderCapture();
      e.preventDefault();
      return;
    }
    input.held[`mouse${e.button}`] = true;
    if (isBlocked()) return;
    const hit = Object.entries(binds.kb).find(([, b]) => b.type === "mouse" && b.button === e.button);
    if (hit) {
      const meta = ACTIONS.find((a) => a.id === hit[0]);
      if (meta && !meta.hold) fire(hit[0]);
    }
  });

  document.addEventListener("mouseup", (e) => {
    input.held[`mouse${e.button}`] = false;
  });
}

export function buildMapper() {
  const list = document.getElementById("bind-list");
  if (!list) return;
  const scheme = document.getElementById("bind-scheme")?.value || "kb";
  list.innerHTML = "";
  ACTIONS.forEach((a) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bind-row" + (input.captureAction === a.id ? " active" : "");
    row.innerHTML = `<span>${a.label}</span><kbd>${bindLabel(a.id, scheme)}</kbd>`;
    row.onclick = () => {
      list.querySelectorAll(".bind-row").forEach((r) => r.classList.remove("active"));
      row.classList.add("active");
      startCapture(a.id);
    };
    list.appendChild(row);
  });
}
