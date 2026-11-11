# Toy Heist

3D third-person asymmetric multiplayer party heist: **24 Toys vs 8 Guards** in 32-player lobbies.
Phase 1 scaffold: authoritative Colyseus server, Three.js client, prediction + interpolation netcode.

```bash
cd toy-heist
npm install
npm start            # http://localhost:2567
npm run bots 1234    # optional: fill lobby 1234 with 31 wandering bots
```

Open two tabs (use **Play as Guest** for quick tests), create a lobby in one and join with the 4-digit code in the other
(or share `http://host:2567/?code=1234`).

## Layout

| Path | Purpose |
| --- | --- |
| `server/index.js` | Express static hosting + Colyseus server bootstrap |
| `server/rooms/HeistRoom.js` | Lobby, join codes, role assignment, 30 Hz authoritative loop, snapshots |
| `server/rooms/schema/HeistState.js` | Low-frequency replicated state (roster, roles, phase) |
| `server/sim/LootSystem.js` | Loot spawning, grab/drop, extraction deposits |
| `server/sim/JailSystem.js` | Arrests, Toy Jail confinement, jailbreak lever |
| `server/db/database.js` | SQLite persistence: accounts (bcrypt), gold, lifetime stats, skins |
| `server/auth.js` | `/api/auth` routes, session tokens, login rate limiting |
| `server/sim/Progression.js` | Profiles, shop validation, match-end gold payouts |
| `server/sim/TwitchChaos.js` | Twitch IRC client and the Chaos Mode vote/event cycle |
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
| `public/js/audio.js` | Procedural WebAudio sound effects, spatial playback, footsteps |
| `public/js/streamerUI.js` | Big join code and live chaos vote bars for stream viewers |
| `public/js/chaos.js` | Lights Out and Banana Rain visuals |
| `public/js/auth.js` | Main-menu name, password and lobby steps |
| `public/js/shop.js` | Safehouse modal: gold, stats, buy and equip skins |
| `public/js/shared/cosmetics.js` | Skin catalogue, prices and reward rules (server and client) |

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

## Chaos Mode, audio and streamer overlay (Phase 4)

```bash
TWITCH_CHANNEL=yourchannel npm start   # chat votes drive Chaos Mode
HEIST_CHAOS=1 npm start                # Chaos Mode without Twitch (random events)
```

- **Twitch chat.** The server joins the channel's chat anonymously over Twitch's IRC WebSocket
  (read-only, no token or extra dependency) and reconnects on its own.
- **Cycle.** During a match: 27 s calm, a 15 s vote, then the winning event for 18 s (60 s total).
  Viewers type `!vote 1`, `!vote 2` or `!vote 3`; each viewer has one vote per window and can change
  it. Ties, including nobody voting, are broken at random.
- **Events.** 1 *Lights Out*: world lighting drops to about 3%, guard flashlights keep working.
  2 *Zero Gravity*: about 2.5x jump height and 1.4x speed, applied in the shared movement code.
  3 *Banana Rain*: 15 bananas land on the floor; a toy carrying loot that steps on one drops it.
- **Audio.** Every sound is synthesised in the browser: pickup chime, drop thud, deposit, arrest,
  jailbreak siren, detection beep, banana slip, vote and event stingers, victory and defeat jingles,
  footsteps. Sounds with a world position pan and fade with distance. **M** mutes.
- **Streamer overlay.** Bottom-right: the join code in 72 px digits, the Twitch channel, and the
  chaos card with live vote bars. **O** hides or shows it.

Timings can be overridden with `HEIST_CHAOS_CALM_SECONDS`, `HEIST_CHAOS_VOTE_SECONDS` and
`HEIST_CHAOS_EVENT_SECONDS`; `TWITCH_IRC_URL` points the client at a different IRC endpoint.

## Persistence and cosmetics (Phase 5)

- **Database.** `toy_heist.db` (SQLite via `better-sqlite3`) is created next to `package.json` on first
  start; set `HEIST_DB_PATH` to move it. The `players` table holds `username` (primary key,
  case-insensitive), `gold`, `total_deposits`, `total_arrests`, `unlocked_skins` (JSON),
  `equipped_skin` (toy look) and `equipped_guard_skin` (guard look).
- **Accounts.** Enter a name on the main menu. A new name asks you to create a password; a known
  name asks for its password. Passwords are stored only as bcrypt hashes (`bcryptjs`) in the
  `password_hash` column. **Play as Guest** skips all of this; guests earn nothing.
- **Sessions.** Logging in returns a session token (kept in memory on the server for 12 hours and in
  the browser tab's `sessionStorage`). The token, not the password, is sent when joining a room.
  Restarting the server signs everyone out. One account can be in a lobby only once.
- **Limits.** Ten failed logins or registrations per address per five minutes. Serve the game over
  HTTPS in production: over plain HTTP the password crosses the network unencrypted. Behind a
  reverse proxy, set Express `trust proxy` or every player shares one rate limit.
- **Older databases.** The `password_hash` column is added automatically. A row that has no password
  yet (created before accounts existed) is claimed by whoever sets its password first.
- **Rewards.** When a match ends every connected, named player is paid in one transaction:
  25 gold for finishing, +50 for winning, toys +1 per point they extracted and +15 per team-mate
  freed, guards +40 per arrest. Lobby free play pays nothing.
- **Safehouse.** Press **B** or the HUD button between matches (lobby or end screen) to see your gold
  and lifetime stats and to buy or equip skins: Default Capsule, Party Hat Toy (75), Robot Toy (250),
  Royal Toy (600), Night Guard, Gold Guard (400). Purchases are validated on the server.
- **Sync.** Equipped skin ids are part of each player's replicated state, so everyone sees the
  matching model. Gold, unlocks and stats are sent only to their owner.

## Not yet built

Password reset or change, reconnection, and a rigid-body physics engine (movement uses a
deterministic kinematic controller against AABBs).
