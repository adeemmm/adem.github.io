// Low-frequency replicated state (roster, roles, phase, loot, score). Colyseus delta-syncs
// this automatically. High-frequency transforms deliberately do NOT live here:
// they go out as interest-filtered snapshot messages (see HeistRoom.broadcastSnapshots).
//
// Note: fields are assigned in constructors rather than as class fields,
// because JS class-field initialisers would shadow the schema's accessors.

import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PHASE_LOBBY, ROLE_TOY, STATUS_ACTIVE, MATCH_SECONDS, TARGET_SCORE, CHAOS_OFF } from "../../../public/js/shared/constants.js";
import { DEFAULT_TOY_SKIN, DEFAULT_GUARD_SKIN } from "../../../public/js/shared/cosmetics.js";

export class PlayerState extends Schema {
  constructor() {
    super();
    this.nid = 0;          // compact numeric id used in snapshot packets
    this.name = "";
    this.role = ROLE_TOY;
    this.host = false;
    this.score = 0;        // points this player has personally extracted
    this.status = STATUS_ACTIVE;   // toys only: active | jailed
    this.arrests = 0;      // guards: toys arrested this match
    this.rescues = 0;      // toys: team-mates freed from jail this match
    this.skin = DEFAULT_TOY_SKIN;          // cosmetic worn when playing as a toy
    this.guardSkin = DEFAULT_GUARD_SKIN;   // cosmetic worn when playing as a guard
  }
}
defineTypes(PlayerState, {
  nid: "uint8", name: "string", role: "string", host: "boolean", score: "uint32",
  status: "string", arrests: "uint8", rescues: "uint8", skin: "string", guardSkin: "string",
});

export class LootState extends Schema {
  constructor() {
    super();
    this.type = "block";   // key into LOOT_TYPES
    this.x = 0;            // resting position (ignored by clients while carried)
    this.y = 0;
    this.z = 0;
    this.carrier = 0;      // nid of the toy holding it, 0 = on the floor
  }
}
defineTypes(LootState, { type: "string", x: "float32", y: "float32", z: "float32", carrier: "uint8" });

// Chaos Mode: the vote/event cycle driven by Twitch chat (server/sim/TwitchChaos.js).
export class ChaosState extends Schema {
  constructor() {
    super();
    this.phase = CHAOS_OFF;   // off | calm | vote | event
    this.event = 0;           // live (or last winning) event id, 0 = none
    this.timeLeft = 0;        // whole seconds left in the current phase
    this.votes1 = 0;          // live tallies for !vote 1 / 2 / 3
    this.votes2 = 0;
    this.votes3 = 0;
    this.channel = "";        // Twitch channel being listened to ("" = none)
  }
}
defineTypes(ChaosState, {
  phase: "string", event: "uint8", timeLeft: "uint8",
  votes1: "uint16", votes2: "uint16", votes3: "uint16", channel: "string",
});

// A temporary floor hazard (Banana Rain).
export class HazardState extends Schema {
  constructor(x = 0, z = 0) {
    super();
    this.x = x;
    this.z = z;
  }
}
defineTypes(HazardState, { x: "float32", z: "float32" });

export class HeistState extends Schema {
  constructor() {
    super();
    this.code = "";
    this.phase = PHASE_LOBBY;
    this.score = 0;                   // team score for the toys
    this.targetScore = TARGET_SCORE;  // toys win at this score
    this.timeLeft = MATCH_SECONDS;    // whole seconds remaining in the match
    this.winner = "";                 // "toys" | "guards" once phase === "ended"
    this.reason = "";                 // "score" | "jailed" | "time"
    this.leverProgress = 0;           // jail lever hold progress, 0-100
    this.leverHolder = 0;             // nid of the toy pulling the lever, 0 = nobody
    this.players = new MapSchema();   // sessionId -> PlayerState
    this.loot = new MapSchema();      // loot id -> LootState
    this.chaos = new ChaosState();
    this.hazards = new MapSchema();   // hazard id -> HazardState
  }
}
defineTypes(HeistState, {
  code: "string", phase: "string", score: "uint32", targetScore: "uint16", timeLeft: "uint16",
  winner: "string", reason: "string", leverProgress: "uint8", leverHolder: "uint8",
  players: { map: PlayerState }, loot: { map: LootState },
  chaos: ChaosState, hazards: { map: HazardState },
});
