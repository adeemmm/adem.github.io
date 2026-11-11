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
  }

  /**
   * target: player feet position (Vector3), headHeight: pivot offset,
   * yaw/pitch/zoom: from Input, dt: frame delta seconds.
   */
  update(target, headHeight, yaw, pitch, zoom, dt) {
    // Follow the player tightly on XZ but damp vertical motion so jumps and
    // step-ups do not jolt the view.
    const pivotY = target.y + headHeight;
    if (!this.initialised) { this.pivot.set(target.x, pivotY, target.z); this.initialised = true; }
    this.pivot.x = target.x;
    this.pivot.z = target.z;
    this.pivot.y += (pivotY - this.pivot.y) * (1 - Math.exp(-12 * dt));

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
  }
}
