// Server-side loot rules: spawning, grabbing, dropping and extraction.
//
// Owns the `state.loot` schema map (which Colyseus replicates to clients) and
// the carry link on each player's simulation record:
//   rec.carrying   -> the LootState being held, or null
//   rec.body.carry -> that item's weight, read by the shared movement code
//
// With 24 items and interactions that only run on an 'E' press, linear scans
// are far cheaper than maintaining a broad phase for loot.

import { LootState } from "../rooms/schema/HeistState.js";
import {
  LOOT_TYPES, LOOT_COUNT, INTERACT_RANGE, INTERACT_HEIGHT, ROLE_TOY, STATUS_ACTIVE,
} from "../../public/js/shared/constants.js";
import {
  ARENA_SIZE, EXTRACTION_ZONES, extractionZoneAt, isBlocked, groundHeightAt, nearJail,
} from "../../public/js/shared/map.js";

const SPAWN_EDGE_MARGIN = 2;      // keep loot off the perimeter walls
const SPAWN_OBSTACLE_MARGIN = 1;  // ...and out of obstacle footprints
const SPAWN_ZONE_MARGIN = 6;      // no free points right next to a chute
const SPAWN_SPACING = 5;          // minimum gap between two items
const SPAWN_ATTEMPTS = 60;

const TYPE_KEYS = Object.keys(LOOT_TYPES);
const TOTAL_RARITY = TYPE_KEYS.reduce((sum, k) => sum + LOOT_TYPES[k].rarity, 0);

export class LootSystem {
  constructor(state, random = Math.random) {
    this.state = state;
    this.random = random;
  }

  /** Create the full set of items. Call once per room. */
  spawnAll() {
    for (let id = 1; id <= LOOT_COUNT; id++) {
      const item = new LootState();
      this.place(item);
      this.state.loot.set(String(id), item);
    }
  }

  /** New match: everyone lets go and every item is re-rolled somewhere new. */
  reset(recs) {
    for (const rec of recs) { rec.carrying = null; rec.body.carry = 0; }
    this.state.loot.forEach((item) => { item.carrier = 0; });
    this.state.loot.forEach((item) => this.place(item));
  }

  /** 'E' pressed: drop what you hold, otherwise grab the nearest free item in reach. */
  interact(rec) {
    if (rec.state.role !== ROLE_TOY || rec.state.status !== STATUS_ACTIVE) return;   // guards and jailed toys cannot carry loot
    if (rec.carrying) { this.drop(rec); return; }

    const b = rec.body;
    let best = null, bestDistSq = INTERACT_RANGE * INTERACT_RANGE;
    this.state.loot.forEach((item) => {
      if (item.carrier !== 0 || Math.abs(item.y - b.y) > INTERACT_HEIGHT) return;
      const dx = item.x - b.x, dz = item.z - b.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) { best = item; bestDistSq = distSq; }
    });
    if (!best) return;

    best.carrier = rec.state.nid;   // one item at a time: guarded by rec.carrying above
    rec.carrying = best;
    b.carry = LOOT_TYPES[best.type].weight;
  }

  /** Put the carried item down on the surface under the player. Safe to call when empty-handed. */
  drop(rec) {
    const item = rec && rec.carrying;
    if (!item) return;
    const b = rec.body;
    item.x = b.x;
    item.z = b.z;
    item.y = groundHeightAt(b.x, b.z, b.y);
    item.carrier = 0;
    rec.carrying = null;
    b.carry = 0;
  }

  /**
   * Auto-deposit: if this player is carrying loot inside an extraction zone,
   * bank it and respawn the item elsewhere as a freshly rolled type.
   * Returns { type, points } for the banked item, or null.
   */
  tryDeposit(rec) {
    const item = rec.carrying;
    if (!item || extractionZoneAt(rec.body.x, rec.body.z) < 0) return null;

    const type = item.type;
    rec.carrying = null;
    rec.body.carry = 0;
    item.carrier = 0;
    this.place(item);
    return { type, points: LOOT_TYPES[type].points };
  }

  // ------------------------------------------------------------ internals --

  /** Roll a type and a free floor position for `item`. */
  place(item) {
    item.type = this.rollType();
    const half = ARENA_SIZE / 2 - SPAWN_EDGE_MARGIN;
    let x = 0, z = 0;
    // Relax the spacing rule as attempts run out so this always terminates
    // with a legal (unblocked, outside-chute) position.
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS * 4; attempt++) {
      x = (this.random() * 2 - 1) * half;
      z = (this.random() * 2 - 1) * half;
      const spacing = attempt < SPAWN_ATTEMPTS ? SPAWN_SPACING : 0;
      if (this.isFreeSpot(item, x, z, spacing)) break;
    }
    item.x = x;
    item.y = 0;
    item.z = z;
  }

  rollType() {
    let roll = this.random() * TOTAL_RARITY;
    for (const key of TYPE_KEYS) {
      roll -= LOOT_TYPES[key].rarity;
      if (roll < 0) return key;
    }
    return TYPE_KEYS[0];
  }

  isFreeSpot(self, x, z, spacing) {
    if (isBlocked(x, z, SPAWN_OBSTACLE_MARGIN) || nearJail(x, z, 2)) return false;
    for (const zone of EXTRACTION_ZONES) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.r + SPAWN_ZONE_MARGIN) return false;
    }
    let free = true;
    this.state.loot.forEach((other) => {
      if (other !== self && other.carrier === 0 && Math.hypot(x - other.x, z - other.z) < spacing) free = false;
    });
    return free;
  }
}
