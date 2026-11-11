// SQLite persistence (better-sqlite3): player gold, lifetime stats and cosmetics.
//
// better-sqlite3 is synchronous, which suits this server: every call here is a
// single indexed row (or one small transaction at match end) and completes in
// well under a millisecond, so nothing is awaited inside the 30 Hz loop.
//
// Accounts are keyed by username (case-insensitive). There is no login yet, so
// a name is only as private as it is unguessable - see README.

import Database from "better-sqlite3";
import { config } from "../config.js";
import {
  SKINS, STARTER_SKINS, DEFAULT_TOY_SKIN, DEFAULT_GUARD_SKIN,
} from "../../public/js/shared/cosmetics.js";
import { ROLE_GUARD } from "../../public/js/shared/constants.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS players (
    username            TEXT PRIMARY KEY COLLATE NOCASE,
    gold                INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    total_deposits      INTEGER NOT NULL DEFAULT 0,
    total_arrests       INTEGER NOT NULL DEFAULT 0,
    unlocked_skins      TEXT    NOT NULL DEFAULT '${JSON.stringify(STARTER_SKINS)}',
    equipped_skin       TEXT    NOT NULL DEFAULT '${DEFAULT_TOY_SKIN}',
    equipped_guard_skin TEXT    NOT NULL DEFAULT '${DEFAULT_GUARD_SKIN}'
  )
`;

/** Parse the unlocked_skins JSON column defensively: always includes the starter skins. */
function parseSkins(text) {
  let list = [];
  try { list = JSON.parse(text); } catch { /* corrupted column: fall back to starters */ }
  if (!Array.isArray(list)) list = [];
  const known = list.filter((id) => typeof id === "string" && SKINS[id]);
  return [...new Set([...STARTER_SKINS, ...known])];
}

/** Row -> the profile object used by the rest of the server and sent to the client. */
function toProfile(row) {
  return {
    username: row.username,
    gold: row.gold,
    totalDeposits: row.total_deposits,
    totalArrests: row.total_arrests,
    unlocked: parseSkins(row.unlocked_skins),
    toySkin: row.equipped_skin,
    guardSkin: row.equipped_guard_skin,
  };
}

export class GameDatabase {
  constructor(path) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");   // readers never block the writer
    this.db.exec(SCHEMA);

    this.stmt = {
      get: this.db.prepare("SELECT * FROM players WHERE username = ?"),
      create: this.db.prepare("INSERT OR IGNORE INTO players (username) VALUES (?)"),
      reward: this.db.prepare(`
        INSERT INTO players (username, gold, total_deposits, total_arrests)
        VALUES (@username, @gold, @deposits, @arrests)
        ON CONFLICT (username) DO UPDATE SET
          gold = gold + excluded.gold,
          total_deposits = total_deposits + excluded.total_deposits,
          total_arrests = total_arrests + excluded.total_arrests
      `),
      purchase: this.db.prepare(
        "UPDATE players SET gold = gold - @price, unlocked_skins = @unlocked WHERE username = @username AND gold >= @price"),
      equipToy: this.db.prepare("UPDATE players SET equipped_skin = ? WHERE username = ?"),
      equipGuard: this.db.prepare("UPDATE players SET equipped_guard_skin = ? WHERE username = ?"),
    };

    // One transaction for the whole lobby: all rewards land, or none do.
    this.rewardAll = this.db.transaction((rows) => {
      for (const row of rows) this.stmt.reward.run(row);
    });

    this.purchaseTx = this.db.transaction((username, skinId) => {
      const row = this.stmt.get.get(username);
      const skin = SKINS[skinId];
      if (!row || !skin) return "unknown";
      const unlocked = parseSkins(row.unlocked_skins);
      if (unlocked.includes(skinId)) return "owned";
      if (row.gold < skin.price) return "gold";
      unlocked.push(skinId);
      const result = this.stmt.purchase.run({ username, price: skin.price, unlocked: JSON.stringify(unlocked) });
      return result.changes === 1 ? "ok" : "gold";
    });
  }

  /** Fetch a player's profile, creating the row on first sight. */
  getOrCreatePlayer(username) {
    this.stmt.create.run(username);
    return toProfile(this.stmt.get.get(username));
  }

  /**
   * Bulk match-end update. rows: [{ username, gold, deposits, arrests }], all
   * amounts are deltas to add. Runs as a single transaction.
   */
  applyMatchRewards(rows) {
    if (rows.length) this.rewardAll(rows);
  }

  /** Buy a skin. Returns "ok", or why not: "owned" | "gold" | "unknown". */
  purchaseSkin(username, skinId) {
    return this.purchaseTx(username, skinId);
  }

  /** Equip an owned skin into the slot for its role. Returns true on success. */
  equipSkin(username, skinId) {
    const row = this.stmt.get.get(username);
    const skin = SKINS[skinId];
    if (!row || !skin || !parseSkins(row.unlocked_skins).includes(skinId)) return false;
    (skin.role === ROLE_GUARD ? this.stmt.equipGuard : this.stmt.equipToy).run(skinId, username);
    return true;
  }

  close() { this.db.close(); }
}

let shared = null;

/** The process-wide database (opened on first use at config.dbPath). */
export function getDatabase() {
  if (!shared) {
    shared = new GameDatabase(config.dbPath);
    console.log(`[db] using ${config.dbPath}`);
  }
  return shared;
}
