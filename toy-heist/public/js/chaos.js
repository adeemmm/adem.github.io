// Client-side presentation of Chaos Mode events (rules live on the server in
// server/sim/TwitchChaos.js):
//   Lights Out   fades the world lighting to near black; guard flashlights are
//                separate SpotLights on the guard models, so they keep working.
//   Banana Rain  mirrors `state.hazards` as banana meshes that drop from the sky.
//   Zero Gravity needs no visuals here: the shared movement code handles it.
import * as THREE from "three";
import { CHAOS_EVENT, CHAOS_LIGHTS_OUT } from "./shared/constants.js";

const DARK_LEVEL = 0.03;          // fraction of normal light left during Lights Out
const DARK_COLOR = new THREE.Color(0x020207);
const BANANA_DROP_HEIGHT = 14;
const BANANA_DROP_SECONDS = 0.7;

function createBanana() {
  const g = new THREE.Group();
  const peel = new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.6, flatShading: true, emissive: 0x4d3f00 });
  const tip = new THREE.MeshStandardMaterial({ color: 0x5b3a1a, roughness: 0.8, flatShading: true });
  // A fat arc lying on its side.
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 5, 8, Math.PI * 1.1), peel);
  arc.rotation.x = Math.PI / 2;
  arc.position.y = 0.13;
  arc.castShadow = true;
  g.add(arc);
  for (const angle of [0, Math.PI * 1.1]) {
    const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), tip);
    cap.position.set(Math.cos(angle) * 0.42, 0.13, -Math.sin(angle) * 0.42);
    g.add(cap);
  }
  return g;
}

export class ChaosEffects {
  /** lights: { hemi, moon } from buildWorld(); their current intensities are the "normal" look. */
  constructor(scene, lights) {
    this.scene = scene;
    this.lights = lights;
    this.base = {
      hemi: lights.hemi.intensity,
      moon: lights.moon.intensity,
      background: scene.background.clone(),
      fog: scene.fog.color.clone(),
    };
    this.darkness = 0;        // 0 = normal lighting, 1 = lights fully out (eased)
    this.lightsOut = false;
    this.bananas = new Map(); // hazard id -> { model, x, z, age, spin }
  }

  /** Mirror replicated state. Call on every state patch. */
  sync(state) {
    this.lightsOut = state.chaos.phase === CHAOS_EVENT && state.chaos.event === CHAOS_LIGHTS_OUT;

    state.hazards.forEach((h, id) => {
      if (this.bananas.has(id)) return;
      const model = createBanana();
      model.rotation.y = Number(id) * 2.4;
      this.scene.add(model);
      // Stagger the drops slightly so it reads as rain rather than one slab.
      this.bananas.set(id, { model, x: h.x, z: h.z, age: -(Number(id) % 5) * 0.08 });
    });
    for (const [id, b] of this.bananas) {
      if (state.hazards.has(id)) continue;
      this.removeBanana(id, b);
    }
  }

  removeBanana(id, b) {
    this.scene.remove(b.model);
    b.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.bananas.delete(id);
  }

  clear() {
    for (const [id, b] of this.bananas) this.removeBanana(id, b);
    this.lightsOut = false;
  }

  update(dt) {
    // Lighting eases in and out over roughly a second.
    const target = this.lightsOut ? 1 : 0;
    if (this.darkness !== target) {
      this.darkness += (target - this.darkness) * (1 - Math.exp(-4 * dt));
      if (Math.abs(target - this.darkness) < 0.002) this.darkness = target;
      const level = 1 - this.darkness * (1 - DARK_LEVEL);
      this.lights.hemi.intensity = this.base.hemi * level;
      this.lights.moon.intensity = this.base.moon * level;
      this.scene.background.copy(this.base.background).lerp(DARK_COLOR, this.darkness);
      this.scene.fog.color.copy(this.base.fog).lerp(DARK_COLOR, this.darkness);
    }

    for (const b of this.bananas.values()) {
      b.age += dt;
      const k = Math.min(1, Math.max(0, b.age / BANANA_DROP_SECONDS));
      b.model.visible = b.age >= 0;
      b.model.position.set(b.x, BANANA_DROP_HEIGHT * (1 - k * k), b.z);   // accelerating fall
      if (k < 1) b.model.rotation.x = (1 - k) * 6; else b.model.rotation.x = 0;
    }
  }
}
