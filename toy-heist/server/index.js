// Toy Heist server entry point.
//
//  - Express serves the static client from /public and the browser builds of
//    three.js / colyseus.js straight out of node_modules under /vendor.
//  - Colyseus hosts HeistRoom instances. Every room runs its own authoritative
//    fixed-step loop at TICK_RATE (30 Hz); see HeistRoom.update().

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { HeistRoom } from "./rooms/HeistRoom.js";
import { getDatabase } from "./db/database.js";
import { createAuthRouter } from "./auth.js";
import { TICK_RATE, MAX_PLAYERS } from "../public/js/shared/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(express.static(path.join(ROOT, "public")));
app.use("/vendor/three", express.static(path.join(ROOT, "node_modules/three/build")));
app.use("/vendor/colyseus", express.static(path.join(ROOT, "node_modules/colyseus.js/dist")));

app.get("/api/health", async (_req, res) => {
  const rooms = await matchMaker.query({ name: "heist" });
  res.json({
    ok: true,
    tickRate: TICK_RATE,
    rooms: rooms.map((r) => ({ code: r.roomId, players: r.clients, max: r.maxClients })),
  });
});

// Opening the database here means a bad path fails at boot, not mid-match.
app.use("/api/auth", createAuthRouter(getDatabase()));

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("heist", HeistRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Toy Heist listening on http://localhost:${PORT}`);
  console.log(`Simulation: ${TICK_RATE} Hz authoritative, ${MAX_PLAYERS} players per lobby`);
});
