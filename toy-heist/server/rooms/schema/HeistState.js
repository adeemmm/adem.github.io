// Low-frequency replicated state (roster, roles, phase). Colyseus delta-syncs
// this automatically. High-frequency transforms deliberately do NOT live here:
// they go out as interest-filtered snapshot messages (see HeistRoom.broadcastSnapshots).
//
// Note: fields are assigned in constructors rather than as class fields,
// because JS class-field initialisers would shadow the schema's accessors.

import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PHASE_LOBBY, ROLE_TOY } from "../../../public/js/shared/constants.js";

export class PlayerState extends Schema {
  constructor() {
    super();
    this.nid = 0;          // compact numeric id used in snapshot packets
    this.name = "";
    this.role = ROLE_TOY;
    this.host = false;
  }
}
defineTypes(PlayerState, { nid: "uint8", name: "string", role: "string", host: "boolean" });

export class HeistState extends Schema {
  constructor() {
    super();
    this.code = "";
    this.phase = PHASE_LOBBY;
    this.players = new MapSchema();   // sessionId -> PlayerState
  }
}
defineTypes(HeistState, { code: "string", phase: "string", players: { map: PlayerState } });
