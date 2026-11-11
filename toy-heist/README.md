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
| `server/sim/JailSystem.js` | Arrests, Toy Jail confinement, jailbreak lever |
| `server/sim/VisionSystem.js` | Guard flashlight cone + line-of-sight detection |
| `server/config.js` | Env overrides for match length and score target |
| `server/sim/SpatialHash.js` | Grid broad phase used for network interest management |
| `public/js/shared/` | Code run by **both** server and client: constants, map, movement |
| `public/js/net/` | `NetClient` (socket), `Prediction` (local player), `Interpolation` (remotes) |
| `public/js/game.js` | Client entry: scene, entities, fixed-step loop, HUD |
| `public/js/{world,models,camera,input}.js` | Environment, placeholder meshes, chase camera, controls |
| `public/js/loot.js` | Loot meshes and the view that mirrors replicated loot state |
| `public/js/jail.js` | Jail cell, lever and guard target-marker rendering |
| `public/js/endBanner.js` | Victory/Defeat overlay with match stats |

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

## Stealth, arrests and jail (Phase 3)

- **Flashlight detection.** Every 3rd tick the server tests each guard against nearby toys: within
  12 m, inside a 45-degree cone (22.5 degrees either side of facing), and with a clear line of sight
  past the obstacle boxes. The guard's HUD draws a red reticle on each detected toy; the toy sees a
  "SPOTTED" warning. The visible beam uses the same range and angle.
- **Arrest.** A guard within 1.8 m presses **F** or left-clicks. The toy drops its loot on the spot,
  becomes `jailed`, and is teleported into the Toy Jail, where the shared movement code confines it.
- **Jailbreak.** A free toy standing at the lever holds **E** for 2.5 s without letting go. All
  jailed toys become `active` again with a 3 s, +50% speed boost.
- **Match flow.** Starting a match runs a 5-minute timer. Toys win at 500 team points. Guards win if
  every toy is jailed or the timer hits 0:00. Players are then frozen and a Victory/Defeat banner
  shows the match stats; the host can start the next match from it.
- The lobby is free play: arrests and the lever work, but there is no timer and nobody can win.

Override the rules for quick tests: `HEIST_MATCH_SECONDS=60 HEIST_TARGET_SCORE=100 npm start`.

## Not yet built

SQLite persistence, reconnection, and a rigid-body
physics engine (movement currently uses a deterministic kinematic controller against AABBs).
