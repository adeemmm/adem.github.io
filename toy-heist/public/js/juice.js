// Game feel helpers. Purely cosmetic: they read where things are being drawn
// and add motion on top; nothing here feeds back into prediction or networking.
import * as THREE from "three";

// ------------------------------------------------------------ avatar juice --

const SPRING = 170, DAMPING = 14;   // squash spring (1/s^2, 1/s)
const SPRING_STEP = 1 / 120;

/**
 * Squash-and-stretch, landing squish and a forward lean for player models,
 * driven only by how each model moves between frames. Works the same for the
 * predicted local player and interpolated remote players.
 */
export class AvatarJuice {
  constructor({ onLand = () => {} } = {}) {
    this.states = new WeakMap();   // model -> motion state
    this.onLand = onLand;          // (model, impact 0..1) when a model touches down
  }

  /** Call every frame after positioning `model`. `topSpeed` scales the lean. */
  update(model, dt, topSpeed) {
    let s = this.states.get(model);
    const p = model.position;
    if (!s) {
      s = { x: p.x, y: p.y, z: p.z, vy: 0, offset: 0, velocity: 0, lean: 0, airTime: 0 };
      this.states.set(model, s);
      model.rotation.order = "YXZ";   // yaw first, then lean about the model's own side axis
      return;
    }
    if (dt <= 0) return;

    const dx = p.x - s.x, dy = p.y - s.y, dz = p.z - s.z;
    s.x = p.x; s.y = p.y; s.z = p.z;
    if (dx * dx + dy * dy + dz * dz > 9) { s.vy = 0; s.airTime = 0; return; }   // teleported: no reaction

    const vy = dy / dt;
    const airborne = Math.abs(vy) > 0.6;
    // Touchdown: was falling fast, now vertically at rest.
    if (!airborne && s.vy < -4 && s.airTime > 0.12) {
      const impact = Math.min(1, -s.vy / 16);
      s.velocity -= 4.5 * impact;            // kick the spring downwards = squash
      this.onLand(model, impact);
    }
    s.airTime = airborne ? s.airTime + dt : 0;
    s.vy = vy;

    // Damped spring back to rest, plus a stretch proportional to vertical speed.
    // Integrated in small fixed steps so a slow frame cannot make it explode.
    for (let left = Math.min(dt, 0.1); left > 0; left -= SPRING_STEP) {
      const h = Math.min(SPRING_STEP, left);
      s.velocity += (-SPRING * s.offset - DAMPING * s.velocity) * h;
      s.offset += s.velocity * h;
    }
    const stretch = THREE.MathUtils.clamp(vy * 0.012, -0.1, 0.16);
    const sy = THREE.MathUtils.clamp(1 + s.offset + stretch, 0.6, 1.35);
    const sxz = 1 / Math.sqrt(sy);           // preserve volume
    model.scale.set(sxz, sy, sxz);

    // Lean into the run.
    const speed = Math.hypot(dx, dz) / dt;
    const lean = Math.min(1.3, speed / topSpeed) * 0.14;
    s.lean += (lean - s.lean) * (1 - Math.exp(-10 * dt));
    model.rotation.x = -s.lean;
  }
}

// --------------------------------------------------------------- particles --

const MAX_PARTICLES = 384;
const GRAVITY = -9;

/** A small pooled point-sprite system for dust puffs and sparkles: one draw call. */
export class Particles {
  constructor(scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3).fill(-999);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);       // seconds remaining
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.base = new Float32Array(MAX_PARTICLES * 3);   // un-faded colour
    this.next = 0;
    this.alive = 0;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;   // positions change every frame
    scene.add(this.points);
    this.color = new THREE.Color();
  }

  /**
   * Emit `count` particles at `pos`. `spread` is the outward speed (m/s),
   * `lift` the upward speed, `brightness` > 1 makes them bloom.
   */
  burst(pos, { count = 12, color = 0xffffff, spread = 2, lift = 2, life = 0.6, brightness = 1 } = {}) {
    this.color.set(color).multiplyScalar(brightness);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
      this.positions[i * 3] = pos.x; this.positions[i * 3 + 1] = pos.y + 0.1; this.positions[i * 3 + 2] = pos.z;
      this.velocities[i * 3] = Math.cos(a) * r;
      this.velocities[i * 3 + 1] = lift * (0.5 + Math.random() * 0.8);
      this.velocities[i * 3 + 2] = Math.sin(a) * r;
      this.base[i * 3] = this.color.r; this.base[i * 3 + 1] = this.color.g; this.base[i * 3 + 2] = this.color.b;
      this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
    }
    this.alive = MAX_PARTICLES;   // something may be alive: run the update loop
  }

  update(dt) {
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) { this.positions[j + 1] = -999; continue; }
      alive++;
      this.velocities[j + 1] += GRAVITY * dt;
      this.positions[j] += this.velocities[j] * dt;
      this.positions[j + 1] = Math.max(0.03, this.positions[j + 1] + this.velocities[j + 1] * dt);
      this.positions[j + 2] += this.velocities[j + 2] * dt;
      const fade = this.life[i] / this.maxLife[i];   // additive blending: fading colour = fading out
      this.colors[j] = this.base[j] * fade; this.colors[j + 1] = this.base[j + 1] * fade; this.colors[j + 2] = this.base[j + 2] * fade;
    }
    this.alive = alive;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
