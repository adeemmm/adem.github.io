// Level geometry shared by server (collision) and client (collision + rendering).
// Every solid is an axis-aligned box: centre (x, y, z), full size (w, h, d).

export const ARENA_SIZE = 80;          // playable floor is ARENA_SIZE x ARENA_SIZE
const HALF = ARENA_SIZE / 2;
const WALL_H = 8;
const WALL_T = 2;

function box(x, y, z, w, h, d, color, kind = "block") {
  return {
    x, y, z, w, h, d, color, kind,
    minX: x - w / 2, maxX: x + w / 2,
    minY: y - h / 2, maxY: y + h / 2,
    minZ: z - d / 2, maxZ: z + d / 2,
  };
}

// A box resting on the floor.
const onFloor = (x, z, w, h, d, color, kind) => box(x, h / 2, z, w, h, d, color, kind);

// Saturated "toy box" palette. Colours are only read by the client renderer.
const C = {
  wall: 0x7b6cf6, vault: 0xffc531, step: 0xff9f1c,
  red: 0xff3b5c, green: 0x16db93, blue: 0x2d9bf0, purple: 0xa259ff, pink: 0xff5fb7,
  cyan: 0x18d6ff, yellow: 0xffe14d, mint: 0x2ff3c7, orange: 0xff7a2f, sand: 0xffc86b,
};

export const OBSTACLES = [
  // Perimeter walls
  onFloor(0, -HALF - WALL_T / 2, ARENA_SIZE + WALL_T * 2, WALL_H, WALL_T, C.wall, "wall"),
  onFloor(0,  HALF + WALL_T / 2, ARENA_SIZE + WALL_T * 2, WALL_H, WALL_T, C.wall, "wall"),
  onFloor(-HALF - WALL_T / 2, 0, WALL_T, WALL_H, ARENA_SIZE, C.wall, "wall"),
  onFloor( HALF + WALL_T / 2, 0, WALL_T, WALL_H, ARENA_SIZE, C.wall, "wall"),

  // Central vault: the heist target, with a stepped approach
  onFloor(0, 0, 8, 3, 8, C.vault, "vault"),
  onFloor(6, 0, 4, 1.5, 4, C.step),
  onFloor(0, 6, 4, 1.5, 4, C.step),

  // Giant toy blocks (jumpable staircases for toys, cover from flashlights)
  onFloor(-14, -10, 4, 1.2, 4, C.red),
  onFloor(-18, -10, 4, 2.4, 4, C.red),
  onFloor(-18, -14, 4, 3.6, 4, C.red),
  onFloor(14, 12, 6, 2, 3, C.green),
  onFloor(20, 12, 3, 4, 3, C.green),
  onFloor(16, -18, 3, 3, 10, C.blue),
  onFloor(24, -22, 5, 1.5, 5, C.blue),
  onFloor(-12, 18, 10, 2.5, 3, C.purple),
  onFloor(-24, 22, 4, 4, 4, C.purple),
  onFloor(-28, 0, 3, 5, 12, C.pink),
  onFloor(28, 2, 3, 5, 12, C.cyan),
  onFloor(0, -26, 14, 2, 3, C.yellow),
  onFloor(0, 28, 14, 2, 3, C.mint),
  onFloor(-30, -28, 6, 1, 6, C.orange),
  onFloor(30, 28, 6, 1, 6, C.orange),
  onFloor(8, -8, 2, 1, 2, C.red),
  onFloor(-8, 8, 2, 1, 2, C.green),

  // Floating shelf, reachable from the red staircase
  box(-23, 4.2, -14, 5, 0.6, 4, C.sand),

  // Low barrier walls: hop-over cover that breaks up the open floor.
  // (Both toys and guards can clear 0.9 m with a jump.)
  onFloor(-20, 10, 8, 0.9, 0.8, C.yellow, "barrier"),
  onFloor(20, -6, 0.8, 0.9, 8, C.pink, "barrier"),
  onFloor(-6, -17, 8, 0.9, 0.8, C.cyan, "barrier"),
  onFloor(8, 20, 0.8, 0.9, 6, C.orange, "barrier"),
  onFloor(-34, 14, 6, 0.9, 0.8, C.mint, "barrier"),
  onFloor(34, 16, 6, 0.9, 0.8, C.purple, "barrier"),
];

// Extraction chutes: toys carrying loot score by stepping into one of these circles.
// Two sit beside the toy spawn; the third is the risky one behind the vault.
export const EXTRACTION_ZONES = [
  { x: -35, z: 35, r: 3 },
  { x: 35, z: 35, r: 3 },
  { x: 0, z: -35, r: 3 },
];

/** Index of the extraction zone containing (x, z), or -1. */
export function extractionZoneAt(x, z) {
  for (let i = 0; i < EXTRACTION_ZONES.length; i++) {
    const zone = EXTRACTION_ZONES[i];
    const dx = x - zone.x, dz = z - zone.z;
    if (dx * dx + dz * dz <= zone.r * zone.r) return i;
  }
  return -1;
}

/** True if the point (padded by `margin`) is inside any obstacle's footprint. */
export function isBlocked(x, z, margin = 0) {
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (x > o.minX - margin && x < o.maxX + margin && z > o.minZ - margin && z < o.maxZ + margin) return true;
  }
  return false;
}

/** Height of the highest walkable surface under (x, z) that is at or below `fromY`. */
export function groundHeightAt(x, z, fromY) {
  let ground = 0;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ && o.maxY <= fromY + 0.05 && o.maxY > ground) {
      ground = o.maxY;
    }
  }
  return ground;
}

// Toy Jail: jailed toys are confined to this rectangle (see movement.js).
// It is a laser-fenced floor area, not a solid, so free players can pass through.
export const JAIL = (() => {
  const x = 33.5, z = -30, w = 8, d = 8;
  return { x, z, w, d, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
})();

// The lever that opens the jail sits just outside its west fence.
export const JAIL_LEVER = { x: JAIL.minX - 1.5, z: JAIL.z };

/** Standing position for the i-th jailed toy (5 x 5 grid inside the jail). */
export function jailSlot(i) {
  const col = i % 5, row = Math.floor(i / 5) % 5;
  return { x: JAIL.minX + 1.2 + col * 1.4, z: JAIL.minZ + 1.2 + row * 1.4 };
}

/** True if (x, z) is inside the jail or its lever apron, padded by `margin`. */
export function nearJail(x, z, margin = 0) {
  return x > JAIL_LEVER.x - 1 - margin && x < JAIL.maxX + margin &&
         z > JAIL.minZ - margin && z < JAIL.maxZ + margin;
}

/**
 * Line-of-sight test: true if the segment a -> b does not pass through any
 * obstacle box (slab method). Used for guard flashlight detection.
 */
export function lineOfSight(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    // Clip the segment's parameter range [t0, t1] against each axis slab in turn.
    let t0 = 0, t1 = 1, hit = true;
    for (let axis = 0; axis < 3 && hit; axis++) {
      const origin = axis === 0 ? ax : axis === 1 ? ay : az;
      const delta = axis === 0 ? dx : axis === 1 ? dy : dz;
      const min = axis === 0 ? o.minX : axis === 1 ? o.minY : o.minZ;
      const max = axis === 0 ? o.maxX : axis === 1 ? o.maxY : o.maxZ;
      if (Math.abs(delta) < 1e-9) { hit = origin >= min && origin <= max; continue; }
      let ta = (min - origin) / delta, tb = (max - origin) / delta;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      hit = t0 <= t1;
    }
    if (hit) return false;   // the segment passes through this box
  }
  return true;
}

// Toys spawn in the south strip, guards in a ring around the vault.
// Yaw 0 faces -Z (see movement.js).
export function spawnPoint(role, index) {
  if (role === "guard") {
    const a = (index / 8) * Math.PI * 2;
    return { x: Math.cos(a) * 11, y: 0, z: Math.sin(a) * 11,
             yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };   // face away from the vault
  }
  const col = index % 12;
  const row = Math.floor(index / 12);
  return { x: -27.5 + col * 5, y: 0, z: 34 + row * 3, yaw: 0 };   // face the vault (-Z)
}
