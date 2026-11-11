# Toy Heist

3D third-person asymmetric multiplayer party heist: **24 Toys vs 8 Guards** in 32-player lobbies.
Phase 1 scaffold: authoritative Colyseus server, Three.js client, prediction + interpolation netcode.

```bash
cd toy-heist
npm install
npm start            # http://localhost:2567
npm run bots 1234    # optional: fill lobby 1234 with 31 wandering bots
```

Open two tabs, create a lobby in one and join with the 4-digit code in the other
(or share `http://host:2567/?code=1234`).

## Layout

| Path | Purpose |
| --- | --- |
| `server/index.js` | Express static hosting + Colyseus server bootstrap |
| `server/rooms/HeistRoom.js` | Lobby, join codes, role assignment, 30 Hz authoritative loop, snapshots |
| `server/rooms/schema/HeistState.js` | Low-frequency replicated state (roster, roles, phase) |
| `server/sim/LootSystem.js` | Loot spawning, grab/drop, extraction deposits |
| `server/sim/SpatialHash.js` | Grid broad phase used for network interest management |
| `public/js/shared/` | Code run by **both** server and client: constants, map, movement |
| `public/js/net/` | `NetClient` (socket), `Prediction` (local player), `Interpolation` (remotes) |
| `public/js/game.js` | Client entry: scene, entities, fixed-step loop, HUD |
| `public/js/{world,models,camera,input}.js` | Environment, placeholder meshes, chase camera, controls |
| `public/js/loot.js` | Loot meshes and the view that mirrors replicated loot state |

## Netcode

- **Server authoritative, 30 Hz.** Clients send one input per tick (`forward`, `right`, camera yaw, jump).
  The server applies each with the shared `stepBody()` and never trusts client positions.
- **Client-side prediction.** The client runs the same `stepBody()` immediately, then on every snapshot
  rewinds to the server state, replays unacknowledged inputs and blends out any residual error.
- **Entity interpolation.** Remote players render 120 ms in the past between buffered snapshots.
- **Interest management.** Players in the 3x3 block of 16 m grid cells around a viewer update at 30 Hz;
  everyone else at 10 Hz, staggered across ticks.
- **Anti-cheat basics.** Inputs are clamped, sequence-checked and rate-limited by a per-player step-credit bucket.

## Loot and extraction (Phase 2)

- 24 items are always on the map: Toy Blocks (10 pts, weight 1), Gold Coins (25 pts, weight 2) and
  Teddy Bears (75 pts, weight 5), rolled by rarity. Tuning lives in `LOOT_TYPES` in `shared/constants.js`.
- Toys press **E** within 2.2 m to grab one item; **E** again drops it. Guards cannot carry loot.
- Carrying costs 10% move speed per unit of weight. The weight is part of the predicted body, so
  client and server agree on the penalty.
- Walking into a green chute while carrying auto-deposits: the team and player scores go up and the
  item respawns elsewhere as a newly rolled type.
- Loot, carriers and scores replicate through the Colyseus state schema. Starting a match re-rolls
  all loot and zeroes the scores.

## Not yet built

Win conditions, tagging/flashlight detection, SQLite persistence, reconnection, and a rigid-body
physics engine (movement currently uses a deterministic kinematic controller against AABBs).
