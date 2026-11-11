// The playable arena: lighting, playmat floor, and the shared obstacle boxes
// dressed up as oversized toy blocks. Collision still comes from the plain
// AABBs in shared/map.js; everything here is presentation.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OBSTACLES, ARENA_SIZE } from "./shared/map.js";

export const NIGHT_SKY = 0x151a3d;

/** Glossy toy plastic: saturated colour, low roughness, a hint of sheen from the environment map. */
export function plastic(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.04, ...extra });
}

/**
 * An unlit material brighter than white, so the bloom pass picks it up as a
 * light source. (`intensity` multiplies the colour beyond 1.0 in linear space.)
 */
export function glow(color, intensity = 2.5, extra = {}) {
  const material = new THREE.MeshBasicMaterial({ ...extra });
  material.color.set(color).multiplyScalar(intensity);
  return material;
}

/**
 * Builds the level into `scene`.
 * Returns { solids, lights }: the meshes the camera should collide with, and the
 * global lights (dimmed by the Lights Out chaos event).
 */
export function buildWorld(scene, renderer) {
  scene.background = new THREE.Color(NIGHT_SKY);
  scene.fog = new THREE.Fog(NIGHT_SKY, 90, 260);

  // --- Lighting: a moonlit playroom after bedtime -------------------------
  // Soft image-based fill so plastic and metal have something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xc9d6ff, 0x4a3560, 0.7);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xe6ecff, 1.8);
  moon.position.set(34, 58, 22);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = sc.bottom = -ARENA_SIZE / 2 - 6;
  sc.right = sc.top = ARENA_SIZE / 2 + 6;
  sc.near = 1; sc.far = 160;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.04;   // removes acne on the rounded block edges
  scene.add(moon);

  // --- Floor: a soft checkered playmat -------------------------------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
    new THREE.MeshStandardMaterial({ map: playmatTexture(renderer), roughness: 0.85, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- Obstacles -------------------------------------------------------------
  // Rounded boxes read as chunky toy blocks. The corner radius is small, so
  // the visual stays within a few centimetres of the collision box.
  const solids = [floor];
  const studded = [];
  for (const o of OBSTACLES) {
    const isWall = o.kind === "wall";
    const radius = Math.min(0.18, o.w * 0.2, o.h * 0.2, o.d * 0.2);
    const geometry = isWall ? new THREE.BoxGeometry(o.w, o.h, o.d) : new RoundedBoxGeometry(o.w, o.h, o.d, 3, radius);
    const material = o.kind === "vault"
      ? new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.28, metalness: 0.55, emissive: 0x4a3200 })
      : plastic(o.color, isWall ? { roughness: 0.7 } : {});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(o.x, o.y, o.z);
    mesh.castShadow = !isWall;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
    if (o.kind === "block") studded.push(o);
    if (isWall) scene.add(wallTrim(o));
  }
  scene.add(createStuds(studded));
  scene.add(createVaultDoor());

  return { solids, lights: { hemi, moon } };
}

// 2 x 2 tiles of a pastel checker with a stitched border; tiled across the arena.
function playmatTexture(renderer) {
  const size = 256, half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const tones = ["#3b4a9c", "#33418c"];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * half, y = Math.floor(i / 2) * half;
    ctx.fillStyle = tones[(i + Math.floor(i / 2)) % 2];
    ctx.fillRect(x, y, half, half);
    ctx.strokeStyle = "rgba(170, 190, 255, .35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(x + 8, y + 8, half - 16, half - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 255, 255, .10)";
    ctx.beginPath();
    ctx.arc(x + half / 2, y + half / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(ARENA_SIZE / 8, ARENA_SIZE / 8);   // each tile is 4 m
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

// A bright cap along the top of each perimeter wall.
function wallTrim(o) {
  const trim = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.3, 0.35, o.d + 0.3), plastic(0xffe14d));
  trim.position.set(o.x, o.maxY + 0.17, o.z);
  return trim;
}

// Building-brick studs on top of every block, drawn as one instanced mesh.
function createStuds(blocks) {
  const SPACING = 1, RADIUS = 0.3, HEIGHT = 0.1;
  const spots = [];
  for (const o of blocks) {
    const nx = Math.max(1, Math.floor(o.w / SPACING)), nz = Math.max(1, Math.floor(o.d / SPACING));
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        spots.push({
          x: o.x + (ix - (nx - 1) / 2) * SPACING,
          y: o.maxY + HEIGHT / 2 - 0.01,
          z: o.z + (iz - (nz - 1) / 2) * SPACING,
          color: o.color,
        });
      }
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 10), plastic(0xffffff), spots.length);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  spots.forEach((s, i) => {
    mesh.setMatrixAt(i, matrix.makeTranslation(s.x, s.y, s.z));
    mesh.setColorAt(i, color.set(s.color));
  });
  mesh.receiveShadow = true;
  return mesh;
}

// Decorative safe door on the south face of the vault (the side toys approach from).
function createVaultDoor() {
  const vault = OBSTACLES.find((o) => o.kind === "vault");
  const g = new THREE.Group();
  g.position.set(vault.x, vault.y, vault.maxZ + 0.02);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd8dde8, roughness: 0.3, metalness: 0.8 });
  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 24), steel);
  door.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12), steel);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.12;
  g.add(door, hub);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), steel);
    spoke.rotation.z = (i / 3) * Math.PI;
    spoke.position.z = 0.2;
    g.add(spoke);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 32), glow(0xffc531, 2.2));
  g.add(halo);
  return g;
}
