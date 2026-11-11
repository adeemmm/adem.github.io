// Loot rendering: low-poly item meshes plus a view that mirrors the
// replicated `state.loot` map into the scene.
//   - Free items idle on the floor, bobbing and spinning so they read as pickups.
//   - Carried items float above their carrier's head as the "holding" indicator.
import * as THREE from "three";
import { ROLE_STATS, ROLE_TOY } from "./shared/constants.js";
import { markGlow } from "./postfx.js";

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05, flatShading: true, ...extra });
const BLOCK_COLORS = [0xff3b5c, 0x16db93, 0x18d6ff, 0xff7a2f, 0xa259ff];

// Pulsing halo on the floor under every free item, tinted by how valuable it is.
// Geometry and materials are shared; the colours are brighter than white so they bloom.
const HALO_GEOMETRY = new THREE.RingGeometry(0.55, 0.72, 28).rotateX(-Math.PI / 2);
const haloMaterial = (color) => {
  const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  m.color.set(color).multiplyScalar(1.8);
  return markGlow(m);
};
const HALO_MATERIALS = { block: haloMaterial(0x7fd4ff), coin: haloMaterial(0xffc531), teddy: haloMaterial(0xff5fb7) };
const POP_SECONDS = 0.35;   // spawn / drop "pop-in" duration

function shadowed(mesh) { mesh.castShadow = true; return mesh; }

function createBlock(id) {
  const g = new THREE.Group();
  const cube = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), flat(BLOCK_COLORS[id % BLOCK_COLORS.length])));
  cube.position.y = 0.35;
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8), cube.material);
  stud.position.y = 0.76;
  g.add(cube, stud);
  return g;
}

function createCoins() {
  const g = new THREE.Group();
  const mat = flat(0xffd166, { metalness: 0.7, roughness: 0.25, emissive: 0x6b4e00 });
  const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10);
  for (let i = 0; i < 4; i++) {
    const coin = shadowed(new THREE.Mesh(geo, mat));
    coin.position.set((i % 2) * 0.06 - 0.03, 0.05 + i * 0.11, ((i + 1) % 2) * 0.05);
    g.add(coin);
  }
  const leaning = shadowed(new THREE.Mesh(geo, mat));
  leaning.position.set(0.42, 0.3, 0);
  leaning.rotation.z = 1.2;
  g.add(leaning);
  return g;
}

function createTeddy() {
  const g = new THREE.Group();
  const fur = flat(0xa9714b), pale = flat(0xe6c9a8), dark = flat(0x2b1d14);
  const ball = (r, mat, x, y, z) => {
    const m = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  ball(0.42, fur, 0, 0.45, 0);                    // body
  ball(0.24, pale, 0, 0.45, -0.26);               // belly patch
  ball(0.32, fur, 0, 1.02, 0);                    // head
  ball(0.13, pale, 0, 0.95, -0.27);               // snout
  ball(0.045, dark, 0, 0.99, -0.39);              // nose
  for (const s of [-1, 1]) {
    ball(0.12, fur, s * 0.26, 1.3, 0);            // ears
    ball(0.04, dark, s * 0.12, 1.1, -0.28);       // eyes
    ball(0.15, fur, s * 0.45, 0.6, -0.08);        // arms
    ball(0.17, fur, s * 0.25, 0.12, -0.2);        // legs
  }
  return g;
}

export function createLootModel(type, id = 0) {
  if (type === "coin") return createCoins();
  if (type === "teddy") return createTeddy();
  return createBlock(id);
}

function dispose(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

export class LootView {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();   // loot id -> { id, type, model, x, y, z, carrier, phase }
    // Called when an item changes hands: ("pickup", item) or ("drop", item).
    // Not fired for the initial sync or for respawns.
    this.onChange = () => {};
    this.lastTime = 0;
  }

  /** Mirror the replicated loot map. Cheap enough to call on every state patch. */
  sync(lootState) {
    lootState.forEach((l, id) => {
      let item = this.items.get(id);
      const isNew = !item;
      if (isNew) {
        item = { id, type: null, model: null, halo: null, x: 0, y: 0, z: 0, carrier: l.carrier, phase: Number(id) * 1.7, pop: 0 };
        item.halo = new THREE.Mesh(HALO_GEOMETRY, HALO_MATERIALS.block);
        this.scene.add(item.halo);
        this.items.set(id, item);
      }
      const previousCarrier = item.carrier;
      if (item.type !== l.type) {       // new item, or respawned as a different type
        if (item.model) { this.scene.remove(item.model); dispose(item.model); }
        item.type = l.type;
        item.model = createLootModel(l.type, Number(id));
        item.halo.material = HALO_MATERIALS[l.type] || HALO_MATERIALS.block;
        item.pop = 0;                   // pop in at the new spot
        this.scene.add(item.model);
      }
      item.x = l.x; item.y = l.y; item.z = l.z; item.carrier = l.carrier;
      if (previousCarrier !== 0 && l.carrier === 0) item.pop = 0;   // just dropped: pop back onto the floor
      if (!isNew && previousCarrier !== l.carrier) this.onChange(l.carrier !== 0 ? "pickup" : "drop", item, previousCarrier);
    });
    for (const [id, item] of this.items) {
      if (lootState.has(id)) continue;
      this.scene.remove(item.model, item.halo); dispose(item.model);
      this.items.delete(id);
    }
  }

  clear() {
    for (const item of this.items.values()) { this.scene.remove(item.model, item.halo); dispose(item.model); }
    this.items.clear();
  }

  /**
   * Per-frame placement. `avatarOf(nid)` returns the Object3D of the player
   * with that network id (or null if we are not currently drawing them).
   */
  update(time, avatarOf) {
    const dt = Math.min(0.1, Math.max(0, (time - this.lastTime) * 0.001));
    this.lastTime = time;
    for (const item of this.items.values()) {
      const m = item.model;
      const t = time * 0.001 + item.phase;
      item.halo.visible = item.carrier === 0;
      if (item.carrier === 0) {
        // Idle: float on a slow bob with a gentle wobble while spinning, and
        // overshoot slightly when popping in so new loot catches the eye.
        item.pop = Math.min(1, item.pop + dt / POP_SECONDS);
        const k = item.pop;
        const pop = k < 1 ? 1 + 0.35 * Math.sin(k * Math.PI) - (1 - k) * (1 - k) : 1;
        m.visible = true;
        m.scale.setScalar(Math.max(0.01, pop));
        m.position.set(item.x, item.y + 0.3 + Math.sin(t * 2.2) * 0.12, item.z);
        m.rotation.set(Math.sin(t * 1.3) * 0.08, t * 0.9, Math.cos(t * 1.1) * 0.08);
        const pulse = 1 + Math.sin(t * 3) * 0.12;
        item.halo.position.set(item.x, item.y + 0.04, item.z);
        item.halo.scale.set(pulse, 1, pulse);
        continue;
      }
      m.rotation.x = m.rotation.z = 0;
      const avatar = avatarOf(item.carrier);
      m.visible = !!avatar && avatar.visible;
      if (!m.visible) continue;
      // Held overhead, shrunk a little so it does not hide the carrier.
      m.scale.setScalar(0.7);
      m.position.copy(avatar.position);
      m.position.y += ROLE_STATS[ROLE_TOY].height + 0.25 + Math.sin(t * 5) * 0.04;
      m.rotation.y = avatar.rotation.y;
    }
  }

  /** The item carried by player `nid`, or null. */
  carriedBy(nid) {
    for (const item of this.items.values()) if (item.carrier === nid) return item;
    return null;
  }

  /** Nearest free item within reach of a body at (x, y, z), or null. Mirrors LootSystem.interact. */
  nearestFree(x, y, z, range, heightRange) {
    let best = null, bestDistSq = range * range;
    for (const item of this.items.values()) {
      if (item.carrier !== 0 || Math.abs(item.y - y) > heightRange) continue;
      const dx = item.x - x, dz = item.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) { best = item; bestDistSq = distSq; }
    }
    return best;
  }
}
