// Guard flashlight detection.
//
// A guard "sees" a toy when the toy is (a) within VISION_RANGE, (b) inside the
// 45-degree cone in front of the guard, and (c) not hidden behind an obstacle.
// Results are stored on the simulation records and shipped in each player's
// own snapshot:
//   guard.detected -> array of toy nids currently lit up (drives HUD target icons)
//   toy.spotted    -> true while any guard has them in the beam
//
// The spatial hash keeps this to the handful of toys in neighbouring cells,
// and the cheap range/angle tests run before the obstacle raycast.

import {
  ROLE_GUARD, ROLE_TOY, ROLE_STATS, STATUS_ACTIVE,
  VISION_RANGE, VISION_HALF_ANGLE, AOI_CELL_SIZE,
} from "../../public/js/shared/constants.js";
import { lineOfSight } from "../../public/js/shared/map.js";

const CELL_RANGE = Math.ceil(VISION_RANGE / AOI_CELL_SIZE);
const RANGE_SQ = VISION_RANGE * VISION_RANGE;
const COS_HALF_ANGLE = Math.cos(VISION_HALF_ANGLE);
const GUARD_EYE = ROLE_STATS[ROLE_GUARD].height * 0.8;
const TOY_CENTRE = ROLE_STATS[ROLE_TOY].height * 0.5;

/** True if `guard` has `toy` in its flashlight cone with a clear line of sight. */
export function canSee(guard, toy) {
  const g = guard.body, t = toy.body;
  const dx = t.x - g.x, dz = t.z - g.z;
  const distSq = dx * dx + dz * dz;
  if (distSq > RANGE_SQ) return false;

  // Angle between the guard's facing (yaw 0 = -Z) and the direction to the toy.
  const dist = Math.sqrt(distSq);
  if (dist > 1e-3) {
    const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
    if ((dx * fx + dz * fz) / dist < COS_HALF_ANGLE) return false;
  }
  return lineOfSight(g.x, g.y + GUARD_EYE, g.z, t.x, t.y + TOY_CENTRE, t.z);
}

export class VisionSystem {
  /**
   * Recompute detection for every guard. `players` is the room's sessionId -> record
   * Map; `grid` must contain all current players.
   */
  update(players, grid) {
    for (const rec of players.values()) { rec.spotted = false; rec.detected.length = 0; }
    for (const guard of players.values()) {
      if (guard.state.role !== ROLE_GUARD) continue;
      grid.queryCells(guard.body.x, guard.body.z, CELL_RANGE, (other) => {
        if (other.state.role !== ROLE_TOY || other.state.status !== STATUS_ACTIVE) return;
        if (!canSee(guard, other)) return;
        guard.detected.push(other.state.nid);
        other.spotted = true;
      });
    }
  }
}
