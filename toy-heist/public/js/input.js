// Keyboard + pointer-lock mouse input. Produces camera yaw/pitch and a
// per-tick movement sample; knows nothing about networking or rendering.

const PITCH_MIN = -1.2;   // looking up from below
const PITCH_MAX = 1.35;   // looking down from above

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;             // camera yaw; 0 looks down -Z
    this.pitch = 0.35;        // positive = camera above the player looking down
    this.zoom = 7;            // desired camera distance
    this.sensitivity = 0.0024;
    this.enabled = false;     // set true once in a room
    this.interactQueued = false;   // E was pressed since the last sim tick
    this.attackQueued = false;     // F / left click since the last sim tick

    addEventListener("keydown", (e) => {
      if (!this.locked) return;
      this.keys.add(e.code);
      if (e.code === "KeyE" && !e.repeat) this.interactQueued = true;
      if (e.code === "KeyF" && !e.repeat) this.attackQueued = true;
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    // Left click while the mouse is captured = arrest. (The click that captures
    // the mouse arrives before the lock, so it never counts.)
    document.addEventListener("mousedown", (e) => {
      if (this.locked && e.button === 0) this.attackQueued = true;
    });
    canvas.addEventListener("click", () => {
      if (this.enabled && !this.locked) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      if (!this.locked) this.keys.clear();
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch += e.movementY * this.sensitivity;
      this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
    });
    canvas.addEventListener("wheel", (e) => {
      this.zoom = Math.max(3, Math.min(14, this.zoom + Math.sign(e.deltaY) * 0.8));
      e.preventDefault();
    }, { passive: false });
  }

  get locked() { return document.pointerLockElement === this.canvas; }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }

  /** One movement sample for a simulation tick (matches the shared input shape). */
  sample(seq) {
    const interact = this.interactQueued, attack = this.attackQueued;
    this.interactQueued = this.attackQueued = false;
    return {
      s: seq,
      f: (this.down("KeyW", "ArrowUp") ? 1 : 0) - (this.down("KeyS", "ArrowDown") ? 1 : 0),
      r: (this.down("KeyD", "ArrowRight") ? 1 : 0) - (this.down("KeyA", "ArrowLeft") ? 1 : 0),
      y: this.yaw,
      j: this.down("Space"),
      e: interact,   // edge-triggered: true for exactly one tick per press
      h: this.down("KeyE"),   // held: pulling the jail lever
      a: attack,     // edge-triggered arrest
    };
  }
}
