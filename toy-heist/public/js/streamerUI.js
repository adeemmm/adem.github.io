// Streamer overlay: things the *audience* of a stream needs to read.
//   - The room's 4-digit join code in large type.
//   - Chaos Mode: live "!vote 1|2|3" bars during a vote, the active event and
//     its countdown, and the time until the next vote.
// Pure DOM; driven entirely by replicated room state. Toggle with the O key.
import { CHAOS_OFF, CHAOS_CALM, CHAOS_VOTE, CHAOS_EVENT, CHAOS_EVENTS } from "./shared/constants.js";

const STORAGE_KEY = "heist-streamer-ui";
const EVENT_IDS = Object.keys(CHAOS_EVENTS).map(Number);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class StreamerUI {
  constructor(root) {
    this.root = root;
    this.visible = true;
    try { this.visible = localStorage.getItem(STORAGE_KEY) !== "0"; } catch { /* storage unavailable */ }

    // Join code card
    this.codeCard = el("div", "s-card s-code");
    this.codeCard.append(el("div", "s-label", "JOIN CODE"));
    this.code = el("div", "s-code-digits", "----");
    this.channel = el("div", "s-sub");
    this.codeCard.append(this.code, this.channel);

    // Chaos card
    this.chaosCard = el("div", "s-card s-chaos");
    this.title = el("div", "s-title");
    this.subtitle = el("div", "s-sub");
    this.chaosCard.append(this.title, this.subtitle);
    this.bars = new Map();   // event id -> { row, fill, count }
    for (const id of EVENT_IDS) {
      const row = el("div", "s-bar");
      const fill = el("div", "s-bar-fill");
      const name = el("span", "s-bar-name", `!vote ${id}  ${CHAOS_EVENTS[id].label}`);
      const count = el("span", "s-bar-count", "0");
      row.append(fill, name, count);
      this.chaosCard.append(row);
      this.bars.set(id, { row, fill, count });
    }

    root.append(this.chaosCard, this.codeCard);
    this.applyVisibility();
  }

  toggle() {
    this.visible = !this.visible;
    try { localStorage.setItem(STORAGE_KEY, this.visible ? "1" : "0"); } catch { /* storage unavailable */ }
    this.applyVisibility();
    return this.visible;
  }

  applyVisibility() { this.root.hidden = !this.visible; }

  /** Refresh from replicated state. Call on every state patch. */
  update(state) {
    this.code.textContent = state.code || "----";
    const chaos = state.chaos;
    this.channel.textContent = chaos.channel ? `twitch.tv/${chaos.channel}` : "";
    this.channel.hidden = !chaos.channel;

    const phase = chaos.phase;
    this.chaosCard.hidden = phase === CHAOS_OFF;
    this.chaosCard.dataset.phase = phase;
    if (phase === CHAOS_OFF) return;

    const votes = { 1: chaos.votes1, 2: chaos.votes2, 3: chaos.votes3 };
    const total = votes[1] + votes[2] + votes[3];
    const showBars = phase !== CHAOS_CALM;
    for (const id of EVENT_IDS) {
      const bar = this.bars.get(id);
      bar.row.hidden = !showBars;
      const share = total > 0 ? votes[id] / total : 0;
      bar.fill.style.width = `${Math.round(share * 100)}%`;
      bar.count.textContent = total > 0 ? `${votes[id]} · ${Math.round(share * 100)}%` : "0";
      bar.row.classList.toggle("winner", phase === CHAOS_EVENT && id === chaos.event);
      bar.row.classList.toggle("loser", phase === CHAOS_EVENT && id !== chaos.event);
    }

    if (phase === CHAOS_VOTE) {
      this.title.textContent = `CHAOS VOTE · ${chaos.timeLeft}s`;
      this.subtitle.textContent = chaos.channel ? "Type !vote 1, !vote 2 or !vote 3 in chat" : "No chat connected: a random event will be picked";
    } else if (phase === CHAOS_EVENT) {
      const def = CHAOS_EVENTS[chaos.event];
      this.title.textContent = `${def ? def.label.toUpperCase() : "CHAOS"} · ${chaos.timeLeft}s`;
      this.subtitle.textContent = def ? def.blurb : "";
    } else {
      this.title.textContent = "CHAOS MODE";
      this.subtitle.textContent = `Next vote in ${chaos.timeLeft}s`;
    }
  }
}
