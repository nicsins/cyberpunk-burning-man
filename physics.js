// physics.js: Rapier (non-compat, vendored) + fixed-timestep player controller.
// Loaded lazily after the title screen. Until Rapier is ready the same fixed-step integrator runs
// with a flat-ground fallback, so movement feel is identical and frame-rate independent either way.
export const STEP = 1 / 60;          // fixed physics step (s)
export const MAX_FRAME = 0.5;        // clamp on huge frame dt (tab switch, hitch) -> at most 30 steps/frame
export const EYE = 1.7;              // eye height above feet
const CAP_R = 0.35, CAP_HALF = 0.5;  // capsule: total height 2*(0.5+0.35)=1.7 m, centre 0.85 m above feet
export const TUNING = {gravity: 18.5, jumpV: 7.8, walkAccel: 46, drag: 10, flyAccel: 70, flyDrag: 3,
  flyClimb: 9, flyDescend: 9, landSpeed: 10, flyMin: 2, flyMax: 40, worldHalf: 205};

let RAPIER = null;
export async function loadRapier() {
  if (RAPIER) return RAPIER;
  const m = await import('./vendor/rapier3d/rapier.js');
  RAPIER = m.default || m;
  return RAPIER;
}

// Collider spec list (plain data, built from the scene in game.js) -> Rapier world
// spec: {type:'cyl',x,y,z,r,h} | {type:'box',x,y,z,hx,hy,hz,rotY} | {type:'cap',x,y,z,r,h}
export function createWorld(R, specs, startFeet) {
  const world = new R.World({x: 0, y: 0, z: 0});   // gravity applied by the controller (kinematic player)
  world.timestep = STEP;
  const add = (desc, tag) => { const c = world.createCollider(desc); c.__tag = tag; return c; };
  add(R.ColliderDesc.cuboid(TUNING.worldHalf + 20, 0.5, TUNING.worldHalf + 20).setTranslation(0, -0.5, 0), 'ground');
  const W = TUNING.worldHalf;   // world bounds (B12)
  for (const [x, z, hx, hz] of [[W + 1, 0, 1, W], [-W - 1, 0, 1, W], [0, W + 1, W, 1], [0, -W - 1, W, 1]])
    add(R.ColliderDesc.cuboid(hx, 30, hz).setTranslation(x, 30, z), 'bounds');
  for (const s of specs) {
    let d;
    if (s.type === 'cyl') d = R.ColliderDesc.cylinder(s.h / 2, s.r);
    else if (s.type === 'cap') d = R.ColliderDesc.capsule(Math.max(0.01, s.h / 2 - s.r), s.r);
    else d = R.ColliderDesc.cuboid(s.hx, s.hy, s.hz);
    d.setTranslation(s.x, s.y, s.z);
    if (s.rotY) d.setRotation({x: 0, y: Math.sin(s.rotY / 2), z: 0, w: Math.cos(s.rotY / 2)});
    add(d, s.tag || s.type);
  }
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(startFeet.x, startFeet.y + CAP_HALF + CAP_R, startFeet.z));
  const col = world.createCollider(R.ColliderDesc.capsule(CAP_HALF, CAP_R), body);
  const cc = world.createCharacterController(0.02);
  cc.enableAutostep(0.45, 0.3, true);
  cc.enableSnapToGround(0.3);
  cc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
  cc.setMinSlopeSlideAngle(35 * Math.PI / 180);
  cc.setApplyImpulsesToDynamicBodies(true);
  world.step();   // build the query pipeline
  return {world, body, col, cc, colliders: specs.length + 5};
}

// Player state lives here (not on the camera) so rendering can interpolate between steps.
export function makePlayer(feet) {
  return {pos: {...feet}, prev: {...feet}, vel: {x: 0, y: 0, z: 0}, grounded: true, flying: false, landing: false,
    steps: 0, apex: 0, phys: null};
}

// One fixed step. input: {f,b,l,r,jump,up,down,yaw}; jump is edge-triggered (consumed here).
export function stepPlayer(P, input, h = STEP) {
  const T = TUNING, v = P.vel;
  P.prev = {...P.pos};
  // horizontal: accel in view yaw, linear drag (semi-implicit Euler, fixed h -> deterministic)
  const fz = (input.f ? 1 : 0) - (input.b ? 1 : 0), fx = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  const len = Math.hypot(fx, fz) || 1, acc = P.flying ? T.flyAccel : T.walkAccel, drag = P.flying ? T.flyDrag : T.drag;
  const sy = Math.sin(input.yaw || 0), cy = Math.cos(input.yaw || 0);
  // camera forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
  const ax = (fz / len) * -sy + (fx / len) * cy, az = (fz / len) * -cy + (fx / len) * -sy;
  if (fx || fz) { v.x += ax * acc * h; v.z += az * acc * h; }
  v.x -= v.x * Math.min(1, drag * h); v.z -= v.z * Math.min(1, drag * h);
  // vertical
  if (P.flying) {
    if (P.landing) v.y = -T.landSpeed * Math.min(1, Math.max(0.35, (P.pos.y) / 6));   // ease in near ground (B7)
    else {
      if (input.up) v.y += T.flyClimb * 4 * h;
      if (input.down) v.y -= T.flyDescend * 4 * h;   // B7: Shift/C descends
      v.y -= v.y * Math.min(1, T.flyDrag * h);
    }
  } else {
    if (input.jump && P.grounded) { v.y = T.jumpV; P.grounded = false; }
    v.y -= T.gravity * h;
  }
  input.jump = false;
  const want = {x: v.x * h, y: v.y * h, z: v.z * h};
  if (P.phys) {
    const {world, body, col, cc} = P.phys;
    cc.computeColliderMovement(col, want);
    const m = cc.computedMovement(), t = body.translation();
    body.setNextKinematicTranslation({x: t.x + m.x, y: t.y + m.y, z: t.z + m.z});
    world.step();
    const n = body.translation();
    P.pos = {x: n.x, y: n.y - CAP_HALF - CAP_R, z: n.z};
    const grounded = cc.computedGrounded();
    // blocked horizontally -> kill that velocity component so we don't "stick" pushing into walls
    if (Math.abs(m.x) < Math.abs(want.x) * 0.5) v.x *= 0.5;
    if (Math.abs(m.z) < Math.abs(want.z) * 0.5) v.z *= 0.5;
    if (Math.abs(m.y) < Math.abs(want.y) * 0.5 && v.y > 0) v.y = 0;   // head bump
    P.grounded = grounded && v.y <= 0;
  } else {
    P.pos = {x: P.pos.x + want.x, y: P.pos.y + want.y, z: P.pos.z + want.z};
    const W = T.worldHalf; P.pos.x = Math.max(-W, Math.min(W, P.pos.x)); P.pos.z = Math.max(-W, Math.min(W, P.pos.z));
    P.grounded = P.pos.y <= 0 && v.y <= 0;
    if (P.pos.y < 0) P.pos.y = 0;
  }
  if (P.grounded) v.y = 0;
  if (P.flying) {
    if (P.landing && P.grounded) { P.flying = false; P.landing = false; v.y = 0; }   // soft touchdown, no hop
    else if (!P.landing) {
      const hi = T.flyMax - EYE;
      if (P.pos.y > hi) { P.pos.y = hi; v.y = Math.min(0, v.y); syncBody(P); }
    }
  }
  if (P.pos.y > P.apex) P.apex = P.pos.y;
  P.steps++;
}
function syncBody(P) { if (P.phys) P.phys.body.setTranslation({x: P.pos.x, y: P.pos.y + CAP_HALF + CAP_R, z: P.pos.z}, true); }

// Accumulator driver. Returns interpolation alpha in [0,1).
export function advance(state, P, input, frameDt) {
  state.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME);
  let n = 0;
  while (state.acc >= STEP) { stepPlayer(P, input, STEP); state.acc -= STEP; n++; }
  return {alpha: state.acc / STEP, steps: n};
}
export const lerp3 = (a, b, t) => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t});

// Attach Rapier to a running player (keeps position & velocity).
export function attachPhysics(R, P, specs) {
  P.phys = createWorld(R, specs, P.pos);
  return P.phys;
}
