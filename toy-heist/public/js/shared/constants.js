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

// Interest management.
export const AOI_CELL_SIZE = 16;    // spatial hash cell size (metres)
export const AOI_NEAR_CELLS = 1;    // cells around the viewer that update at full rate
export const FAR_UPDATE_EVERY = 3;  // far entities update every Nth tick (10 Hz)

// Client-side smoothing.
export const INTERP_DELAY_MS = 120; // remote entities render this far in the past
