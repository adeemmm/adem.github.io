// Toy Jail presentation: the laser-fenced cell, the jailbreak lever, and the
// guard HUD target markers. All gameplay rules live on the server
// (server/sim/JailSystem.js, VisionSystem.js); this file only draws state.
import * as THREE from "three";
import { JAIL, JAIL_LEVER } from "./shared/map.js";
import { LEVER_RANGE } from "./shared/constants.js";

const FENCE_HEIGHT = 2.6;
const LEVER_REST = -0.75, LEVER_PULLED = 0.75;   // handle tilt (radians) at 0% / 100%

function label(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(4, 1, 1);
  return sprite;
}

export class JailView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.handleAngle = LEVER_REST;
    this.buildCell();
    this.buildLever();
  }

  buildCell() {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(JAIL.w, JAIL.d),
      new THREE.MeshStandardMaterial({ color: 0x2a1520, roughness: 0.9 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(JAIL.x, 0.03, JAIL.z);
    pad.receiveShadow = true;
    this.group.add(pad);

    // Corner posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f5c, roughness: 0.5, metalness: 0.4, flatShading: true });
    const postGeo = new THREE.CylinderGeometry(0.18, 0.22, FENCE_HEIGHT + 0.3, 6);
    for (const px of [JAIL.minX, JAIL.maxX]) {
      for (const pz of [JAIL.minZ, JAIL.maxZ]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, (FENCE_HEIGHT + 0.3) / 2, pz);
        post.castShadow = true;
        this.group.add(post);
      }
    }

    // Laser rails between the posts (one shared material so they pulse together).
    this.laserMat = new THREE.MeshBasicMaterial({
      color: 0xff3b3b, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const railX = new THREE.BoxGeometry(JAIL.w, 0.07, 0.07);
    const railZ = new THREE.BoxGeometry(0.07, 0.07, JAIL.d);
    for (let i = 1; i <= 4; i++) {
      const y = (FENCE_HEIGHT / 4) * i;
      for (const pz of [JAIL.minZ, JAIL.maxZ]) {
        const rail = new THREE.Mesh(railX, this.laserMat);
        rail.position.set(JAIL.x, y, pz);
        this.group.add(rail);
      }
      for (const px of [JAIL.minX, JAIL.maxX]) {
        const rail = new THREE.Mesh(railZ, this.laserMat);
        rail.position.set(px, y, JAIL.z);
        this.group.add(rail);
      }
    }

    const sign = label("TOY JAIL", "#ff8fa3");
    sign.position.set(JAIL.x, FENCE_HEIGHT + 1.4, JAIL.z);
    this.group.add(sign);
  }

  buildLever() {
    const lever = new THREE.Group();
    lever.position.set(JAIL_LEVER.x, 0, JAIL_LEVER.z);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3a3f5c, roughness: 0.6, flatShading: true }),
    );
    base.position.y = 0.25;
    base.castShadow = true;

    // Handle pivots at the top of the base and swings across as the hold progresses.
    this.handle = new THREE.Group();
    this.handle.position.y = 0.5;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3 }),
    );
    stick.position.y = 0.55;
    this.knobMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x000000, roughness: 0.4, flatShading: true });
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), this.knobMat);
    knob.position.y = 1.15;
    knob.castShadow = true;
    this.handle.add(stick, knob);

    // Ground ring showing how close a toy must stand to pull it.
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(LEVER_RANGE - 0.15, LEVER_RANGE, 32), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;

    const tag = label("LEVER", "#ffd166");
    tag.scale.set(2.4, 0.6, 1);
    tag.position.y = 2.2;

    lever.add(base, this.handle, ring, tag);
    this.group.add(lever);
  }

  /**
   * jailedCount: toys currently inside; leverProgress: 0-100 from replicated state.
   * The fence glows while occupied and the lever lights up when it can be used.
   */
  update(time, dt, jailedCount, leverProgress) {
    const occupied = jailedCount > 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.006);
    this.laserMat.opacity = occupied ? 0.55 + 0.35 * pulse : 0.15;
    this.ringMat.opacity = occupied ? 0.35 + 0.35 * pulse : 0.12;
    this.knobMat.emissive.setHex(occupied ? 0x8a6a00 : 0x000000);

    const target = LEVER_REST + (LEVER_PULLED - LEVER_REST) * (leverProgress / 100);
    this.handleAngle += (target - this.handleAngle) * (1 - Math.exp(-14 * dt));
    this.handle.rotation.z = this.handleAngle;
  }
}

/** Is a body at (x, z) close enough to work the lever? Mirrors JailSystem.canUseLever. */
export function inLeverRange(x, z) {
  const dx = x - JAIL_LEVER.x, dz = z - JAIL_LEVER.z;
  return dx * dx + dz * dz <= LEVER_RANGE * LEVER_RANGE;
}

/**
 * Guard HUD: a red reticle over every toy the server says is in the flashlight
 * beam. DOM elements are pooled and moved with transforms only.
 */
export class TargetMarkers {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.pool = [];
    this.v = new THREE.Vector3();
  }

  /** points: array of { x, y, z } world positions to mark (y = aim height). */
  update(points) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    let used = 0;
    for (const p of points) {
      this.v.set(p.x, p.y, p.z).project(this.camera);
      if (this.v.z < -1 || this.v.z > 1) continue;   // behind the camera / outside the frustum depth
      const el = this.pool[used] || this.grow();
      el.style.display = "block";
      el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px)`;
      used++;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i].style.display = "none";
  }

  grow() {
    const el = document.createElement("div");
    el.className = "target";
    this.container.append(el);
    this.pool.push(el);
    return el;
  }
}
