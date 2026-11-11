// Client entry point: wires rendering, input, camera and networking together.
//
//   Input ──> Prediction (local player, 30 Hz fixed step) ──> NetClient ──> server
//   server snapshots ──> Prediction.reconcile (local) + SnapshotBuffer (remotes)
//   requestAnimationFrame ──> interpolate everything ──> ChaseCamera ──> render
import * as THREE from "three";
import {
  TICK_DT, TICK_MS, ROLE_STATS, ROLE_TOY, ROLE_GUARD, PHASE_LOBBY,
  LOOT_TYPES, INTERACT_RANGE, INTERACT_HEIGHT, carrySpeedFactor,
} from "./shared/constants.js";
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

// Local player
const local = { role: ROLE_TOY, nid: 0, name: "", model: null, pos: new THREE.Vector3(), yaw: 0 };

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
  state.players.forEach((p, sessionId) => {
    seen.add(sessionId);

    if (sessionId === net.sessionId) {
      if (!local.model || local.role !== p.role) {
        destroyAvatar(local.model);
        local.model = buildAvatar(p.role, p.nid, p.name, false);
        local.model.visible = prediction.ready;
      }
      local.role = p.role; local.nid = p.nid; local.name = p.name; local.host = p.host;
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
  });

  for (const [sessionId, r] of remotes) {
    if (seen.has(sessionId)) continue;
    destroyAvatar(r.model);
    remotes.delete(sessionId);
    remotesByNid.delete(r.nid);
  }

  loot.sync(state.loot);
  updateHud(state);
};

// One-shot gameplay events.
net.onEvent = (ev) => {
  if (ev.k !== "deposit") return;
  const who = ev.n === local.nid ? "You" : (remotesByNid.get(ev.n) || {}).name || "A toy";
  toast(`${who} extracted ${LOOT_TYPES[ev.t].label}  +${ev.p}`);
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
};

net.onDisconnect = () => {
  for (const r of remotes.values()) destroyAvatar(r.model);
  remotes.clear(); remotesByNid.clear();
  loot.clear();
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
    updateInteractionHud();

    chase.update(local.pos, ROLE_STATS[local.role].height * 0.9, input.yaw, input.pitch, input.zoom, dt);
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

function updateHud(state) {
  ui.hudCode.textContent = state.code;
  ui.hudCount.textContent = state.players.size;
  ui.hudScore.textContent = state.score;
  ui.hudPhase.textContent = state.phase.toUpperCase();
  ui.hudRole.textContent = local.role.toUpperCase();
  ui.hudRole.className = `chip ${local.role}`;
  ui.start.hidden = !local.host;
  ui.start.textContent = state.phase === PHASE_LOBBY ? "Start match" : "Reshuffle roles";

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
    if (sessionId === net.sessionId) li.classList.add("me");
    ui.roster.append(li);
  });
}

// Carry banner + contextual 'E' prompt for the local player. Runs every frame
// but only touches the DOM when the text actually changes.
let carryText = "", promptText = "";
function updateInteractionHud() {
  let carry = "", prompt = "";
  if (local.role === ROLE_TOY) {
    const b = prediction.body;
    const held = loot.carriedBy(local.nid);
    if (held) {
      const def = LOOT_TYPES[held.type];
      const slow = Math.round((1 - carrySpeedFactor(def.weight)) * 100);
      carry = `Carrying ${def.label} · ${def.points} pts · -${slow}% speed`;
      prompt = extractionZoneAt(b.x, b.z) >= 0 ? "" : "<kbd>E</kbd>Drop · carry it to a green chute to score";
    } else {
      const near = loot.nearestFree(b.x, b.y, b.z, INTERACT_RANGE, INTERACT_HEIGHT);
      if (near) {
        const def = LOOT_TYPES[near.type];
        prompt = `<kbd>E</kbd>Grab ${def.label} · ${def.points} pts · weight ${def.weight}`;
      }
    }
  }
  if (carry !== carryText) { carryText = carry; ui.carry.textContent = carry; ui.carry.hidden = !carry; }
  if (prompt !== promptText) { promptText = prompt; ui.prompt.innerHTML = prompt; ui.prompt.hidden = !prompt; }
}

function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  ui.toasts.append(el);
  while (ui.toasts.children.length > 4) ui.toasts.firstChild.remove();
  setTimeout(() => el.remove(), 3000);
}

// Debug handle for the console / automated tests.
window.__heist = { net, prediction, remotes, local, input, scene, camera, loot };
