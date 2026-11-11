// Contact shadows: a soft dark blob on the ground under every player and
// loot item. They anchor characters visually, especially mid-jump or while
// loot floats, where the real shadow map is too soft or too far away to read.
//
// All blobs are one InstancedMesh (one draw call) with a tiny shader that
// computes the radial falloff analytically, so there is no texture and no
// per-object material.
import * as THREE from "three";
import { groundHeightAt } from "./shared/map.js";

const MAX_BLOBS = 96;          // 32 players + 24 loot, with headroom
const FADE_HEIGHT = 7;         // metres above ground at which a blob is faintest
const LIFT = 0.025;            // keep clear of the surface to avoid z-fighting

const material = new THREE.ShaderMaterial({
  vertexShader: /* glsl */`
    attribute float strength;
    varying vec2 vUv;
    varying float vStrength;
    void main() {
      vUv = uv;
      vStrength = strength;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    varying vec2 vUv;
    varying float vStrength;
    void main() {
      float r = length(vUv - 0.5) * 2.0;                 // 0 at the centre, 1 at the rim
      float alpha = vStrength * pow(1.0 - smoothstep(0.0, 1.0, r), 1.6);
      gl_FragColor = vec4(0.0, 0.0, 0.05, alpha);        // very dark blue, to sit in the night palette
    }
  `,
  transparent: true,
  depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

export class ContactShadows {
  constructor(scene) {
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.strengths = new Float32Array(MAX_BLOBS);
    geometry.setAttribute("strength", new THREE.InstancedBufferAttribute(this.strengths, 1));
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_BLOBS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;   // instances are spread across the whole arena
    this.mesh.renderOrder = 1;         // after the opaque floor and blocks
    scene.add(this.mesh);
    this.matrix = new THREE.Matrix4();
    this.count = 0;
  }

  /** Start a new frame's worth of blobs. */
  begin() { this.count = 0; }

  /**
   * Add a blob under something at (x, y, z), where y is the object's lowest
   * point. `radius` is the blob radius when the object touches the ground.
   * The surface is found from the shared level geometry, so blobs land on top
   * of blocks as well as on the floor.
   */
  add(x, y, z, radius, darkness = 0.5) {
    if (this.count >= MAX_BLOBS) return;
    const ground = groundHeightAt(x, z, y + 0.3);
    const height = Math.max(0, y - ground);
    const k = Math.min(1, height / FADE_HEIGHT);
    const size = radius * 2 * (1 + k * 0.9);            // higher = wider and fainter
    this.matrix.makeScale(size, 1, size).setPosition(x, ground + LIFT, z);
    this.mesh.setMatrixAt(this.count, this.matrix);
    this.strengths[this.count] = darkness * (1 - k * 0.8);
    this.count++;
  }

  /** Upload this frame's blobs. */
  end() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.geometry.attributes.strength.needsUpdate = true;
  }
}
