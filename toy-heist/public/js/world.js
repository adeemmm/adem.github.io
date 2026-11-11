// Static low-poly environment: lights, floor + grid, and the shared obstacle boxes.
import * as THREE from "three";
import { OBSTACLES, ARENA_SIZE, EXTRACTION_ZONES } from "./shared/map.js";

/**
 * Builds the level into `scene`. Returns { solids, lights }: the meshes the camera
 * should collide with, and the global lights (dimmed by the Lights Out chaos event).
 */
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x1b1d3a);
  scene.fog = new THREE.Fog(0x1b1d3a, 60, 150);

  // Lighting: dim "after hours" ambience so guard flashlights read clearly.
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2f4a, 1.1);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xfff1d6, 1.6);
  moon.position.set(30, 50, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = sc.bottom = -ARENA_SIZE / 2 - 5;
  sc.right = sc.top = ARENA_SIZE / 2 + 5;
  sc.near = 1; sc.far = 140;
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  // Floor + grid
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(ARENA_SIZE, ARENA_SIZE / 2, 0x7f85c9, 0x565a8a);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  // Obstacles straight from the shared collision data, so what you see is
  // exactly what the server collides against.
  const solids = [floor];
  for (const o of OBSTACLES) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(o.w, o.h, o.d),
      new THREE.MeshStandardMaterial({
        color: o.color, roughness: 0.8, flatShading: true,
        emissive: o.kind === "vault" ? 0x5a4000 : 0x000000,
      }),
    );
    mesh.position.set(o.x, o.y, o.z);
    mesh.castShadow = o.kind !== "wall";
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
  }
  for (const zone of EXTRACTION_ZONES) scene.add(createExtractionChute(zone));
  return { solids, lights: { hemi, moon } };
}

// Extraction chute marker: a dark "hole", a bright rim and a tall light beam
// so toys can find the drop-off from across the arena.
function createExtractionChute(zone) {
  const g = new THREE.Group();
  g.position.set(zone.x, 0, zone.z);

  const hole = new THREE.Mesh(new THREE.CircleGeometry(zone.r, 24), new THREE.MeshBasicMaterial({ color: 0x06281f }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.02;

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(zone.r - 0.3, zone.r, 24),
    new THREE.MeshBasicMaterial({ color: 0x06d6a0, side: THREE.DoubleSide }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.04;

  const BEAM_H = 14;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(zone.r, zone.r, BEAM_H, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x06d6a0, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = BEAM_H / 2;

  g.add(hole, rim, beam);
  return g;
}
