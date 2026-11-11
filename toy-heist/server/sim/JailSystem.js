// Arrests, the Toy Jail and the jailbreak lever.
//
//  - A guard pressing arrest within ARREST_RANGE of an active toy jails it:
//    the toy drops its loot where it stands and is teleported into the jail.
//  - Jailed toys carry `body.jailed = 1`, which the shared movement code uses
//    to confine them to the jail rectangle (so prediction agrees).
//  - A free toy holding E at the lever for LEVER_HOLD_TICKS releases everyone
//    with a short speed boost.

import {
  ROLE_TOY, ROLE_GUARD, STATUS_ACTIVE, STATUS_JAILED,
  ARREST_RANGE, ARREST_HEIGHT, LEVER_RANGE, LEVER_HOLD_TICKS, BOOST_TICKS,
} from "../../public/js/shared/constants.js";
import { JAIL_LEVER, jailSlot } from "../../public/js/shared/map.js";

export class JailSystem {
  constructor(state, loot) {
    this.state = state;
    this.loot = loot;
    this.holdTicks = 0;    // consecutive ticks the current holder has pulled the lever
    this.nextSlot = 0;     // rotates jailed toys through standing positions
  }

  // Methods taking `players` expect the room's sessionId -> record Map (it is
  // iterated more than once, so a one-shot iterator would not do).

  /** New match: everybody is free and the lever is idle. */
  reset(players) {
    for (const rec of players.values()) this.free(rec, 0);
    this.nextSlot = 0;
    this.resetLever();
  }

  jailedCount() {
    let n = 0;
    this.state.players.forEach((p) => { if (p.role === ROLE_TOY && p.status === STATUS_JAILED) n++; });
    return n;
  }

  /** True when there is at least one toy and every toy is behind bars. */
  allToysJailed() {
    let toys = 0, jailed = 0;
    this.state.players.forEach((p) => {
      if (p.role !== ROLE_TOY) return;
      toys++;
      if (p.status === STATUS_JAILED) jailed++;
    });
    return toys > 0 && jailed === toys;
  }

  // -------------------------------------------------------------- arrests --

  /**
   * Guard pressed arrest. Jails the nearest active toy in reach.
   * Returns the arrested toy's record, or null if nobody was in range.
   */
  tryArrest(guard, players) {
    if (guard.state.role !== ROLE_GUARD) return null;
    const g = guard.body;
    let target = null, bestDistSq = ARREST_RANGE * ARREST_RANGE;
    for (const rec of players.values()) {
      if (rec.state.role !== ROLE_TOY || rec.state.status !== STATUS_ACTIVE) continue;
      const b = rec.body;
      if (Math.abs(b.y - g.y) > ARREST_HEIGHT) continue;
      const dx = b.x - g.x, dz = b.z - g.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) { target = rec; bestDistSq = distSq; }
    }
    if (!target) return null;

    this.jail(target);
    guard.state.arrests++;
    return target;
  }

  jail(rec) {
    this.loot.drop(rec);   // loot stays on the ground where the toy was tackled
    const slot = jailSlot(this.nextSlot++);
    const b = rec.body;
    b.x = slot.x; b.y = 0; b.z = slot.z;
    b.vx = b.vy = b.vz = 0;
    b.grounded = true;
    b.boost = 0;
    b.jailed = 1;
    rec.state.status = STATUS_JAILED;
  }

  free(rec, boostTicks) {
    rec.body.jailed = 0;
    rec.body.boost = boostTicks;
    rec.state.status = STATUS_ACTIVE;
  }

  // ---------------------------------------------------------------- lever --

  /** Can this player work the lever right now? (free toy, in reach, someone to rescue) */
  canUseLever(rec) {
    if (rec.state.role !== ROLE_TOY || rec.state.status !== STATUS_ACTIVE) return false;
    const dx = rec.body.x - JAIL_LEVER.x, dz = rec.body.z - JAIL_LEVER.z;
    return dx * dx + dz * dz <= LEVER_RANGE * LEVER_RANGE && this.jailedCount() > 0;
  }

  /**
   * Advance the lever by one tick. `rec.holdE` says whether each player is
   * holding the interact key. The hold must be continuous by a single toy.
   * Returns { by, freed } on the tick the jail opens, otherwise null.
   */
  updateLever(players) {
    let holder = null;
    if (this.jailedCount() > 0) {
      for (const rec of players.values()) {
        if (!rec.holdE || !this.canUseLever(rec)) continue;
        if (rec.state.nid === this.state.leverHolder) { holder = rec; break; }   // keep the current puller
        if (!holder) holder = rec;
      }
    }
    if (!holder) { this.resetLever(); return null; }

    if (holder.state.nid !== this.state.leverHolder) {
      this.state.leverHolder = holder.state.nid;
      this.holdTicks = 0;
    }
    this.holdTicks++;
    this.state.leverProgress = Math.min(100, Math.floor((this.holdTicks / LEVER_HOLD_TICKS) * 100));
    if (this.holdTicks < LEVER_HOLD_TICKS) return null;

    let freed = 0;
    for (const rec of players.values()) {
      if (rec.state.role !== ROLE_TOY || rec.state.status !== STATUS_JAILED) continue;
      this.free(rec, BOOST_TICKS);
      freed++;
    }
    holder.state.rescues = Math.min(255, holder.state.rescues + freed);
    this.resetLever();
    return { by: holder, freed };
  }

  resetLever() {
    this.holdTicks = 0;
    if (this.state.leverProgress !== 0) this.state.leverProgress = 0;
    if (this.state.leverHolder !== 0) this.state.leverHolder = 0;
  }
}
