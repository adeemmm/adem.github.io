// Deterministic kinematic character controller.
//
// The SAME code runs on the server (authoritative) and on the client
// (prediction + reconciliation replay). It must stay pure: no randomness, no
// wall-clock time, no state outside the arguments. Given the same starting
// state and the same input it must produce the same result on both sides.

import { GRAVITY, ROLE_STATS, ROLE_GUARD, BOOST_FACTOR, carrySpeedFactor } from "./constants.js";
import { OBSTACLES, JAIL } from "./map.js";

const EPS = 1e-4;

export function createBody(x = 0, y = 0, z = 0, yaw = 0) {
  // `carry` is the weight of the loot being carried (0 = none). It is part of
  // the body so prediction and server always agree on the speed penalty.
  // `jailed` (0/1) confines the body to the Toy Jail; `boost` is the number of
  // ticks of jailbreak speed boost left. All three travel in the snapshot.
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, grounded: true, carry: 0, jailed: 0, boost: 0 };
}

export function copyBody(dst, src) {
  dst.x = src.x; dst.y = src.y; dst.z = src.z;
  dst.vx = src.vx; dst.vy = src.vy; dst.vz = src.vz;
  dst.yaw = src.yaw; dst.grounded = src.grounded; dst.carry = src.carry;
  dst.jailed = src.jailed; dst.boost = src.boost;
  return dst;
}

// Clamp untrusted input into the legal range. Returns null if it is garbage.
export function sanitizeInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const f = Number(raw.f), r = Number(raw.r), y = Number(raw.y), s = Number(raw.s);
  if (!Number.isFinite(f) || !Number.isFinite(r) || !Number.isFinite(y) || !Number.isInteger(s)) return null;
  return {
    s,
    f: Math.max(-1, Math.min(1, f)),
    r: Math.max(-1, Math.min(1, r)),
    y,
    j: !!raw.j,
    e: !!raw.e,   // interact pressed this tick (edge-triggered on the client)
    h: !!raw.h,   // interact key currently held (jail lever)
    a: !!raw.a,   // arrest pressed this tick (edge-triggered, guards only)
  };
}

function overlaps(o, minX, maxX, minY, maxY, minZ, maxZ) {
  return maxX > o.minX + EPS && minX < o.maxX - EPS &&
         maxY > o.minY + EPS && minY < o.maxY - EPS &&
         maxZ > o.minZ + EPS && minZ < o.maxZ - EPS;
}

/**
 * Advance `body` by one fixed step.
 * input: { f: forward -1..1, r: right -1..1, y: camera yaw (rad), j: jump held }
 * (input.e / input.h / input.a are gameplay actions handled by the server's
 * LootSystem and JailSystem, not here.)
 * Camera yaw 0 looks down -Z; positive yaw turns left (standard Three.js Y rotation).
 */
export function stepBody(body, input, role, dt) {
  const st = ROLE_STATS[role] || ROLE_STATS.toy;

  // --- Desired horizontal velocity, relative to the camera ---
  let f = input.f, r = input.r;
  const len = Math.hypot(f, r);
  if (len > 1) { f /= len; r /= len; }
  const sin = Math.sin(input.y), cos = Math.cos(input.y);
  let speed = st.speed * carrySpeedFactor(body.carry);     // heavy loot slows you down
  if (body.boost > 0) { speed *= BOOST_FACTOR; body.boost--; }   // jailbreak escape boost
  const wishX = (-sin * f + cos * r) * speed;
  const wishZ = (-cos * f - sin * r) * speed;

  // Accelerate towards the wish velocity (snappy on ground, floaty in air).
  const maxDelta = (body.grounded ? st.accel : st.airAccel) * dt;
  const dvx = wishX - body.vx, dvz = wishZ - body.vz;
  const dvLen = Math.hypot(dvx, dvz);
  if (dvLen <= maxDelta) { body.vx = wishX; body.vz = wishZ; }
  else { body.vx += (dvx / dvLen) * maxDelta; body.vz += (dvz / dvLen) * maxDelta; }

  // --- Facing: guards aim their flashlight with the camera, toys face travel ---
  if (role === ROLE_GUARD) body.yaw = input.y;
  else if (len > 0.01) body.yaw = Math.atan2(-wishX, -wishZ);

  // --- Vertical ---
  if (body.grounded && input.j) { body.vy = st.jump; body.grounded = false; }
  body.vy += GRAVITY * dt;

  // --- Integrate + resolve one axis at a time against the static AABBs ---
  const rad = st.radius, h = st.height;

  body.x += body.vx * dt;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (!overlaps(o, body.x - rad, body.x + rad, body.y, body.y + h, body.z - rad, body.z + rad)) continue;
    body.x = body.vx > 0 ? o.minX - rad : o.maxX + rad;
    body.vx = 0;
  }
  if (body.jailed) {
    const lo = JAIL.minX + rad, hi = JAIL.maxX - rad;
    if (body.x < lo) { body.x = lo; body.vx = 0; } else if (body.x > hi) { body.x = hi; body.vx = 0; }
  }

  body.z += body.vz * dt;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (!overlaps(o, body.x - rad, body.x + rad, body.y, body.y + h, body.z - rad, body.z + rad)) continue;
    body.z = body.vz > 0 ? o.minZ - rad : o.maxZ + rad;
    body.vz = 0;
  }
  if (body.jailed) {
    const lo = JAIL.minZ + rad, hi = JAIL.maxZ - rad;
    if (body.z < lo) { body.z = lo; body.vz = 0; } else if (body.z > hi) { body.z = hi; body.vz = 0; }
  }

  body.y += body.vy * dt;
  body.grounded = false;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (!overlaps(o, body.x - rad, body.x + rad, body.y, body.y + h, body.z - rad, body.z + rad)) continue;
    if (body.vy <= 0) { body.y = o.maxY; body.grounded = true; }   // landed on top
    else { body.y = o.minY - h; }                                   // bumped head
    body.vy = 0;
  }
  if (body.y <= 0) { body.y = 0; body.vy = 0; body.grounded = true; } // floor plane

  return body;
}
