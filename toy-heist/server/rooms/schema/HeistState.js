// Low-frequency replicated state (roster, roles, phase, loot, score). Colyseus delta-syncs
// this automatically. High-frequency transforms deliberately do NOT live here:
// they go out as interest-filtered snapshot messages (see HeistRoom.broadcastSnapshots).
//
// Note: fields are assigned in constructors rather than as class fields,
// because JS class-field initialisers would shadow the schema's accessors.

import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PHASE_LOBBY, ROLE_TOY, STATUS_ACTIVE, MATCH_SECONDS, TARGET_SCORE } from "../../../public/js/shared/constants.js";

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
  }
}
defineTypes(PlayerState, {
  nid: "uint8", name: "string", role: "string", host: "boolean", score: "uint32",
  status: "string", arrests: "uint8", rescues: "uint8",
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
  }
}
defineTypes(HeistState, {
  code: "string", phase: "string", score: "uint32", targetScore: "uint16", timeLeft: "uint16",
  winner: "string", reason: "string", leverProgress: "uint8", leverHolder: "uint8",
  players: { map: PlayerState }, loot: { map: LootState },
});
