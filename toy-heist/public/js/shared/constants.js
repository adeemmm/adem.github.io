// Shared by the server (Node) and the client (browser). Keep this file free of
// any environment-specific imports.

export const TICK_RATE = 30;            // authoritative simulation rate (Hz)
export const TICK_DT = 1 / TICK_RATE;   // fixed step, seconds
export const TICK_MS = 1000 / TICK_RATE;

export const MAX_PLAYERS = 32;
export const MAX_GUARDS = 8;
export const MAX_TOYS = 24;
export const TOYS_PER_GUARD = MAX_TOYS / MAX_GUARDS; // 3 toys for every guard

export const ROLE_TOY = "toy";
export const ROLE_GUARD = "guard";

export const PHASE_LOBBY = "lobby";
export const PHASE_PLAYING = "playing";
export const PHASE_ENDED = "ended";

export const STATUS_ACTIVE = "active";
export const STATUS_JAILED = "jailed";

export const TEAM_TOYS = "toys";
export const TEAM_GUARDS = "guards";

// Match rules (server defaults; see server/config.js for env overrides).
export const MATCH_SECONDS = 300;   // 5-minute round
export const TARGET_SCORE = 500;    // toys win on reaching this team score

// Guard flashlight detection: a 45-degree cone (22.5 degrees either side of forward).
export const VISION_RANGE = 12;                       // metres
export const VISION_HALF_ANGLE = (45 / 2) * Math.PI / 180;
export const VISION_EVERY = 3;                        // re-evaluate every Nth tick (10 Hz)

// Arrest + jailbreak.
export const ARREST_RANGE = 1.8;       // metres (horizontal) between guard and toy
export const ARREST_HEIGHT = 2.5;      // max vertical gap for an arrest
export const LEVER_RANGE = 2.2;        // metres from the jail lever
export const LEVER_HOLD_TICKS = Math.round(2.5 * TICK_RATE);   // hold E for 2.5 s
export const BOOST_TICKS = 3 * TICK_RATE;                      // 3 s escape boost
export const BOOST_FACTOR = 1.5;                               // +50% speed while boosted

export const GRAVITY = -28;

// Per-role movement tuning. Collision shape is an upright box of
// (2*radius) x height x (2*radius) with its origin at the feet.
export const ROLE_STATS = {
  [ROLE_TOY]:   { radius: 0.4,  height: 1.3, speed: 7.5, jump: 10.5, accel: 60, airAccel: 18 },
  [ROLE_GUARD]: { radius: 0.65, height: 2.4, speed: 6.5, jump: 9.0,  accel: 45, airAccel: 12 },
};

// Network message types.
export const MSG_INPUT = "i";       // client -> server: one input per sim tick
export const MSG_SNAPSHOT = "s";    // server -> client: interest-filtered world snapshot
export const MSG_START = "start";   // client (host) -> server: begin the match
export const MSG_EVENT = "ev";      // server -> clients: one-shot gameplay events (deposits)

// Interest management.
export const AOI_CELL_SIZE = 16;    // spatial hash cell size (metres)
export const AOI_NEAR_CELLS = 1;    // cells around the viewer that update at full rate
export const FAR_UPDATE_EVERY = 3;  // far entities update every Nth tick (10 Hz)

// Loot. `weight` drives the carry speed penalty, `points` is the team score on
// extraction, `rarity` is the relative spawn weight (higher = more common).
export const LOOT_TYPES = {
  block: { label: "Toy Block",  weight: 1, points: 10, rarity: 5 },
  coin:  { label: "Gold Coins", weight: 2, points: 25, rarity: 3 },
  teddy: { label: "Teddy Bear", weight: 5, points: 75, rarity: 1 },
};
export const LOOT_COUNT = 24;             // items on the map at any time
export const INTERACT_RANGE = 2.2;        // metres (horizontal) to grab loot
export const INTERACT_HEIGHT = 2.0;       // max vertical gap between feet and loot
export const CARRY_SLOW_PER_WEIGHT = 0.1; // -10% move speed per unit of weight
export const CARRY_MIN_SPEED = 0.35;      // never slower than 35% of base speed

/** Movement speed multiplier while carrying loot of the given weight (0 = empty-handed). */
export function carrySpeedFactor(weight) {
  return Math.max(CARRY_MIN_SPEED, 1 - weight * CARRY_SLOW_PER_WEIGHT);
}

// Client-side smoothing.
export const INTERP_DELAY_MS = 120; // remote entities render this far in the past
