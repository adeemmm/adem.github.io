// Client-side prediction + server reconciliation for the local player.
//
// Every sim tick we apply the input locally straight away (using the same
// stepBody() the server runs) and remember it. When a snapshot arrives we
// rewind to the server's authoritative body, drop the inputs it has already
// consumed, and replay the rest. Any leftover disagreement is blended out
// visually over a few frames instead of popping.
import { TICK_DT } from "../shared/constants.js";
import { createBody, copyBody, stepBody } from "../shared/movement.js";

const SNAP_DISTANCE = 4;      // beyond this (teleport/respawn) just snap
const MAX_PENDING = 90;       // ~3 s of unacknowledged inputs
const ERROR_DECAY = 12;       // 1/s

export class Prediction {
  constructor() {
    this.body = createBody();       // predicted state at the latest sim tick
    this.prev = createBody();       // state one tick earlier (for render interpolation)
    this.pending = [];              // inputs sent but not yet acknowledged
    this.seq = 0;
    this.error = { x: 0, y: 0, z: 0 };   // visual offset being blended to zero
    this.ready = false;             // true once the first snapshot has positioned us
    this.lastCorrection = 0;        // metres, for the debug HUD
  }

  nextSeq() { return ++this.seq; }

  /** Predict one tick locally. */
  apply(input, role) {
    copyBody(this.prev, this.body);
    stepBody(this.body, input, role, TICK_DT);
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
  }

  /** m = [x, y, z, vx, vy, vz, yaw, grounded], ack = last input seq the server applied. */
  reconcile(m, ack, role) {
    const bx = this.body.x, by = this.body.y, bz = this.body.z;

    let drop = 0;
    while (drop < this.pending.length && this.pending[drop].s <= ack) drop++;
    if (drop) this.pending.splice(0, drop);

    const b = this.body;
    b.x = m[0]; b.y = m[1]; b.z = m[2];
    b.vx = m[3]; b.vy = m[4]; b.vz = m[5];
    b.yaw = m[6]; b.grounded = m[7] === 1;
    for (let i = 0; i < this.pending.length; i++) stepBody(b, this.pending[i], role, TICK_DT);

    const dx = b.x - bx, dy = b.y - by, dz = b.z - bz;
    const dist = Math.hypot(dx, dy, dz);
    this.lastCorrection = dist;

    if (!this.ready || dist > SNAP_DISTANCE) {
      copyBody(this.prev, b);
      this.error.x = this.error.y = this.error.z = 0;
      const snapped = !this.ready || dist > SNAP_DISTANCE;
      this.ready = true;
      return snapped;
    }
    if (dist > 1e-6) {
      // Shift history by the correction and hide it behind a decaying offset,
      // so the rendered position stays continuous.
      this.prev.x += dx; this.prev.y += dy; this.prev.z += dz;
      this.error.x -= dx; this.error.y -= dy; this.error.z -= dz;
    }
    return false;
  }

  /** Smoothed render position: interpolate between the last two ticks + residual error. */
  renderPosition(alpha, dt, out) {
    const k = Math.exp(-ERROR_DECAY * dt);
    this.error.x *= k; this.error.y *= k; this.error.z *= k;
    out.x = this.prev.x + (this.body.x - this.prev.x) * alpha + this.error.x;
    out.y = this.prev.y + (this.body.y - this.prev.y) * alpha + this.error.y;
    out.z = this.prev.z + (this.body.z - this.prev.z) * alpha + this.error.z;
    return out;
  }
}
