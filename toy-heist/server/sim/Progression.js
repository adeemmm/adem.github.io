// Player progression: persistent profiles, the cosmetics shop and match-end gold.
//
// Bridges the database (server/db/database.js) and the room:
//   - on join, loads the player's profile and publishes their equipped skins
//     into replicated state so everyone renders the right model;
//   - handles shop requests (buy / equip), validating everything server-side;
//   - when a match ends, computes each connected player's gold and writes the
//     whole lobby to SQLite in one transaction.
//
// Private data (gold, unlocks, lifetime stats) goes only to its owner via
// MSG_PROFILE; only the equipped skin ids are in shared state.

import {
  ROLE_TOY, ROLE_GUARD, TEAM_TOYS, PHASE_PLAYING, MSG_PROFILE,
} from "../../public/js/shared/constants.js";
import { SKINS, resolveSkin, computeGold } from "../../public/js/shared/cosmetics.js";

export class Progression {
  constructor(state, db) {
    this.state = state;
    this.db = db;
  }

  /**
   * Called from onJoin. `rec.account` is the username to persist under, or
   * null for a guest (no name entered): guests play normally but earn nothing.
   */
  load(rec) {
    if (!rec.account) { this.sendProfile(rec, null); return; }
    const profile = this.db.getOrCreatePlayer(rec.account);
    this.applySkins(rec, profile);
    this.sendProfile(rec, profile);
  }

  /** Shop request from a client: { a: "buy" | "equip", id: skinId }. */
  handleShop(rec, players, message) {
    if (!rec.account || !message || typeof message.id !== "string" || !SKINS[message.id]) return;
    // The shop is a lobby feature: no swapping looks in the middle of a round.
    if (this.state.phase === PHASE_PLAYING) return this.reply(rec, "Finish the match first");

    const skin = SKINS[message.id];
    if (message.a === "buy") {
      const result = this.db.purchaseSkin(rec.account, message.id);
      if (result === "gold") return this.reply(rec, `Not enough gold for ${skin.name}`);
      if (result !== "ok" && result !== "owned") return;
      this.db.equipSkin(rec.account, message.id);   // new purchases are worn straight away
      this.refresh(rec.account, players, result === "ok" ? `Unlocked ${skin.name}!` : "");
    } else if (message.a === "equip") {
      if (!this.db.equipSkin(rec.account, message.id)) return this.reply(rec, "You do not own that skin");
      this.refresh(rec.account, players, "");
    }
  }

  /**
   * Match over: pay everyone still connected and persist it in one bulk
   * transaction. `rec.deposits` is the number of items the player banked.
   */
  awardMatch(players, winner) {
    const rows = [];
    const earned = new Map();   // account -> gold earned this match
    for (const rec of players.values()) {
      if (!rec.account) continue;
      const p = rec.state;
      const gold = computeGold({
        role: p.role, score: p.score, arrests: p.arrests, rescues: p.rescues,
        won: (winner === TEAM_TOYS) === (p.role === ROLE_TOY),
      });
      rows.push({
        username: rec.account,
        gold,
        deposits: p.role === ROLE_TOY ? rec.deposits : 0,
        arrests: p.role === ROLE_GUARD ? p.arrests : 0,
      });
      earned.set(rec.account.toLowerCase(), (earned.get(rec.account.toLowerCase()) || 0) + gold);
    }
    if (!rows.length) return 0;

    try {
      this.db.applyMatchRewards(rows);
    } catch (err) {
      // Never let a storage failure take the room down mid-game.
      console.error(`[db] failed to save match rewards: ${err.message}`);
      return 0;
    }
    for (const rec of players.values()) {
      if (!rec.account) continue;
      const profile = this.db.getOrCreatePlayer(rec.account);
      this.sendProfile(rec, profile, { earned: earned.get(rec.account.toLowerCase()) });
    }
    return rows.length;
  }

  // ------------------------------------------------------------ internals --

  /** Re-read an account and update every connection using it (same name in two tabs). */
  refresh(account, players, notice) {
    const profile = this.db.getOrCreatePlayer(account);
    for (const rec of players.values()) {
      if (!rec.account || rec.account.toLowerCase() !== account.toLowerCase()) continue;
      this.applySkins(rec, profile);
      this.sendProfile(rec, profile, notice ? { notice } : undefined);
    }
  }

  applySkins(rec, profile) {
    rec.state.skin = resolveSkin(ROLE_TOY, profile.toySkin);
    rec.state.guardSkin = resolveSkin(ROLE_GUARD, profile.guardSkin);
  }

  reply(rec, error) {
    rec.client.send(MSG_PROFILE, { error });
  }

  sendProfile(rec, profile, extra) {
    rec.client.send(MSG_PROFILE, profile
      ? { ...profile, guest: false, ...extra }
      : { guest: true, gold: 0, totalDeposits: 0, totalArrests: 0, unlocked: [], toySkin: rec.state.skin, guardSkin: rec.state.guardSkin });
  }
}
