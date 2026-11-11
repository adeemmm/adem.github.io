// Entity interpolation for remote players.
//
// Snapshots arrive at 30 Hz for nearby entities and 10 Hz for distant ones.
// Rather than rendering the newest (jittery) sample, every remote entity is
// drawn INTERP_DELAY_MS in the past, blended between the two snapshots that
// bracket that moment on the server's timeline.
import { TICK_MS, INTERP_DELAY_MS } from "../shared/constants.js";

const MAX_SAMPLES = 24;

/** Estimates "server time now" from snapshot tick numbers. */
export class ServerClock {
  constructor() { this.offset = null; }

  /** Call for every snapshot. */
  observe(tick, now) {
    const sample = tick * TICK_MS - now;
    if (this.offset === null || Math.abs(sample - this.offset) > 500) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.05;   // smooth out arrival jitter
  }

  /** Server timestamp remote entities should be rendered at. */
  renderTime(now) { return this.offset === null ? 0 : now + this.offset - INTERP_DELAY_MS; }
}

export class SnapshotBuffer {
  constructor() { this.samples = []; }   // ascending by server time

  push(t, x, y, z, yaw) {
    const s = this.samples;
    if (s.length && t <= s[s.length - 1].t) return;   // out of order / duplicate
    s.push({ t, x, y, z, yaw });
    if (s.length > MAX_SAMPLES) s.shift();
  }

  get hasData() { return this.samples.length > 0; }

  /** Writes the interpolated transform at server time `t` into `out`. */
  sample(t, out) {
    const s = this.samples;
    if (!s.length) return false;

    // Drop samples we have fully passed, always keeping one before `t`.
    while (s.length > 2 && s[1].t <= t) s.shift();

    const a = s[0], b = s[1];
    if (!b || t <= a.t) { copy(out, a); return true; }
    if (t >= b.t) { copy(out, b); return true; }      // starved: hold the latest

    const k = (t - a.t) / (b.t - a.t);
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.z = a.z + (b.z - a.z) * k;
    out.yaw = a.yaw + shortestAngle(a.yaw, b.yaw) * k;
    return true;
  }
}

function copy(out, s) { out.x = s.x; out.y = s.y; out.z = s.z; out.yaw = s.yaw; }

export function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
