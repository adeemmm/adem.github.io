// End-of-match Victory/Defeat banner. Pure DOM: reads the replicated room
// state and the local player's role, renders the result and match stats.
import { ROLE_TOY, ROLE_GUARD, TEAM_TOYS, STATUS_JAILED } from "./shared/constants.js";

const REASONS = {
  score: "The toys hit the score target and got away with the loot.",
  jailed: "Every toy is behind bars.",
  time: "Time ran out before the toys reached the target.",
};

export function formatTime(seconds) {
  const s = Math.max(0, seconds | 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Best player by `key` among those matching `role`, or null if nobody scored. */
function best(state, role, key) {
  let top = null;
  state.players.forEach((p) => {
    if (p.role === role && p[key] > 0 && (!top || p[key] > top[key])) top = p;
  });
  return top;
}

export class EndBanner {
  constructor(root) {
    this.root = root;
    this.title = root.querySelector("#end-title");
    this.reason = root.querySelector("#end-reason");
    this.stats = root.querySelector("#end-stats");
    this.again = root.querySelector("#again");
    this.wait = root.querySelector("#end-wait");
  }

  show(state, me) {
    const myTeamWon = (state.winner === TEAM_TOYS) === (me.role === ROLE_TOY);
    this.root.className = `overlay ${myTeamWon ? "victory" : "defeat"}`;
    this.title.textContent = myTeamWon ? "VICTORY" : "DEFEAT";
    this.reason.textContent =
      `${state.winner === TEAM_TOYS ? "Toys" : "Guards"} win. ${REASONS[state.reason] || ""}`;

    let toys = 0, jailed = 0, arrests = 0, rescued = 0;
    state.players.forEach((p) => {
      arrests += p.arrests;
      rescued += p.rescues;
      if (p.role !== ROLE_TOY) return;
      toys++;
      if (p.status === STATUS_JAILED) jailed++;
    });
    const topToy = best(state, ROLE_TOY, "score");
    const topGuard = best(state, ROLE_GUARD, "arrests");
    const topHero = best(state, ROLE_TOY, "rescues");

    const rows = [
      ["Team score", `${state.score} / ${state.targetScore}`],
      ["Time left", formatTime(state.timeLeft)],
      ["Toys in jail", `${jailed} / ${toys}`],
      ["Arrests made", arrests],
      ["Toys rescued", rescued],
      ["Top looter", topToy ? `${topToy.name} (${topToy.score} pts)` : "—"],
      ["Top guard", topGuard ? `${topGuard.name} (${topGuard.arrests} arrests)` : "—"],
      ["Jailbreak hero", topHero ? `${topHero.name} (${topHero.rescues} freed)` : "—"],
      ["You", me.role === ROLE_TOY ? `${me.score} pts · ${me.rescues} freed` : `${me.arrests} arrests`],
    ];
    this.stats.replaceChildren();
    for (const [k, v] of rows) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = k;
      dd.textContent = v;
      this.stats.append(dt, dd);
    }

    this.again.hidden = !me.host;
    this.wait.hidden = !!me.host;
    this.root.hidden = false;
  }

  hide() { this.root.hidden = true; }
}
