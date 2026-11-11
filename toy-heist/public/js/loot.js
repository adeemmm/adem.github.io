// Loot rendering: low-poly item meshes plus a view that mirrors the
// replicated `state.loot` map into the scene.
//   - Free items idle on the floor, bobbing and spinning so they read as pickups.
//   - Carried items float above their carrier's head as the "holding" indicator.
import * as THREE from "three";
import { ROLE_STATS, ROLE_TOY } from "./shared/constants.js";

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...extra });
const BLOCK_COLORS = [0xef476f, 0x06d6a0, 0x4cc9f0, 0xf78c6b, 0x9b5de5];

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
  }

  /** Mirror the replicated loot map. Cheap enough to call on every state patch. */
  sync(lootState) {
    lootState.forEach((l, id) => {
      let item = this.items.get(id);
      if (!item) {
        item = { id, type: null, model: null, x: 0, y: 0, z: 0, carrier: 0, phase: Number(id) * 1.7 };
        this.items.set(id, item);
      }
      if (item.type !== l.type) {       // new item, or respawned as a different type
        if (item.model) { this.scene.remove(item.model); dispose(item.model); }
        item.type = l.type;
        item.model = createLootModel(l.type, Number(id));
        this.scene.add(item.model);
      }
      item.x = l.x; item.y = l.y; item.z = l.z; item.carrier = l.carrier;
    });
    for (const [id, item] of this.items) {
      if (lootState.has(id)) continue;
      this.scene.remove(item.model); dispose(item.model);
      this.items.delete(id);
    }
  }

  clear() {
    for (const item of this.items.values()) { this.scene.remove(item.model); dispose(item.model); }
    this.items.clear();
  }

  /**
   * Per-frame placement. `avatarOf(nid)` returns the Object3D of the player
   * with that network id (or null if we are not currently drawing them).
   */
  update(time, avatarOf) {
    for (const item of this.items.values()) {
      const m = item.model;
      const t = time * 0.001 + item.phase;
      if (item.carrier === 0) {
        m.visible = true;
        m.scale.setScalar(1);
        m.position.set(item.x, item.y + 0.12 + Math.sin(t * 2.2) * 0.08, item.z);
        m.rotation.y = t * 0.9;
        continue;
      }
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
