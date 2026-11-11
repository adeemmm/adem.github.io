// Third-person chase camera: orbits a pivot above the player's head using the
// mouse yaw/pitch, and raycasts from pivot to the desired position so level
// geometry never sits between the camera and the player.
import * as THREE from "three";

const WALL_MARGIN = 0.35;   // keep this far in front of whatever we hit
const MIN_DISTANCE = 0.8;

export class ChaseCamera {
  constructor(camera, solids) {
    this.camera = camera;
    this.solids = solids;                 // meshes that block the camera
    this.raycaster = new THREE.Raycaster();
    this.distance = 7;                    // current (smoothed) boom length
    this.pivot = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.initialised = false;

    // Feel: all additive offsets on top of the follow logic.
    this.baseFov = camera.fov;
    this.trauma = 0;        // 0..1, decays; shake amplitude is trauma squared
    this.dip = 0;           // vertical spring offset (m) for jump / landing
    this.dipVelocity = 0;
    this.roll = 0;          // radians, eased towards the strafe direction
    this.clock = 0;
  }

  /** Add screen shake. 0.3 is a nudge, 1 is the maximum. */
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  /** The player left the ground: the view lifts a touch. */
  jump() { this.dipVelocity += 1.4; }

  /** The player touched down with `impact` 0..1: the view dips and shakes. */
  land(impact) {
    this.dipVelocity -= 1.5 + impact * 3.5;
    this.shake(impact * 0.45);
  }

  /**
   * target: player feet position (Vector3), headHeight: pivot offset,
   * yaw/pitch/zoom: from Input, dt: frame delta seconds.
   * feel: { strafe: -1..1 sideways input, speed: current speed / normal top speed }.
   */
  update(target, headHeight, yaw, pitch, zoom, dt, feel = { strafe: 0, speed: 1 }) {
    this.clock += dt;
    // Jump / landing spring (critically-ish damped so it settles in ~0.3 s).
    // Integrated in small fixed steps so a slow frame cannot make it explode.
    for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 120) {
      const h = Math.min(1 / 120, left);
      this.dipVelocity += (-140 * this.dip - 17 * this.dipVelocity) * h;
      this.dip = THREE.MathUtils.clamp(this.dip + this.dipVelocity * h, -0.6, 0.4);
    }

    // Follow the player tightly on XZ but damp vertical motion so jumps and
    // step-ups do not jolt the view.
    const pivotY = target.y + headHeight;
    if (!this.initialised) { this.pivot.set(target.x, pivotY, target.z); this.initialised = true; }
    this.pivot.x = target.x;
    this.pivot.z = target.z;
    this.pivot.y += (pivotY - this.pivot.y) * (1 - Math.exp(-12 * dt));
    this.pivot.y += this.dip;

    // Unit vector from pivot towards the camera (behind and above the player).
    const cp = Math.cos(pitch);
    this.dir.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);

    // Wall-clip prevention: shorten the boom to the first hit.
    let allowed = zoom;
    this.raycaster.set(this.pivot, this.dir);
    this.raycaster.far = zoom + WALL_MARGIN;
    const hit = this.raycaster.intersectObjects(this.solids, false)[0];
    if (hit) allowed = Math.max(MIN_DISTANCE, hit.distance - WALL_MARGIN);

    // Pull in instantly (never show the inside of a wall), ease back out.
    if (allowed < this.distance) this.distance = allowed;
    else this.distance += (allowed - this.distance) * (1 - Math.exp(-6 * dt));

    this.camera.position.copy(this.pivot).addScaledVector(this.dir, this.distance);
    this.camera.lookAt(this.pivot);
    this.pivot.y -= this.dip;   // the dip is an offset, not part of the follow state

    // Tilt into strafes, and shake from accumulated trauma (smooth pseudo-noise).
    this.roll += (-feel.strafe * 0.022 - this.roll) * (1 - Math.exp(-8 * dt));
    const s = this.trauma * this.trauma, t = this.clock;
    this.camera.rotation.z += this.roll + s * 0.035 * Math.sin(t * 61.3);
    this.camera.position.x += s * 0.16 * Math.sin(t * 47.1 + 1.7);
    this.camera.position.y += s * 0.16 * Math.sin(t * 53.9 + 4.1);
    this.trauma = Math.max(0, this.trauma - dt * 1.8);

    // Widen the lens a little when moving faster than a normal run (boost, zero gravity).
    const fov = this.baseFov + THREE.MathUtils.clamp((feel.speed - 1) * 16, 0, 9);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
