// Static low-poly environment: lights, floor + grid, and the shared obstacle boxes.
import * as THREE from "three";
import { OBSTACLES, ARENA_SIZE } from "./shared/map.js";

/** Builds the level into `scene`. Returns the meshes the camera should collide with. */
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x1b1d3a);
  scene.fog = new THREE.Fog(0x1b1d3a, 60, 150);

  // Lighting: dim "after hours" ambience so guard flashlights read clearly.
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2f4a, 1.1));
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
  return solids;
}
