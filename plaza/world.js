import * as THREE from "three";
import {
  attachListeners, pollGamepad, onAction, held, lookAxes, input,
  buildMapper, saveCapture, resetScheme, bindLabel,
} from "./controls.js";

const canvas = document.getElementById("world");
const $ = (id) => document.getElementById(id);

const state = {
  species: "panda",
  hp: 100,
  ammo: 18,
  bombs: 3,
  scrap: 4,
  kindlingHeld: 0,
  cloak: 0,
  ward: 0,
  jammer: 0,
  readiness: 0,
  phase: "defend", // defend | burn | aftermath
  fire: 0,
  lit: false,
  ceremonial: false,
  consumed: false,
  talked: new Set(),
  pads: new Set(),
  mounted: null, // null | drone | dragon
  weapon: false,
  pointer: false,
  yaw: 0,
  pitch: 0.28,
};

const npcTalk = { open: false, id: null };

function uiOpen() {
  return ["talk", "gallery", "vision", "contact", "craft", "help", "controls"]
    .some((id) => !$(id).classList.contains("hidden"));
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040a);
scene.fog = new THREE.FogExp2(0x050712, 0.018);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
const clock = new THREE.Clock();

scene.add(new THREE.AmbientLight(0x446688, 0.55));
const neon = new THREE.PointLight(0x2ef6ff, 2.2, 40);
neon.position.set(0, 8, 0);
scene.add(neon);
const pink = new THREE.PointLight(0xff2ea6, 1.6, 36);
pink.position.set(8, 6, -6);
scene.add(pink);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(70, 64),
  new THREE.MeshStandardMaterial({ color: 0x0a1020, metalness: 0.3, roughness: 0.7 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const grid = new THREE.GridHelper(80, 40, 0x2ef6ff, 0x142033);
grid.position.y = 0.02;
scene.add(grid);

function ring(r, color) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.06, 8, 80),
    new THREE.MeshBasicMaterial({ color })
  );
  m.rotation.x = Math.PI / 2;
  m.position.y = 0.05;
  scene.add(m);
}
ring(8, 0x2ef6ff);
ring(16, 0xff2ea6);
ring(24, 0xb56bff);

function boxBuilding(x, z, h, color) {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, h, 2.2),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, metalness: 0.6, roughness: 0.35 })
  );
  b.position.set(x, h / 2, z);
  scene.add(b);
}
for (let i = 0; i < 28; i++) {
  const a = (i / 28) * Math.PI * 2;
  boxBuilding(Math.cos(a) * 38, Math.sin(a) * 38, 3 + (i % 5) * 2.2, i % 2 ? 0x12203a : 0x2a1030);
}

const orbs = [];
for (let i = 0; i < 12; i++) {
  const o = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshBasicMaterial({ color: i % 2 ? 0x2ef6ff : 0xff2ea6 })
  );
  o.userData = { a: Math.random() * Math.PI * 2, r: 10 + Math.random() * 16, y: 2 + Math.random() * 4 };
  orbs.push(o);
  scene.add(o);
}

function makeEffigy() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 8), wood);
  pole.position.y = 3.5;
  const arms = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 0.35), wood);
  arms.position.y = 5.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), wood);
  head.position.y = 7.2;
  const glow = new THREE.PointLight(0xff6b2e, 0, 18);
  glow.position.y = 4;
  g.add(pole, arms, head, glow);
  g.userData.glow = glow;
  g.position.set(0, 0, 0);
  scene.add(g);
  return g;
}
const effigy = makeEffigy();

const firePts = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(180), 3)),
  new THREE.PointsMaterial({ color: 0xff7a2e, size: 0.18, transparent: true, opacity: 0 })
);
firePts.position.y = 2;
scene.add(firePts);

function figure(kind) {
  const g = new THREE.Group();
  if (kind === "panda") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    belly.position.set(0, -0.05, 0.22);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }));
    head.position.y = 0.72;
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshStandardMaterial({ color: 0x111 }));
    const earR = earL.clone();
    earL.position.set(-0.26, 1.0, 0);
    earR.position.set(0.26, 1.0, 0);
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0x111 }));
    const patch2 = patch.clone();
    patch.position.set(-0.14, 0.76, 0.3);
    patch2.position.set(0.14, 0.76, 0.3);
    g.add(body, belly, head, earL, earR, patch, patch2);
  } else {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a8a4a, emissive: 0x062010, emissiveIntensity: 0.4 }));
    body.position.y = 0.7;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0x3cb86a }));
    head.position.set(0, 1.45, 0.1);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0x226633 }));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.4, 0.38);
    const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 3), new THREE.MeshStandardMaterial({ color: 0xff2ea6, emissive: 0xff2ea6, emissiveIntensity: 0.25 }));
    const wingR = wingL.clone();
    wingL.rotation.z = 1.1;
    wingR.rotation.z = -1.1;
    wingL.position.set(-0.55, 0.9, 0);
    wingR.position.set(0.55, 0.9, 0);
    g.add(body, head, snout, wingL, wingR);
  }
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2ef6ff, emissive: 0x2ef6ff, emissiveIntensity: 0.5 })
  );
  gun.position.set(0.42, 0.55, 0.25);
  gun.visible = false;
  g.add(gun);
  g.userData.gun = gun;
  return g;
}

const player = figure("panda");
player.position.set(10, 0, 10);
scene.add(player);

function makeDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x2ef6ff, emissive: 0x2ef6ff, emissiveIntensity: 0.5 }));
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 20), new THREE.MeshBasicMaterial({ color: 0xff2ea6 }));
  ringM.rotation.x = Math.PI / 2;
  g.add(body, ringM);
  g.position.set(12, 3.2, 8);
  scene.add(g);
  return g;
}
function makeDragonMount() {
  const g = figure("dragon");
  g.scale.set(1.35, 1.35, 1.35);
  g.position.set(-12, 0, 8);
  scene.add(g);
  return g;
}
const drone = makeDrone();
const dragonMount = makeDragonMount();

const pads = [
  { id: "gallery", pos: new THREE.Vector3(12, 0, 0), color: 0x2ef6ff, label: "GALLERY" },
  { id: "vision", pos: new THREE.Vector3(-12, 0, 0), color: 0xb56bff, label: "VISION" },
  { id: "contact", pos: new THREE.Vector3(0, 0, 12), color: 0xff2ea6, label: "CLIENT" },
  { id: "bench", pos: new THREE.Vector3(0, 0, -12), color: 0xffd166, label: "BENCH" },
];
pads.forEach((p) => {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.45 })
  );
  m.position.copy(p.pos);
  m.position.y = 0.06;
  scene.add(m);
  p.mesh = m;
});

const npcs = [
  { id: "drake", name: "DRAKE", role: "Guide", color: 0x3cb86a, pos: new THREE.Vector3(6, 0, 6) },
  { id: "pix", name: "PIX", role: "Host", color: 0xff2ea6, pos: new THREE.Vector3(-6, 0, 6) },
  { id: "strype", name: "STRYPE", role: "Recon", color: 0xffd166, pos: new THREE.Vector3(6, 0, -6) },
  { id: "nova", name: "NOVA", role: "Architect", color: 0x2ef6ff, pos: new THREE.Vector3(-6, 0, -6) },
  { id: "lin", name: "LIN", role: "Liaison", color: 0xb56bff, pos: new THREE.Vector3(0, 0, 18) },
];
npcs.forEach((n) => {
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 6, 10),
    new THREE.MeshStandardMaterial({ color: n.color, emissive: n.color, emissiveIntensity: 0.35 })
  );
  body.position.copy(n.pos);
  body.position.y = 0.65;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 8, 16), new THREE.MeshBasicMaterial({ color: n.color }));
  halo.rotation.x = Math.PI / 2;
  halo.position.copy(n.pos);
  halo.position.y = 1.55;
  scene.add(body, halo);
  n.mesh = body;
  n.halo = halo;
  n.douseCool = 0;
});

const enemies = [];
const kindling = [];
const pickups = [];
const bullets = [];
const booms = [];

function spawnEnemy() {
  if (enemies.length >= 10) return;
  const a = Math.random() * Math.PI * 2;
  const e = new THREE.Mesh(
    new THREE.TetrahedronGeometry(0.45),
    new THREE.MeshStandardMaterial({ color: 0x662244, emissive: 0xff2244, emissiveIntensity: 0.4 })
  );
  e.position.set(Math.cos(a) * 28, 0.5, Math.sin(a) * 28);
  e.userData = { hp: 3, mode: "seek", carry: false, cool: 0 };
  scene.add(e);
  enemies.push(e);
}

function spawnKindling() {
  if (kindling.length >= 6) return;
  const a = Math.random() * Math.PI * 2;
  const k = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshBasicMaterial({ color: 0xffb347 })
  );
  k.position.set(Math.cos(a) * (10 + Math.random() * 14), 0.3, Math.sin(a) * (10 + Math.random() * 14));
  scene.add(k);
  kindling.push(k);
}

function spawnPickup(type, pos) {
  const color = type === "ammo" ? 0x2ef6ff : type === "bomb" ? 0xff2ea6 : type === "gun" ? 0xffd166 : 0x88ffaa;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(pos);
  m.position.y = 0.4;
  m.userData = { type };
  scene.add(m);
  pickups.push(m);
}

for (let i = 0; i < 4; i++) spawnEnemy();
for (let i = 0; i < 4; i++) spawnKindling();
spawnPickup("gun", new THREE.Vector3(8, 0, 4));
spawnPickup("ammo", new THREE.Vector3(-7, 0, 3));
spawnPickup("bomb", new THREE.Vector3(3, 0, -8));
spawnPickup("scrap", new THREE.Vector3(-4, 0, -3));
spawnPickup("scrap", new THREE.Vector3(14, 0, -4));

function toast(msg) {
  $("toast").textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { $("toast").textContent = ""; }, 2800);
}

function addReady(n, why) {
  const before = state.readiness;
  state.readiness = Math.min(100, state.readiness + n);
  if (before < 100 && state.readiness >= 100 && state.phase === "defend") {
    state.phase = "burn";
    toast("PLAZA READY — LIGHT THE EFFIGY");
  }
  if (why) toast(why);
}

const lines = {
  drake: {
    hello: "I am DRAKE. Walk the rings. Talk to the crew. Hostiles will try to light the Man too early.",
    opts: [
      ["How do I move?", "WASD, click to look, Shift sprint. F rides the drone. R rides the dragon."],
      ["The effigy?", "They need three kindling drops. If it lights, call the drone with X or I will douse when I can."],
      ["When do we burn?", "After you meet us, stand the pads, and print one field app. Then you light it."],
    ],
  },
  pix: {
    hello: "PIX. I curate the gallery and match work to the right partner.",
    opts: [
      ["Open gallery", "__gallery__"],
      ["What do you sell?", "Agents, co-op builds, voice navigators, recon brand work — systems that stay kind."],
      ["Intro pack", "Stand the CLIENT pad after the burn. LIN will take the signal."],
    ],
  },
  strype: {
    hello: "STRYPE. Recon. Your silhouette is loud until you print a cloak.",
    opts: [
      ["Scan me", "Pulse pistol on the east crate. Bombs on the south ring. Scrap at the bench."],
      ["Stealth?", "Craft cloak / ward / jammer at the gold bench. Q cloaks. Enemies lose lock."],
      ["Escort", "Ride the drone high. Hostiles track ground heat, not sky glow."],
    ],
  },
  nova: {
    hello: "NOVA. I print agents and tools. The bench is a tiny factory.",
    opts: [
      ["Spawn observer", "Observer-7 is already watching the fire meter. You are the hands."],
      ["Dragonscale?", "Local-first mesh. This plaza is the shop window, not the vault."],
      ["Field task", "Collect scrap, print a cloak, stop two lighting attempts."],
    ],
  },
  lin: {
    hello: "LIN. Client liaison. When the Man burns on our terms, the terminal opens clean.",
    opts: [
      ["Open terminal", "__contact__"],
      ["Scope a project", "Tell us the job. We answer with a small working slice, not a deck."],
      ["How we work", "Golden Rule. Local control. You keep the keys."],
    ],
  },
};

function openTalk(id) {
  const n = npcs.find((x) => x.id === id);
  const data = lines[id];
  if (!n || !data) return;
  npcTalk.open = true;
  npcTalk.id = id;
  state.talked.add(id);
  if (state.talked.size >= 5) addReady(20, "CREW BRIEFED");
  else addReady(8);
  $("talk").classList.remove("hidden");
  $("talk-name").textContent = `${n.name} · ${n.role}`;
  $("talk-body").textContent = data.hello;
  const box = $("talk-opts");
  box.innerHTML = "";
  data.opts.forEach(([label, reply]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = () => {
      if (reply === "__gallery__") { closePanels(); $("gallery").classList.remove("hidden"); }
      else if (reply === "__contact__") { closePanels(); $("contact").classList.remove("hidden"); }
      else $("talk-body").textContent = reply;
    };
    box.appendChild(b);
  });
}

function closePanels() {
  ["talk", "gallery", "vision", "contact", "craft", "help", "controls"].forEach((id) => $(id).classList.add("hidden"));
  npcTalk.open = false;
  input.capturing = false;
}

function openControls() {
  document.exitPointerLock();
  $("controls").classList.remove("hidden");
  buildMapper();
  refreshPadHud();
}

function openCraft() {
  $("craft").classList.remove("hidden");
  const list = $("craft-list");
  list.innerHTML = "";
  const recipes = [
    { id: "cloak", name: "Cloak App", cost: 3, desc: "Enemies lose sight for 12s (Q)" },
    { id: "ward", name: "Ward Tool", cost: 2, desc: "Soaks the next two hits" },
    { id: "jammer", name: "Jammer App", cost: 4, desc: "Hostiles wander instead of lighting for 16s" },
  ];
  recipes.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${r.name} — ${r.cost} scrap · ${r.desc}`;
    b.onclick = () => {
      if (state.scrap < r.cost) return toast("NEED MORE SCRAP");
      state.scrap -= r.cost;
      state[r.id] += 1;
      addReady(15, `${r.name.toUpperCase()} PRINTED`);
      refreshHud();
    };
    list.appendChild(b);
  });
}

function near(a, b, d) {
  return a.distanceTo(b) < d;
}

function playerPos() {
  return player.position;
}

function shoot() {
  if (!state.weapon) return toast("FIND THE PULSE GUN");
  if (state.ammo <= 0) return toast("NO AMMO");
  state.ammo -= 1;
  const dir = new THREE.Vector3(-Math.sin(state.yaw), -state.pitch * 0.35, -Math.cos(state.yaw)).normalize();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0x2ef6ff }));
  mesh.position.copy(player.position).add(new THREE.Vector3(0, 1.1, 0));
  mesh.userData = { dir, life: 1.4 };
  scene.add(mesh);
  bullets.push(mesh);
  refreshHud();
}

function throwBomb() {
  if (state.bombs <= 0) return toast("NO BOOMS");
  state.bombs -= 1;
  const dir = new THREE.Vector3(-Math.sin(state.yaw), 0.35, -Math.cos(state.yaw)).normalize();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2ea6 }));
  mesh.position.copy(player.position).add(new THREE.Vector3(0, 1.2, 0));
  mesh.userData = { vel: dir.multiplyScalar(11), life: 2.2 };
  scene.add(mesh);
  booms.push(mesh);
  refreshHud();
}

function explode(pos, r = 3.2) {
  enemies.slice().forEach((e) => {
    if (e.position.distanceTo(pos) < r) hurtEnemy(e, 3);
  });
  const flash = new THREE.PointLight(0xff2ea6, 4, 10);
  flash.position.copy(pos);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 180);
}

function hurtEnemy(e, dmg) {
  e.userData.hp -= dmg;
  e.userData.mode = "flee";
  e.userData.cool = 1.6;
  if (e.userData.carry) {
    e.userData.carry = false;
    spawnKindlingAt(e.position);
  }
  if (e.userData.hp <= 0) {
    scene.remove(e);
    enemies.splice(enemies.indexOf(e), 1);
    if (Math.random() < 0.5) spawnPickup(Math.random() < 0.5 ? "ammo" : "scrap", e.position);
    addReady(4);
  }
}

function spawnKindlingAt(pos) {
  const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  k.position.copy(pos);
  k.position.y = 0.3;
  scene.add(k);
  kindling.push(k);
}

function summonDroneDouse() {
  drone.userData.douse = 2.8;
  toast("DRONE · WATER RUN");
}

function tryLightEffigy() {
  if (state.phase === "burn") {
    state.ceremonial = true;
    state.lit = true;
    state.fire = Math.max(state.fire, 20);
    toast("YOU LIGHT THE MAN");
    return;
  }
  toast("NOT YET — HOLD THE LINE");
}

function interact() {
  const p = player.position;
  const npc = npcs.find((n) => n.mesh.position.distanceTo(p) < 2.2);
  if (npc) return openTalk(npc.id);
  const pad = pads.find((x) => x.pos.distanceTo(p) < 2.1);
  if (pad) {
    state.pads.add(pad.id);
    if (state.pads.size >= 4) addReady(15, "PADS STANDING");
    if (pad.id === "gallery") $("gallery").classList.remove("hidden");
    if (pad.id === "vision") $("vision").classList.remove("hidden");
    if (pad.id === "contact") $("contact").classList.remove("hidden");
    if (pad.id === "bench") openCraft();
    return;
  }
  if (p.distanceTo(effigy.position) < 3.2) tryLightEffigy();
}

function toggleMount(kind) {
  if (state.mounted === kind) {
    state.mounted = null;
    player.visible = true;
    toast("DISMOUNT");
    return;
  }
  state.mounted = kind;
  toast(kind === "drone" ? "DRONE RIDE" : "DRAGON RIDE");
}

function refreshHud() {
  $("hp-bar").style.transform = `scaleX(${Math.max(0, state.hp) / 100})`;
  $("ammo").textContent = state.ammo;
  $("bombs").textContent = state.bombs;
  $("fire-bar").style.transform = `scaleX(${state.fire / 100})`;
  $("phase-label").textContent =
    state.phase === "defend" ? "PHASE · DEFEND THE EFFIGY" :
    state.phase === "burn" ? "PHASE · BURN THE EFFIGY" :
    "PHASE · AFTERGLOW";
  $("quest").innerHTML = `
    Crew briefed ${state.talked.size}/5<br/>
    Pads ${state.pads.size}/4 · Ready ${Math.floor(state.readiness)}%<br/>
    Hostiles ${enemies.length}/10 · Kindling loose ${kindling.length}<br/>
    ${state.cloak ? "Cloak ready · " : ""}${state.ward ? "Ward ready · " : ""}${state.jammer ? "Jammer ready" : ""}
  `;
  $("inv").innerHTML = `
    ${state.species.toUpperCase()} ${state.mounted ? "· " + state.mounted.toUpperCase() : ""}<br/>
    Scrap ${state.scrap} · Kindling ${state.kindlingHeld}<br/>
    Gun ${state.weapon ? "YES" : "NO"} · Cloak ${state.cloak} · Ward ${state.ward}
  `;
}

function useLabel(id) {
  return bindLabel(id, input.scheme === "pad" ? "pad" : "kb");
}

function updatePrompt() {
  const p = player.position;
  const use = useLabel("interact");
  let msg = "";
  const npc = npcs.find((n) => n.mesh.position.distanceTo(p) < 2.2);
  if (npc) msg = `${use}  TALK  ${npc.name}`;
  else if (pads.some((x) => x.pos.distanceTo(p) < 2.1)) msg = `${use}  USE PAD`;
  else if (p.distanceTo(effigy.position) < 3.2) msg = state.phase === "burn" ? `${use}  LIGHT THE EFFIGY` : `${use}  EFFIGY (LOCKED)`;
  $("prompt").textContent = msg;
  $("prompt").classList.toggle("hidden", !msg);
}

function refreshPadHud() {
  const el = $("pad-status");
  if (!el) return;
  el.textContent = input.padId ? "XBOX" : "MOUSE";
  const live = $("pad-live");
  if (live) live.textContent = input.padId ? input.padId : "No controller yet — press any pad button to wake it.";
}

function useCloak() {
  if (state.cloak <= 0) return toast("NO CLOAK");
  state.cloak -= 1;
  state.cloakTimer = 12;
  toast("CLOAK APP");
}
function useJammer() {
  if (state.jammer <= 0) return toast("NO JAMMER");
  state.jammer -= 1;
  state.jammerTimer = 16;
  toast("JAMMER APP");
}

onAction("shoot", () => {
  if ($("boot").style.display === "none" && (document.pointerLockElement === canvas || input.scheme === "pad") && !uiOpen()) shoot();
});
onAction("bomb", throwBomb);
onAction("interact", interact);
onAction("drone", () => toggleMount("drone"));
onAction("dragon", () => toggleMount("dragon"));
onAction("cloak", useCloak);
onAction("jammer", useJammer);
onAction("douse", summonDroneDouse);
onAction("bench", openCraft);
onAction("gallery", () => $("gallery").classList.toggle("hidden"));
onAction("vision", () => $("vision").classList.toggle("hidden"));
onAction("help", () => $("help").classList.toggle("hidden"));
onAction("controls", openControls);

attachListeners({
  isBlocked: () => uiOpen() || $("boot").style.display !== "none" || input.capturing,
  onPad: () => refreshPadHud(),
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    document.exitPointerLock();
    closePanels();
  }
});

canvas.addEventListener("click", () => {
  if ($("boot").style.display === "none" && !uiOpen() && !input.capturing) canvas.requestPointerLock();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  state.yaw -= e.movementX * 0.0022;
  state.pitch = THREE.MathUtils.clamp(state.pitch + e.movementY * 0.002, -0.8, 0.9);
});
document.addEventListener("pointerlockchange", () => {
  state.pointer = document.pointerLockElement === canvas;
});

$("boot-controls").onclick = openControls;
$("bind-scheme").onchange = () => buildMapper();
$("bind-save").onclick = () => {
  if (saveCapture()) {
    toast("BINDING SAVED");
    buildMapper();
    $("bind-hint").textContent = "Saved. Click another row to keep remapping.";
  } else {
    toast("HIGHLIGHT AN ACTION AND PRESS A CONTROL FIRST");
  }
};
$("bind-reset").onclick = () => {
  const scheme = $("bind-scheme").value;
  resetScheme(scheme);
  buildMapper();
  $("bind-capture").value = "";
  toast(scheme === "pad" ? "XBOX DEFAULTS RESTORED" : "KEYBOARD DEFAULTS RESTORED");
};

$("pick-panda").onclick = () => start("panda");
$("pick-dragon").onclick = () => start("dragon");

function start(species) {
  state.species = species;
  scene.remove(player);
  const next = figure(species);
  next.position.copy(player.position);
  player.clear();
  while (player.children.length) player.remove(player.children[0]);
  next.children.slice().forEach((c) => player.add(c));
  player.userData.gun = next.userData.gun;
  if (species === "dragon") dragonMount.visible = false;
  $("boot").style.display = "none";
  canvas.requestPointerLock();
  toast(species === "panda" ? "PANDA ON THE SAND" : "DRAGON ON THE SAND");
  refreshHud();
}

document.querySelectorAll("[data-close]").forEach((b) => {
  b.onclick = () => $(b.dataset.close).classList.add("hidden");
});
$("contact-form").onsubmit = (e) => {
  e.preventDefault();
  $("form-status").textContent = "Signal logged locally. Wire email on deploy.";
  addReady(10, "CLIENT SIGNAL");
};

let spawnT = 0;
let kindleT = 0;
let npcDouseT = 0;

function ai(dt) {
  spawnT += dt;
  kindleT += dt;
  if (spawnT > 9 && enemies.length < 10 && state.phase !== "aftermath") {
    spawnEnemy();
    spawnT = 0;
  }
  if (kindleT > 7) {
    spawnKindling();
    kindleT = 0;
  }

  const jam = state.jammerTimer > 0;
  enemies.forEach((e) => {
    e.rotation.y += dt * 1.5;
    const u = e.userData;
    u.cool = Math.max(0, u.cool - dt);
    if (state.cloakTimer > 0) {
      u.mode = "wander";
    } else if (jam) {
      u.mode = "wander";
    } else if (u.mode === "flee" && u.cool <= 0) {
      u.mode = "seek";
    }

    let target = null;
    if (u.mode === "seek" && !u.carry) {
      let best = null, bd = 99;
      kindling.forEach((k) => {
        const d = k.position.distanceTo(e.position);
        if (d < bd) { bd = d; best = k; }
      });
      target = best ? best.position : null;
      if (best && bd < 0.8) {
        u.carry = true;
        scene.remove(best);
        kindling.splice(kindling.indexOf(best), 1);
      }
    }
    if (u.carry) target = effigy.position;

    if (u.mode === "wander" || !target) {
      e.position.x += Math.sin(performance.now() * 0.001 + e.id) * dt * 1.2;
      e.position.z += Math.cos(performance.now() * 0.001 + e.id) * dt * 1.2;
    } else {
      const dir = target.clone().sub(e.position);
      dir.y = 0;
      if (dir.length() > 0.05) {
        dir.normalize();
        e.position.addScaledVector(dir, dt * 2.15);
      }
    }

    if (u.carry && e.position.distanceTo(effigy.position) < 2.2 && state.phase === "defend" && !state.ceremonial) {
      u.carry = false;
      state.fire += 18;
      if (state.fire >= 34) {
        state.lit = true;
        toast("HOSTILES LIT THE EFFIGY");
      } else toast("KINDLING DUMPED");
    }

    if (e.position.distanceTo(player.position) < 1.3 && state.cloakTimer <= 0 && u.cool <= 0) {
      let dmg = 8;
      if (state.ward > 0) { state.ward -= 1; dmg = 0; toast("WARD ABSORBS"); }
      state.hp = Math.max(0, state.hp - dmg);
      u.cool = 1.2;
      const away = player.position.clone().sub(e.position).setY(0).normalize();
      player.position.addScaledVector(away, 0.6);
    }

    e.position.x = THREE.MathUtils.clamp(e.position.x, -32, 32);
    e.position.z = THREE.MathUtils.clamp(e.position.z, -32, 32);
  });

  npcs.forEach((n) => {
    n.douseCool = Math.max(0, n.douseCool - dt);
    n.halo.rotation.z += dt;
    if (state.lit && !state.ceremonial && n.douseCool <= 0 && Math.random() < 0.002) {
      n.douseCool = 12;
      state.fire = Math.max(0, state.fire - 22);
      if (state.fire < 12) { state.lit = false; toast(`${n.name} DOUSED THE FIRE`); }
      else toast(`${n.name} SOAKS THE MAN`);
    }
  });

  if (drone.userData.douse > 0) {
    drone.userData.douse -= dt;
    drone.position.lerp(new THREE.Vector3(0, 6, 0), dt * 2);
    state.fire = Math.max(0, state.fire - dt * 18);
    if (state.fire < 8) { state.lit = false; toast("DRONE KILLS THE FLAME"); }
  }

  if (state.lit && !state.ceremonial) state.fire = Math.min(92, state.fire + dt * 1.6);
  if (state.ceremonial) state.fire = Math.min(100, state.fire + dt * 8);
  if (state.ceremonial && state.fire >= 100 && !state.consumed) {
    state.consumed = true;
    state.phase = "aftermath";
    toast("THE MAN FALLS — TERMINAL OPEN");
    $("contact").classList.remove("hidden");
    addReady(20);
  }
}

function movePlayer(dt) {
  const speed = (held("sprint") ? 9.5 : 5.4) * (state.mounted ? 1.35 : 1);
  const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const wish = new THREE.Vector3();
  if (held("moveForward") || input.held.ArrowUp) wish.add(forward);
  if (held("moveBack") || input.held.ArrowDown) wish.sub(forward);
  if (held("moveRight") || input.held.ArrowRight) wish.add(right);
  if (held("moveLeft") || input.held.ArrowLeft) wish.sub(right);
  if (wish.length() > 0) {
    wish.normalize();
    player.position.addScaledVector(wish, speed * dt);
  }
  player.rotation.y = state.yaw;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -34, 34);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -34, 34);

  if (state.mounted === "drone") {
    const fly = (held("flyUp") ? 1 : 0) + (held("flyDown") ? -1 : 0);
    player.position.y = THREE.MathUtils.clamp(player.position.y + fly * dt * 6, 0, 14);
    drone.position.copy(player.position).add(new THREE.Vector3(0, 1.4, 0));
    player.visible = false;
  } else if (state.mounted === "dragon") {
    const fly = (held("flyUp") ? 1 : 0) + (held("flyDown") ? -1 : 0);
    player.position.y = THREE.MathUtils.clamp(player.position.y + fly * dt * 5, 0, 10);
    dragonMount.position.copy(player.position);
    dragonMount.rotation.y = state.yaw;
    player.visible = false;
    dragonMount.visible = true;
  } else {
    player.position.y = 0;
    player.visible = true;
    if (state.species !== "dragon") {
      dragonMount.visible = true;
      if (dragonMount.position.distanceTo(player.position) > 3) {
        const d = player.position.clone().sub(dragonMount.position);
        d.y = 0;
        if (d.length() > 4) dragonMount.position.addScaledVector(d.normalize(), dt * 3);
      }
    }
    drone.position.x += Math.sin(performance.now() * 0.001) * 0.01;
    drone.position.y = 3.2 + Math.sin(performance.now() * 0.002) * 0.35;
  }

  if (player.userData.gun) player.userData.gun.visible = state.weapon;
}

function updateProjectiles(dt) {
  bullets.slice().forEach((b) => {
    b.userData.life -= dt;
    b.position.addScaledVector(b.userData.dir, dt * 28);
    enemies.forEach((e) => {
      if (e.position.distanceTo(b.position) < 0.7) {
        hurtEnemy(e, 1);
        b.userData.life = 0;
      }
    });
    if (b.userData.life <= 0) {
      scene.remove(b);
      bullets.splice(bullets.indexOf(b), 1);
    }
  });
  booms.slice().forEach((b) => {
    b.userData.life -= dt;
    b.userData.vel.y -= 14 * dt;
    b.position.addScaledVector(b.userData.vel, dt);
    if (b.position.y <= 0.2 || b.userData.life <= 0) {
      explode(b.position.clone());
      scene.remove(b);
      booms.splice(booms.indexOf(b), 1);
    }
  });
}

function updatePickups(dt) {
  pickups.slice().forEach((p) => {
    p.rotation.y += dt * 2;
    p.position.y = 0.4 + Math.sin(performance.now() * 0.004) * 0.08;
    if (p.position.distanceTo(player.position) < 1.3) {
      const t = p.userData.type;
      if (t === "ammo") state.ammo += 12;
      if (t === "bomb") state.bombs += 2;
      if (t === "scrap") state.scrap += 2;
      if (t === "gun") { state.weapon = true; toast("PULSE GUN ONLINE"); addReady(10); }
      else toast(t.toUpperCase() + " +");
      scene.remove(p);
      pickups.splice(pickups.indexOf(p), 1);
    }
  });
  kindling.slice().forEach((k) => {
    k.rotation.y += dt;
    if (k.position.distanceTo(player.position) < 1.2) {
      state.kindlingHeld += 1;
      state.scrap += 1;
      scene.remove(k);
      kindling.splice(kindling.indexOf(k), 1);
      toast("KINDLING DENIED");
    }
  });
}

function updateFireVisual() {
  const show = state.lit || state.ceremonial;
  firePts.material.opacity = show ? Math.min(1, state.fire / 40) : 0;
  effigy.userData.glow.intensity = show ? 1 + state.fire / 25 : 0.05;
  const arr = firePts.geometry.attributes.position.array;
  for (let i = 0; i < 60; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 1.4;
    arr[i * 3 + 1] = Math.random() * (1 + state.fire / 20);
    arr[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  firePts.geometry.attributes.position.needsUpdate = true;
}

function cameraFollow() {
  const dist = state.mounted ? 8.5 : 6.2;
  const height = state.mounted ? 3.6 : 2.4;
  const off = new THREE.Vector3(
    Math.sin(state.yaw) * dist,
    height + state.pitch * 2.2,
    Math.cos(state.yaw) * dist
  );
  const want = player.position.clone().add(off);
  camera.position.lerp(want, 0.12);
  const look = player.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  camera.lookAt(look);
}

function loop() {
  const dt = Math.min(0.033, clock.getDelta());
  pollGamepad();
  const look = lookAxes();
  if (input.scheme === "pad" && !uiOpen() && $("boot").style.display === "none") {
    state.yaw -= look.x * dt * 2.1;
    state.pitch = THREE.MathUtils.clamp(state.pitch + look.y * dt * 1.6, -0.8, 0.9);
  }
  state.cloakTimer = Math.max(0, (state.cloakTimer || 0) - dt);
  state.jammerTimer = Math.max(0, (state.jammerTimer || 0) - dt);
  orbs.forEach((o) => {
    o.userData.a += dt * 0.3;
    o.position.set(Math.cos(o.userData.a) * o.userData.r, o.userData.y, Math.sin(o.userData.a) * o.userData.r);
  });
  if ($("boot").style.display === "none") {
    movePlayer(dt);
    ai(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateFireVisual();
    cameraFollow();
    updatePrompt();
    refreshHud();
    if (state.hp <= 0) {
      state.hp = 100;
      player.position.set(10, 0, 10);
      toast("RESPAWN — PLAZA HOLDS YOU");
    }
  } else {
    camera.position.set(16, 8, 16);
    camera.lookAt(0, 2, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

refreshHud();
loop();
