// Chaos Mode: Twitch chat votes on a gameplay-altering event every cycle.
//
//   TwitchChat   - a small read-only Twitch IRC client over WebSocket (anonymous
//                  login, auto-reconnect). One per process, shared by all rooms.
//   ChaosEngine  - one per room. Runs calm -> vote -> event on a fixed cycle
//                  during a match, tallies "!vote 1|2|3" and applies the winner.
//
// Events:
//   1 Lights Out    client-side lighting change (driven by replicated state)
//   2 Zero Gravity  sets body.lowg on everyone; the shared movement code does the rest
//   3 Banana Rain   spawns BANANA_COUNT hazards; a toy stepping on one drops its loot

import { HazardState } from "../rooms/schema/HeistState.js";
import { config } from "../config.js";
import {
  TICK_RATE, ROLE_TOY, STATUS_ACTIVE,
  CHAOS_OFF, CHAOS_CALM, CHAOS_VOTE, CHAOS_EVENT,
  CHAOS_ZERO_GRAVITY, CHAOS_BANANA_RAIN, BANANA_COUNT, BANANA_RADIUS,
} from "../../public/js/shared/constants.js";
import { ARENA_SIZE, isBlocked, nearJail, extractionZoneAt } from "../../public/js/shared/map.js";

// ------------------------------------------------------------- Twitch IRC --

const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const VOTE_PATTERN = /^!vote\s*([123])\b/i;

export class TwitchChat {
  constructor(channel, url) {
    this.channel = channel;
    this.url = url;
    this.listeners = new Set();   // (user, text) => void
    this.socket = null;
    this.retryMs = RECONNECT_MIN_MS;
    this.retryTimer = null;
    this.closed = false;
  }

  /** Register a chat listener; returns an unsubscribe function. Connects on first use. */
  subscribe(listener) {
    this.listeners.add(listener);
    if (!this.socket && !this.retryTimer) this.connect();
    return () => this.listeners.delete(listener);
  }

  connect() {
    if (this.closed) return;
    let socket;
    try {
      socket = new WebSocket(this.url);
    } catch (err) {
      console.error(`[twitch] cannot open ${this.url}: ${err.message}`);
      return this.scheduleReconnect();
    }
    this.socket = socket;

    socket.addEventListener("open", () => {
      // "justinfan<digits>" is Twitch's anonymous read-only login: no token needed.
      socket.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`);
      socket.send(`JOIN #${this.channel}`);
      this.retryMs = RECONNECT_MIN_MS;
      console.log(`[twitch] connected, listening to #${this.channel}`);
    });
    socket.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return;
      for (const line of ev.data.split("\r\n")) if (line) this.handleLine(line);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => { /* a close event always follows */ });
  }

  handleLine(line) {
    if (line.startsWith("PING")) { this.socket.send(line.replace("PING", "PONG")); return; }
    if (line.includes(" RECONNECT")) { this.socket.close(); return; }   // Twitch asks us to cycle the connection

    // :user!user@user.tmi.twitch.tv PRIVMSG #channel :message text
    const m = /^(?:@\S+ )?:([^!\s]+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(line);
    if (!m) return;
    for (const listener of this.listeners) listener(m[1].toLowerCase(), m[2]);
  }

  scheduleReconnect() {
    if (this.closed || this.retryTimer) return;
    console.log(`[twitch] disconnected, retrying in ${Math.round(this.retryMs / 1000)}s`);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, this.retryMs);
    this.retryTimer.unref();   // never keep the process alive just to reconnect
    this.retryMs = Math.min(RECONNECT_MAX_MS, this.retryMs * 2);
  }

  close() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    if (this.socket) this.socket.close();
  }
}

let sharedChat = null;

/** The process-wide chat connection, or null when TWITCH_CHANNEL is not set. */
export function getTwitchChat() {
  if (!config.twitchChannel) return null;
  if (!sharedChat) sharedChat = new TwitchChat(config.twitchChannel, config.twitchIrcUrl);
  return sharedChat;
}

// ------------------------------------------------------------ chaos cycle --

const MAX_VOTERS = 20000;          // memory cap per voting window
const BANANA_SPACING = 3;          // metres between bananas
const BANANA_MAX_HEIGHT = 0.6;     // only toys on (or near) the floor slip
const EVENT_IDS = [1, 2, 3];

export class ChaosEngine {
  /**
   * state: HeistState; loot: LootSystem (to drop loot on a slip).
   * options: { enabled, chat, calmSeconds, voteSeconds, eventSeconds, random } - all default from config.
   */
  constructor(state, loot, options = {}) {
    this.state = state;
    this.chaos = state.chaos;
    this.loot = loot;
    this.enabled = options.enabled ?? config.chaosEnabled;
    this.random = options.random ?? Math.random;
    this.ticks = {
      [CHAOS_CALM]: (options.calmSeconds ?? config.chaosCalmSeconds) * TICK_RATE,
      [CHAOS_VOTE]: (options.voteSeconds ?? config.chaosVoteSeconds) * TICK_RATE,
      [CHAOS_EVENT]: (options.eventSeconds ?? config.chaosEventSeconds) * TICK_RATE,
    };
    this.ticksLeft = 0;
    this.ballots = new Map();   // username -> option; one (changeable) vote per viewer
    this.slips = [];            // scratch list returned by update()

    const chat = options.chat === undefined ? getTwitchChat() : options.chat;
    this.chaos.channel = chat ? chat.channel : "";
    this.unsubscribe = chat && this.enabled ? chat.subscribe((user, text) => this.onChat(user, text)) : null;
  }

  /** A match is starting: begin the first cycle. */
  start(players) {
    this.stop(players);
    if (this.enabled) this.enter(CHAOS_CALM);
  }

  /** The match ended (or is being reset): undo any live event. */
  stop(players) {
    this.endEvent(players);
    this.clearVotes();
    this.chaos.event = 0;
    this.chaos.phase = CHAOS_OFF;
    this.chaos.timeLeft = 0;
    this.ticksLeft = 0;
  }

  dispose() {
    if (this.unsubscribe) this.unsubscribe();
  }

  /**
   * Advance one tick while a match is running. `players` is the room's
   * sessionId -> record Map. Returns the records of toys that slipped on a
   * banana this tick (usually empty; the array is reused between calls).
   */
  update(players) {
    this.slips.length = 0;
    const c = this.chaos;
    if (c.phase === CHAOS_OFF) return this.slips;

    if (c.phase === CHAOS_EVENT) this.applyEvent(players);

    this.ticksLeft--;
    const seconds = Math.max(0, Math.ceil(this.ticksLeft / TICK_RATE));
    if (seconds !== c.timeLeft) c.timeLeft = seconds;
    if (this.ticksLeft > 0) return this.slips;

    if (c.phase === CHAOS_CALM) {
      this.clearVotes();
      c.event = 0;
      this.enter(CHAOS_VOTE);
    } else if (c.phase === CHAOS_VOTE) {
      c.event = this.pickWinner();
      this.beginEvent();
      this.enter(CHAOS_EVENT);
    } else {
      this.endEvent(players);
      this.enter(CHAOS_CALM);
    }
    return this.slips;
  }

  enter(phase) {
    this.chaos.phase = phase;
    this.ticksLeft = this.ticks[phase];
    this.chaos.timeLeft = Math.ceil(this.ticksLeft / TICK_RATE);
  }

  // ---------------------------------------------------------------- votes --

  onChat(user, text) {
    const m = VOTE_PATTERN.exec(text.trim());
    if (m) this.castVote(user, Number(m[1]));
  }

  /** Count a vote. Each user has one ballot per window; voting again moves it. */
  castVote(user, option) {
    if (this.chaos.phase !== CHAOS_VOTE || !EVENT_IDS.includes(option)) return;
    const previous = this.ballots.get(user);
    if (previous === option) return;
    if (previous === undefined && this.ballots.size >= MAX_VOTERS) return;
    if (previous !== undefined) this.chaos[`votes${previous}`]--;
    this.ballots.set(user, option);
    this.chaos[`votes${option}`]++;
  }

  clearVotes() {
    this.ballots.clear();
    for (const id of EVENT_IDS) if (this.chaos[`votes${id}`] !== 0) this.chaos[`votes${id}`] = 0;
  }

  /** Most votes wins; ties (including nobody voting) are broken at random. */
  pickWinner() {
    const top = Math.max(...EVENT_IDS.map((id) => this.chaos[`votes${id}`]));
    const tied = EVENT_IDS.filter((id) => this.chaos[`votes${id}`] === top);
    return tied[Math.floor(this.random() * tied.length)];
  }

  // --------------------------------------------------------------- events --

  beginEvent() {
    if (this.chaos.event === CHAOS_BANANA_RAIN) this.spawnBananas();
  }

  /** Per-tick effect of the live event. */
  applyEvent(players) {
    const event = this.chaos.event;
    if (event === CHAOS_ZERO_GRAVITY) {
      // Re-applied every tick so late joiners and respawned bodies float too.
      for (const rec of players.values()) rec.body.lowg = 1;
    } else if (event === CHAOS_BANANA_RAIN) {
      for (const rec of players.values()) {
        if (!rec.carrying || rec.state.role !== ROLE_TOY || rec.state.status !== STATUS_ACTIVE) continue;
        if (rec.body.y <= BANANA_MAX_HEIGHT && this.onBanana(rec.body.x, rec.body.z)) {
          this.loot.drop(rec);
          this.slips.push(rec);
        }
      }
    }
  }

  endEvent(players) {
    if (players) for (const rec of players.values()) rec.body.lowg = 0;
    if (this.state.hazards.size > 0) {
      for (const id of [...this.state.hazards.keys()]) this.state.hazards.delete(id);
    }
  }

  onBanana(x, z) {
    let hit = false;
    this.state.hazards.forEach((h) => {
      const dx = h.x - x, dz = h.z - z;
      if (dx * dx + dz * dz <= BANANA_RADIUS * BANANA_RADIUS) hit = true;
    });
    return hit;
  }

  spawnBananas() {
    const half = ARENA_SIZE / 2 - 2;
    for (let id = 1; id <= BANANA_COUNT; id++) {
      let x = 0, z = 0;
      for (let attempt = 0; attempt < 200; attempt++) {
        x = (this.random() * 2 - 1) * half;
        z = (this.random() * 2 - 1) * half;
        const spacing = attempt < 100 ? BANANA_SPACING : 0;   // relax spacing rather than fail
        if (this.isFreeSpot(x, z, spacing)) break;
      }
      this.state.hazards.set(String(id), new HazardState(x, z));
    }
  }

  isFreeSpot(x, z, spacing) {
    if (isBlocked(x, z, 0.8) || nearJail(x, z, 1) || extractionZoneAt(x, z) >= 0) return false;
    let free = true;
    this.state.hazards.forEach((h) => { if (Math.hypot(h.x - x, h.z - z) < spacing) free = false; });
    return free;
  }
}
