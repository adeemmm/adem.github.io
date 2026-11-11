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

export const OBSTACLES = [
  // Perimeter walls
  onFloor(0, -HALF - WALL_T / 2, ARENA_SIZE + WALL_T * 2, WALL_H, WALL_T, 0x8d99ae, "wall"),
  onFloor(0,  HALF + WALL_T / 2, ARENA_SIZE + WALL_T * 2, WALL_H, WALL_T, 0x8d99ae, "wall"),
  onFloor(-HALF - WALL_T / 2, 0, WALL_T, WALL_H, ARENA_SIZE, 0x8d99ae, "wall"),
  onFloor( HALF + WALL_T / 2, 0, WALL_T, WALL_H, ARENA_SIZE, 0x8d99ae, "wall"),

  // Central vault: the heist target, with a stepped approach
  onFloor(0, 0, 8, 3, 8, 0xffd166, "vault"),
  onFloor(6, 0, 4, 1.5, 4, 0xf4a261),
  onFloor(0, 6, 4, 1.5, 4, 0xf4a261),

  // Giant toy blocks (jumpable staircases for toys, cover from flashlights)
  onFloor(-14, -10, 4, 1.2, 4, 0xef476f),
  onFloor(-18, -10, 4, 2.4, 4, 0xef476f),
  onFloor(-18, -14, 4, 3.6, 4, 0xef476f),
  onFloor(14, 12, 6, 2, 3, 0x06d6a0),
  onFloor(20, 12, 3, 4, 3, 0x06d6a0),
  onFloor(16, -18, 3, 3, 10, 0x118ab2),
  onFloor(24, -22, 5, 1.5, 5, 0x118ab2),
  onFloor(-12, 18, 10, 2.5, 3, 0x9b5de5),
  onFloor(-24, 22, 4, 4, 4, 0x9b5de5),
  onFloor(-28, 0, 3, 5, 12, 0xf15bb5),
  onFloor(28, 2, 3, 5, 12, 0x00bbf9),
  onFloor(0, -26, 14, 2, 3, 0xfee440),
  onFloor(0, 28, 14, 2, 3, 0x00f5d4),
  onFloor(-30, -28, 6, 1, 6, 0xf4a261),
  onFloor(30, 28, 6, 1, 6, 0xf4a261),
  onFloor(8, -8, 2, 1, 2, 0xef476f),
  onFloor(-8, 8, 2, 1, 2, 0x06d6a0),

  // Floating shelf, reachable from the red staircase
  box(-23, 4.2, -14, 5, 0.6, 4, 0xe9c46a),
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
