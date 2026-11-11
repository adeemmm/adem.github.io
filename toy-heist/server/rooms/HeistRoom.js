import { Room } from "colyseus";
import { HeistState, PlayerState } from "./schema/HeistState.js";
import { SpatialHash } from "../sim/SpatialHash.js";
import { LootSystem } from "../sim/LootSystem.js";
import { JailSystem } from "../sim/JailSystem.js";
import { VisionSystem } from "../sim/VisionSystem.js";
import { ChaosEngine } from "../sim/TwitchChaos.js";
import { config } from "../config.js";
import {
  TICK_MS, TICK_DT, TICK_RATE, MAX_PLAYERS, MAX_GUARDS, TOYS_PER_GUARD,
  ROLE_TOY, ROLE_GUARD, PHASE_LOBBY, PHASE_PLAYING, PHASE_ENDED, TEAM_TOYS, TEAM_GUARDS, VISION_EVERY,
  MSG_INPUT, MSG_SNAPSHOT, MSG_START, MSG_EVENT,
  AOI_CELL_SIZE, AOI_NEAR_CELLS, FAR_UPDATE_EVERY, LOOT_TYPES,
} from "../../public/js/shared/constants.js";
import { createBody, stepBody, sanitizeInput } from "../../public/js/shared/movement.js";
import { spawnPoint } from "../../public/js/shared/map.js";

// Join codes currently in use by live rooms in this process.
// (When scaling past one process, move this to the Colyseus presence layer.)
const activeCodes = new Set();

function generateJoinCode() {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!activeCodes.has(code)) return code;
  }
  throw new Error("No free join codes");
}

const MAX_INPUT_QUEUE = 12;   // inputs buffered per player before we drop the oldest
const MAX_STEP_CREDIT = 6;    // burst allowance (ticks) to absorb network jitter
const STARVE_TICKS = 10;      // no input for this long -> server idles the body itself
const IDLE_INPUT = { s: 0, f: 0, r: 0, y: 0, j: false, e: false, h: false, a: false };

const q = (v) => Math.round(v * 100) / 100;   // quantise to 1 cm for the wire

export class HeistRoom extends Room {
  onCreate() {
    this.maxClients = MAX_PLAYERS;

    // 4-digit join code doubles as the Colyseus room id, so clients simply
    // call joinById("1234").
    this.code = generateJoinCode();
    activeCodes.add(this.code);
    this.roomId = this.code;

    this.setState(new HeistState());
    this.state.code = this.code;
    this.setPatchRate(100);   // roster/phase deltas at 10 Hz; transforms use snapshots

    this.tick = 0;
    this.sim = new Map();     // sessionId -> server-only simulation record
    this.freeNids = Array.from({ length: MAX_PLAYERS }, (_, i) => MAX_PLAYERS - i); // pop() -> 1,2,3...
    this.grid = new SpatialHash(AOI_CELL_SIZE);

    // Loot is live from the moment the lobby opens so players can practise;
    // startMatch() reshuffles it and zeroes the scores.
    this.loot = new LootSystem(this.state);
    this.loot.spawnAll();
    this.jail = new JailSystem(this.state, this.loot);
    this.vision = new VisionSystem();
    this.chaos = new ChaosEngine(this.state, this.loot);   // Twitch-voted events (off unless configured)

    this.state.targetScore = config.targetScore;
    this.state.timeLeft = config.matchSeconds;
    this.matchEndTick = 0;    // tick at which the running match times out

    this.onMessage(MSG_INPUT, (client, raw) => {
      const rec = this.sim.get(client.sessionId);
      const input = sanitizeInput(raw);
      if (!rec || !input || input.s <= rec.lastQueuedSeq) return;   // garbage / replayed
      rec.lastQueuedSeq = input.s;
      if (rec.inputs.length >= MAX_INPUT_QUEUE) rec.inputs.shift();
      rec.inputs.push(input);
    });

    this.onMessage(MSG_START, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p && p.host) this.startMatch();
    });

    // The authoritative 30 Hz loop.
    this.setSimulationInterval(() => this.update(), TICK_MS);
    console.log(`[room ${this.code}] created`);
  }

  onJoin(client, options) {
    const p = new PlayerState();
    p.nid = this.freeNids.pop();
    p.name = cleanName(options && options.name, p.nid);
    p.role = this.pickRoleForNewPlayer();
    p.host = this.state.players.size === 0;
    this.state.players.set(client.sessionId, p);

    const rec = {
      client, state: p,
      body: createBody(),
      inputs: [],
      lastQueuedSeq: -1,
      lastProcessedSeq: -1,
      lastInput: IDLE_INPUT,
      carrying: null, // LootState this player holds (server-side handle)
      holdE: false,   // interact key held as of the last processed input (jail lever)
      detected: [],   // guards: nids of toys currently in the flashlight beam
      spotted: false, // toys: some guard currently has them in the beam
      credit: 1,
      starved: 0,
      wire: null,     // quantised [nid, x, y, z, yaw] built once per tick
      near: false,    // scratch flag used while building a viewer's snapshot
    };
    this.sim.set(client.sessionId, rec);
    this.spawn(rec, this.countRole(p.role) - 1);
    console.log(`[room ${this.code}] ${p.name} joined as ${p.role} (${this.state.players.size}/${MAX_PLAYERS})`);
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    this.loot.drop(this.sim.get(client.sessionId));   // leave carried loot where they stood
    this.freeNids.push(p.nid);
    this.state.players.delete(client.sessionId);
    this.sim.delete(client.sessionId);
    if (p.host) {   // host migration: promote the next player in join order
      const next = this.state.players.values().next().value;
      if (next) next.host = true;
    }
    console.log(`[room ${this.code}] ${p.name} left (${this.state.players.size}/${MAX_PLAYERS})`);
  }

  onDispose() {
    this.chaos.dispose();
    activeCodes.delete(this.code);
    console.log(`[room ${this.code}] disposed`);
  }

  // ---------------------------------------------------------------- roles --

  countRole(role) {
    let n = 0;
    this.state.players.forEach((p) => { if (p.role === role) n++; });
    return n;
  }

  // Lobby / late-join balancing: keep one guard per TOYS_PER_GUARD toys, so
  // the 4th, 8th, 12th... player becomes a guard (8 guards at 32 players).
  pickRoleForNewPlayer() {
    const total = this.state.players.size + 1;
    const guardsWanted = Math.min(MAX_GUARDS, Math.floor(total / (TOYS_PER_GUARD + 1)));
    return this.countRole(ROLE_GUARD) < guardsWanted ? ROLE_GUARD : ROLE_TOY;
  }

  // Host pressed start: shuffle everyone, deal fresh roles, move to spawns.
  startMatch() {
    const recs = [...this.sim.values()];
    for (let i = recs.length - 1; i > 0; i--) {   // Fisher-Yates
      const j = Math.floor(Math.random() * (i + 1));
      [recs[i], recs[j]] = [recs[j], recs[i]];
    }
    const n = recs.length;
    const guards = n < 2 ? 0 : Math.min(MAX_GUARDS, Math.max(1, Math.round(n / (TOYS_PER_GUARD + 1))));
    let g = 0, t = 0;
    this.loot.reset(recs);
    this.jail.reset(this.sim);
    this.state.score = 0;
    this.state.winner = "";
    this.state.reason = "";
    this.state.timeLeft = config.matchSeconds;
    this.matchEndTick = this.tick + config.matchSeconds * TICK_RATE;
    this.chaos.start(this.sim);
    recs.forEach((rec, i) => {
      rec.state.score = 0;
      rec.state.arrests = 0;
      rec.state.rescues = 0;
      rec.state.role = i < guards ? ROLE_GUARD : ROLE_TOY;
      this.spawn(rec, rec.state.role === ROLE_GUARD ? g++ : t++);
    });
    this.state.phase = PHASE_PLAYING;
    console.log(`[room ${this.code}] match started: ${guards} guards vs ${n - guards} toys`);
  }

  // Win conditions, checked every tick while a match is running.
  //   Toys:   team score reaches the target.
  //   Guards: every toy is in jail, or the clock runs out first.
  updateMatchRules() {
    if (this.state.score >= this.state.targetScore) return this.endMatch(TEAM_TOYS, "score");
    if (this.jail.allToysJailed()) return this.endMatch(TEAM_GUARDS, "jailed");

    const ticksLeft = Math.max(0, this.matchEndTick - this.tick);
    const secondsLeft = Math.ceil(ticksLeft / TICK_RATE);
    if (secondsLeft !== this.state.timeLeft) this.state.timeLeft = secondsLeft;   // 1 Hz on the wire
    if (ticksLeft === 0) this.endMatch(TEAM_GUARDS, "time");
  }

  endMatch(winner, reason) {
    this.state.winner = winner;
    this.state.reason = reason;
    this.state.phase = PHASE_ENDED;
    this.jail.resetLever();
    this.chaos.stop(this.sim);
    console.log(`[room ${this.code}] match over: ${winner} win (${reason}), score ${this.state.score}/${this.state.targetScore}`);
  }

  spawn(rec, index) {
    const s = spawnPoint(rec.state.role, index);
    rec.body = createBody(s.x, s.y, s.z, s.yaw);
    rec.body.carry = rec.carrying ? LOOT_TYPES[rec.carrying.type].weight : 0;
    rec.inputs.length = 0;   // inputs predicted from the old position are meaningless now
  }

  // ----------------------------------------------------------- simulation --

  update() {
    this.tick++;

    // 1. Consume client inputs. Each input advances that player exactly one
    //    fixed step, so the server replays what the client predicted. A credit
    //    bucket (refilled 1/tick) lets jittery arrivals catch up while capping
    //    how much simulated time a speed-hacking client can claim.
    //    Once the match has ended everyone is frozen in place: inputs are still
    //    consumed (so sequence numbers keep acknowledging) but carry no intent.
    const frozen = this.state.phase === PHASE_ENDED;
    for (const rec of this.sim.values()) {
      rec.credit = Math.min(MAX_STEP_CREDIT, rec.credit + 1);
      if (rec.inputs.length === 0) {
        // Stalled client (tab hidden, lag spike): keep gravity/physics honest.
        if (++rec.starved > STARVE_TICKS) {
          rec.holdE = false;
          stepBody(rec.body, idleInputFor(rec), rec.state.role, TICK_DT);
          rec.credit--;
        }
      } else {
        rec.starved = 0;
        while (rec.inputs.length > 0 && rec.credit >= 1) {
          const input = rec.inputs.shift();
          if (frozen) { input.f = input.r = 0; input.j = input.e = input.h = input.a = false; }
          stepBody(rec.body, input, rec.state.role, TICK_DT);
          // Actions run in input order. E at the lever means "pull", not "drop my loot".
          if (input.a) this.handleArrest(rec);
          if (input.e && !this.jail.canUseLever(rec)) this.loot.interact(rec);
          rec.holdE = input.h;
          rec.lastProcessedSeq = input.s;
          rec.lastInput = input;
          rec.credit--;
        }
      }
    }

    // 2. Jail lever: a free toy holding E long enough releases everyone.
    const jailbreak = frozen ? null : this.jail.updateLever(this.sim);
    if (jailbreak) this.broadcast(MSG_EVENT, { k: "jailbreak", n: jailbreak.by.state.nid, c: jailbreak.freed });

    // 3. Extraction: toys carrying loot into a chute bank it for the team.
    for (const rec of this.sim.values()) {
      const deposit = this.loot.tryDeposit(rec);
      if (!deposit) continue;
      this.state.score += deposit.points;
      rec.state.score += deposit.points;
      this.broadcast(MSG_EVENT, { k: "deposit", n: rec.state.nid, t: deposit.type, p: deposit.points });
    }

    // Chaos Mode: advance the vote/event cycle; report toys that slipped on a banana.
    if (this.state.phase === PHASE_PLAYING) {
      for (const rec of this.chaos.update(this.sim)) {
        this.broadcast(MSG_EVENT, { k: "slip", n: rec.state.nid });
      }
    }

    // 4. Rebuild the broad phase and each entity's wire record.
    this.grid.clear();
    for (const rec of this.sim.values()) {
      const b = rec.body;
      rec.wire = [rec.state.nid, q(b.x), q(b.y), q(b.z), q(b.yaw)];
      this.grid.insert(rec, b.x, b.z);
    }

    // 5. Guard flashlight detection (10 Hz is plenty for a HUD indicator).
    if (this.tick % VISION_EVERY === 0) this.vision.update(this.sim, this.grid);

    // 6. Timer and win conditions.
    if (this.state.phase === PHASE_PLAYING) this.updateMatchRules();

    // 7. Per-client interest-filtered snapshots.
    this.broadcastSnapshots();
  }

  handleArrest(guard) {
    const toy = this.jail.tryArrest(guard, this.sim);
    if (toy) this.broadcast(MSG_EVENT, { k: "arrest", g: guard.state.nid, n: toy.state.nid });
  }

  // Each viewer gets:
  //  - their own full-precision body + the last input seq we applied (for reconciliation)
  //  - guards: `d`, the nids of toys in their flashlight beam; toys: `sp` when spotted
  //  - entities in nearby grid cells every tick (30 Hz)
  //  - everything else every FAR_UPDATE_EVERY ticks (10 Hz), staggered by nid
  //    so far updates are spread evenly across ticks instead of bursting.
  broadcastSnapshots() {
    const markNear = (other) => { other.near = true; };
    for (const viewer of this.sim.values()) {
      const vb = viewer.body;
      this.grid.queryCells(vb.x, vb.z, AOI_NEAR_CELLS, markNear);

      const ents = [];
      for (const other of this.sim.values()) {
        const near = other.near;
        other.near = false;
        if (other === viewer) continue;
        if (near || (this.tick + other.state.nid) % FAR_UPDATE_EVERY === 0) ents.push(other.wire);
      }

      const snap = {
        t: this.tick,
        a: viewer.lastProcessedSeq,
        m: [vb.x, vb.y, vb.z, vb.vx, vb.vy, vb.vz, vb.yaw, vb.grounded ? 1 : 0, vb.carry, vb.jailed, vb.boost, vb.lowg],
        e: ents,
      };
      if (viewer.detected.length) snap.d = viewer.detected;
      if (viewer.spotted) snap.sp = 1;
      viewer.client.send(MSG_SNAPSHOT, snap);
    }
  }
}

// A starved player keeps their last look direction but stops moving.
function idleInputFor(rec) {
  IDLE_INPUT.y = rec.lastInput.y;
  return IDLE_INPUT;
}

function cleanName(raw, nid) {
  const name = typeof raw === "string" ? raw.replace(/[^\w \-]/g, "").trim().slice(0, 16) : "";
  return name || `Player${nid}`;
}
