// Client entry point: wires rendering, input, camera and networking together.
//
//   Input ──> Prediction (local player, 30 Hz fixed step) ──> NetClient ──> server
//   server snapshots ──> Prediction.reconcile (local) + SnapshotBuffer (remotes)
//   requestAnimationFrame ──> interpolate everything ──> ChaseCamera ──> render
import * as THREE from "three";
import {
  TICK_DT, TICK_MS, TICK_RATE, ROLE_STATS, ROLE_TOY, ROLE_GUARD, PHASE_LOBBY, PHASE_PLAYING, PHASE_ENDED,
  STATUS_ACTIVE, STATUS_JAILED, ARREST_RANGE, ARREST_HEIGHT,
  LOOT_TYPES, INTERACT_RANGE, INTERACT_HEIGHT, carrySpeedFactor,
} from "./shared/constants.js";
import { JailView, TargetMarkers, inLeverRange } from "./jail.js";
import { EndBanner, formatTime } from "./endBanner.js";
import { extractionZoneAt } from "./shared/map.js";
import { LootView } from "./loot.js";
import { buildWorld } from "./world.js";
import { createPlayerModel, createNameTag, disposeModel } from "./models.js";
import { Input } from "./input.js";
import { ChaseCamera } from "./camera.js";
import { NetClient } from "./net/NetClient.js";
import { Prediction } from "./net/Prediction.js";
import { ServerClock, SnapshotBuffer, shortestAngle } from "./net/Interpolation.js";

// ------------------------------------------------------------------ scene --

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 300);
camera.position.set(0, 14, 52);
camera.lookAt(0, 0, 0);

const solids = buildWorld(scene);
const input = new Input(canvas);
const chase = new ChaseCamera(camera, solids);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// --------------------------------------------------------------- entities --

const net = new NetClient();
const clock = new ServerClock();
const prediction = new Prediction();
const loot = new LootView(scene);
const jailView = new JailView(scene);
const targets = new TargetMarkers(document.getElementById("targets"), camera);
const endBanner = new EndBanner(document.getElementById("end"));

// Match-level facts derived from replicated state (refreshed in net.onState).
const match = { phase: PHASE_LOBBY, jailed: 0, toys: 0, leverProgress: 0, leverHolder: 0 };
let detected = [];     // guard only: nids of toys in our flashlight beam (from snapshots)
let spotted = false;   // toy only: a guard has us in their beam

// Local player
const local = { role: ROLE_TOY, status: STATUS_ACTIVE, nid: 0, name: "", model: null, pos: new THREE.Vector3(), yaw: 0 };

// Remote players: sessionId -> { nid, role, name, model, buffer }
const remotes = new Map();
const remotesByNid = new Map();

// Network id -> avatar currently drawn for that player (used to pin carried loot overhead).
function avatarOf(nid) {
  if (nid === local.nid) return local.model;
  const r = remotesByNid.get(nid);
  return r ? r.model : null;
}

function buildAvatar(role, nid, name, withTag) {
  const model = createPlayerModel(role, nid);
  if (withTag) model.add(createNameTag(name, role));
  scene.add(model);
  return model;
}

function destroyAvatar(model) {
  if (!model) return;
  scene.remove(model);
  disposeModel(model);
}

// Roster / role / phase changes arrive through Colyseus schema state (10 Hz deltas).
net.onState = (state) => {
  const seen = new Set();
  let me = null, toys = 0, jailed = 0;
  state.players.forEach((p, sessionId) => {
    seen.add(sessionId);
    if (p.role === ROLE_TOY) { toys++; if (p.status === STATUS_JAILED) jailed++; }

    if (sessionId === net.sessionId) {
      if (!local.model || local.role !== p.role) {
        destroyAvatar(local.model);
        local.model = buildAvatar(p.role, p.nid, p.name, false);
        local.model.visible = prediction.ready;
      }
      local.role = p.role; local.nid = p.nid; local.name = p.name; local.host = p.host;
      local.status = p.status;
      me = p;
      return;
    }

    let r = remotes.get(sessionId);
    if (!r) {
      r = { nid: p.nid, role: null, name: p.name, model: null, buffer: new SnapshotBuffer() };
      remotes.set(sessionId, r);
      remotesByNid.set(p.nid, r);
    }
    if (r.role !== p.role) {             // new player, or roles were reshuffled
      destroyAvatar(r.model);
      r.role = p.role;
      r.model = buildAvatar(p.role, p.nid, p.name, true);
      r.model.visible = false;           // shown once we have a transform for it
    }
    r.status = p.status;
  });

  for (const [sessionId, r] of remotes) {
    if (seen.has(sessionId)) continue;
    destroyAvatar(r.model);
    remotes.delete(sessionId);
    remotesByNid.delete(r.nid);
  }

  match.toys = toys;
  match.jailed = jailed;
  match.leverProgress = state.leverProgress;
  match.leverHolder = state.leverHolder;
  if (state.phase !== match.phase) {
    match.phase = state.phase;
    if (state.phase === PHASE_ENDED) {
      if (document.pointerLockElement) document.exitPointerLock();   // free the mouse for the banner
    } else {
      endBanner.hide();
    }
  }
  // Re-rendered on every patch while ended so late-arriving stats are included.
  if (state.phase === PHASE_ENDED && me) endBanner.show(state, me);

  loot.sync(state.loot);
  updateHud(state);
};

// One-shot gameplay events.
const nameOf = (nid, fallback) => nid === local.nid ? "You" : (remotesByNid.get(nid) || {}).name || fallback;

net.onEvent = (ev) => {
  if (ev.k === "deposit") {
    toast(`${nameOf(ev.n, "A toy")} extracted ${LOOT_TYPES[ev.t].label}  +${ev.p}`);
  } else if (ev.k === "arrest") {
    toast(`${nameOf(ev.g, "A guard")} arrested ${nameOf(ev.n, "a toy").replace(/^You$/, "you")}`, "arrest");
  } else if (ev.k === "jailbreak") {
    toast(`Jailbreak! ${nameOf(ev.n, "A toy")} freed ${ev.c} ${ev.c === 1 ? "toy" : "toys"}`);
  }
};

// High-frequency transforms arrive as interest-filtered snapshot messages.
let lastSnapshotEntities = 0;
net.onSnapshot = (snap) => {
  clock.observe(snap.t, performance.now());

  const snapped = prediction.reconcile(snap.m, snap.a, local.role);
  if (snapped) {
    // First spawn or teleport: put the camera behind the character.
    input.yaw = prediction.body.yaw;
    local.yaw = prediction.body.yaw;
    chase.initialised = false;
  }

  const t = snap.t * TICK_MS;
  for (const e of snap.e) {
    const r = remotesByNid.get(e[0]);
    if (r) r.buffer.push(t, e[1], e[2], e[3], e[4]);
  }
  lastSnapshotEntities = snap.e.length;
  detected = snap.d || [];
  spotted = snap.sp === 1;
};

net.onDisconnect = () => {
  for (const r of remotes.values()) destroyAvatar(r.model);
  remotes.clear(); remotesByNid.clear();
  loot.clear();
  endBanner.hide();
  targets.update([]);
  match.phase = PHASE_LOBBY;
  destroyAvatar(local.model); local.model = null;
  prediction.ready = false;
  input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  ui.hud.hidden = true;
  ui.menu.hidden = false;
  ui.error.textContent = "Disconnected from the lobby.";
};

// -------------------------------------------------------------------- loop --

const tmp = { x: 0, y: 0, z: 0, yaw: 0 };
const targetPoints = [];
let last = performance.now();
let accumulator = 0;
let fps = 60;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  if (net.room && prediction.ready) {
    // Fixed-step local simulation: one input sampled, sent and predicted per tick.
    accumulator = Math.min(accumulator + dt, TICK_DT * 5);
    while (accumulator >= TICK_DT) {
      accumulator -= TICK_DT;
      const cmd = input.sample(prediction.nextSeq());
      if (match.phase === PHASE_ENDED) {   // the server freezes everyone too; predict the same
        cmd.f = cmd.r = 0;
        cmd.j = cmd.e = cmd.h = cmd.a = false;
      }
      net.sendInput(cmd);
      prediction.apply(cmd, local.role);
    }

    // Local player: interpolate between the last two predicted ticks.
    prediction.renderPosition(accumulator / TICK_DT, dt, local.pos);
    local.yaw += shortestAngle(local.yaw, prediction.body.yaw) * (1 - Math.exp(-14 * dt));
    if (local.model) {
      local.model.visible = true;
      local.model.position.copy(local.pos);
      local.model.rotation.y = local.yaw;
    }

    // Remote players: render in the past, between buffered snapshots.
    const renderTime = clock.renderTime(now);
    for (const r of remotes.values()) {
      if (!r.model || !r.buffer.sample(renderTime, tmp)) continue;
      r.model.visible = true;
      r.model.position.set(tmp.x, tmp.y, tmp.z);
      r.model.rotation.y = tmp.yaw;
    }

    loot.update(now, avatarOf);
    jailView.update(now, dt, match.jailed, match.leverProgress);
    updateInteractionHud();

    chase.update(local.pos, ROLE_STATS[local.role].height * 0.9, input.yaw, input.pitch, input.zoom, dt);
    // Guard HUD: reticles over toys caught in the flashlight (after the camera has moved).
    targetPoints.length = 0;
    if (local.role === ROLE_GUARD && match.phase !== PHASE_ENDED) {
      for (const nid of detected) {
        const r = remotesByNid.get(nid);
        if (!r || !r.model || !r.model.visible) continue;
        const p = r.model.position;
        targetPoints.push({ x: p.x, y: p.y + ROLE_STATS[ROLE_TOY].height * 0.5, z: p.z });
      }
    }
    camera.updateMatrixWorld();
    targets.update(targetPoints);

    ui.hint.hidden = input.locked;
    ui.debug.textContent =
      `${fps.toFixed(0)} fps\n` +
      `unacked inputs ${prediction.pending.length}\n` +
      `entities in snapshot ${lastSnapshotEntities}/${remotes.size}\n` +
      `correction ${(prediction.lastCorrection * 100).toFixed(1)} cm`;
  } else {
    // Menu backdrop: slow orbit around the vault.
    const a = now * 0.00008;
    camera.position.set(Math.sin(a) * 52, 16, Math.cos(a) * 52);
    camera.lookAt(0, 1, 0);
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------- UI --

const $ = (id) => document.getElementById(id);
const ui = {
  menu: $("menu"), hud: $("hud"), error: $("error"), name: $("name"), code: $("code"),
  create: $("create"), join: $("join"), start: $("start"), hint: $("hint"), debug: $("debug"),
  hudCode: $("hud-code"), hudRole: $("hud-role"), hudPhase: $("hud-phase"), hudCount: $("hud-count"),
  hudTimer: $("hud-timer"), hudTarget: $("hud-target"), hudJailed: $("hud-jailed"), hudToys: $("hud-toys"),
  status: $("status"), lever: $("lever"), leverFill: $("lever-fill"), again: $("again"),
  roster: $("roster"), hudScore: $("hud-score"), carry: $("carry"), prompt: $("prompt"), toasts: $("toasts"),
};

ui.name.value = localStorage.getItem("heist-name") || "";
const urlCode = new URLSearchParams(location.search).get("code");
if (urlCode) ui.code.value = urlCode;

async function enter(action) {
  ui.error.textContent = "";
  ui.create.disabled = ui.join.disabled = true;
  try {
    const name = ui.name.value.trim();
    localStorage.setItem("heist-name", name);
    await action(name);
    ui.menu.hidden = true;
    ui.hud.hidden = false;
    input.enabled = true;
  } catch (err) {
    ui.error.textContent = err.message || "Could not connect";
  } finally {
    ui.create.disabled = ui.join.disabled = false;
  }
}

ui.create.addEventListener("click", () => enter((name) => net.createLobby(name)));
ui.join.addEventListener("click", () => enter((name) => net.joinLobby(ui.code.value.trim(), name)));
ui.code.addEventListener("keydown", (e) => { if (e.key === "Enter") ui.join.click(); });
ui.code.addEventListener("input", () => { ui.code.value = ui.code.value.replace(/\D/g, ""); });
ui.start.addEventListener("click", () => net.requestStart());
ui.again.addEventListener("click", () => net.requestStart());

function updateHud(state) {
  ui.hudCode.textContent = state.code;
  ui.hudCount.textContent = state.players.size;
  ui.hudScore.textContent = state.score;
  ui.hudTarget.textContent = state.targetScore;
  ui.hudJailed.textContent = match.jailed;
  ui.hudToys.textContent = match.toys;
  ui.hudTimer.textContent = state.phase === PHASE_LOBBY ? "--:--" : formatTime(state.timeLeft);
  ui.hudTimer.classList.toggle("low", state.phase === PHASE_PLAYING && state.timeLeft <= 30);
  ui.hudPhase.textContent = state.phase.toUpperCase();
  ui.hudRole.textContent = local.role.toUpperCase();
  ui.hudRole.className = `chip ${local.role}`;
  ui.start.hidden = !local.host;
  ui.start.textContent = state.phase === PHASE_LOBBY ? "Start match" : "Restart match";

  ui.roster.replaceChildren();
  state.players.forEach((p, sessionId) => {
    const li = document.createElement("li");
    li.textContent = p.name + (p.host ? " ★" : "");
    if (p.score > 0) {
      const pts = document.createElement("span");
      pts.textContent = p.score;
      li.append(pts);
    }
    if (p.role === ROLE_GUARD) li.classList.add("guard");
    if (p.status === STATUS_JAILED) li.classList.add("jailed");
    if (sessionId === net.sessionId) li.classList.add("me");
    ui.roster.append(li);
  });
}

// Contextual HUD for the local player: carry banner, action prompt, status
// banner and lever progress. Runs every frame but only touches the DOM when
// something actually changes.
const hudCache = { carry: "", prompt: "", status: "", statusClass: "", lever: -1 };

function updateInteractionHud() {
  let carry = "", prompt = "", status = "", statusClass = "", lever = -1;
  const b = prediction.body;
  const playing = match.phase !== PHASE_ENDED;

  if (playing && local.role === ROLE_TOY) {
    if (local.status === STATUS_JAILED) {
      status = "IN JAIL · a free toy must hold the lever to break you out";
      statusClass = "jailed";
    } else {
      if (b.boost > 0) { status = `SPEED BOOST ${(b.boost / TICK_RATE).toFixed(1)}s · RUN!`; statusClass = "boost"; }
      else if (spotted) { status = "SPOTTED! A guard has you in their flashlight"; statusClass = "spotted"; }

      const held = loot.carriedBy(local.nid);
      if (held) {
        const def = LOOT_TYPES[held.type];
        const slow = Math.round((1 - carrySpeedFactor(def.weight)) * 100);
        carry = `Carrying ${def.label} · ${def.points} pts · -${slow}% speed`;
      }
      if (match.jailed > 0 && inLeverRange(b.x, b.z)) {
        // The lever takes priority over loot actions while standing at it.
        prompt = `<kbd>E</kbd>Hold to free ${match.jailed} jailed ${match.jailed === 1 ? "toy" : "toys"}`;
        if (match.leverHolder === local.nid) lever = match.leverProgress;
      } else if (held) {
        prompt = extractionZoneAt(b.x, b.z) >= 0 ? "" : "<kbd>E</kbd>Drop · carry it to a green chute to score";
      } else {
        const near = loot.nearestFree(b.x, b.y, b.z, INTERACT_RANGE, INTERACT_HEIGHT);
        if (near) {
          const def = LOOT_TYPES[near.type];
          prompt = `<kbd>E</kbd>Grab ${def.label} · ${def.points} pts · weight ${def.weight}`;
        }
      }
    }
  } else if (playing && local.role === ROLE_GUARD) {
    const toy = nearestArrestable(b);
    if (toy) prompt = `<kbd>F</kbd>Arrest ${escapeHtml(toy.name)}`;
    if (detected.length) {
      status = `${detected.length} ${detected.length === 1 ? "toy" : "toys"} in your flashlight`;
      statusClass = "spotted";
    }
  }

  const c = hudCache;
  if (carry !== c.carry) { c.carry = carry; ui.carry.textContent = carry; ui.carry.hidden = !carry; }
  if (prompt !== c.prompt) { c.prompt = prompt; ui.prompt.innerHTML = prompt; ui.prompt.hidden = !prompt; }
  if (status !== c.status || statusClass !== c.statusClass) {
    c.status = status; c.statusClass = statusClass;
    ui.status.textContent = status; ui.status.className = statusClass; ui.status.hidden = !status;
  }
  if (lever !== c.lever) {
    c.lever = lever;
    ui.lever.hidden = lever < 0;
    ui.leverFill.style.width = `${Math.max(0, lever)}%`;
  }
}

// Closest free toy within arrest reach of the local guard (mirrors JailSystem.tryArrest,
// using the interpolated positions we are drawing).
function nearestArrestable(b) {
  let best = null, bestDistSq = ARREST_RANGE * ARREST_RANGE;
  for (const r of remotes.values()) {
    if (r.role !== ROLE_TOY || r.status !== STATUS_ACTIVE || !r.model || !r.model.visible) continue;
    const p = r.model.position;
    if (Math.abs(p.y - b.y) > ARREST_HEIGHT) continue;
    const dx = p.x - b.x, dz = p.z - b.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= bestDistSq) { best = r; bestDistSq = distSq; }
  }
  return best;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function toast(text, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  ui.toasts.append(el);
  while (ui.toasts.children.length > 4) ui.toasts.firstChild.remove();
  setTimeout(() => el.remove(), 3000);
}

// Debug handle for the console / automated tests.
window.__heist = { net, prediction, remotes, local, input, scene, camera, loot, match, getDetected: () => detected };
