// Cosmetics catalogue and match reward rules, shared by the server (prices,
// validation, payouts) and the client (shop UI, model variants).

import { ROLE_TOY, ROLE_GUARD } from "./constants.js";

export const DEFAULT_TOY_SKIN = "default";
export const DEFAULT_GUARD_SKIN = "guard_default";

// `role` is the role the skin changes: a player equips one toy skin and one
// guard skin, and whichever matches their role in a match is shown.
export const SKINS = {
  default:       { name: "Default Capsule", role: ROLE_TOY,   price: 0,   blurb: "The classic wind-up runner." },
  party_hat:     { name: "Party Hat Toy",   role: ROLE_TOY,   price: 75,  blurb: "A striped hat with a pom-pom. Stealth optional." },
  robot:         { name: "Robot Toy",       role: ROLE_TOY,   price: 250, blurb: "Boxy chassis, glowing visor, wobbly antenna." },
  royal:         { name: "Royal Toy",       role: ROLE_TOY,   price: 600, blurb: "Solid gold, with a crown to match." },
  guard_default: { name: "Night Guard",     role: ROLE_GUARD, price: 0,   blurb: "Standard-issue navy uniform." },
  gold_guard:    { name: "Gold Guard",      role: ROLE_GUARD, price: 400, blurb: "Head of security. Dressed like the vault." },
};

export const STARTER_SKINS = [DEFAULT_TOY_SKIN, DEFAULT_GUARD_SKIN];

/** A skin id that exists and belongs to `role`, falling back to that role's default. */
export function resolveSkin(role, skinId) {
  const skin = SKINS[skinId];
  if (skin && skin.role === role) return skinId;
  return role === ROLE_GUARD ? DEFAULT_GUARD_SKIN : DEFAULT_TOY_SKIN;
}

// Gold paid out when a match ends.
export const REWARDS = {
  participation: 25,   // everyone who finishes a match
  win: 50,             // members of the winning team
  perPoint: 1,         // toys: per point of loot personally extracted
  perRescue: 15,       // toys: per team-mate freed from jail
  perArrest: 40,       // guards: per arrest
};

/** Gold earned by one player for a finished match. */
export function computeGold({ role, score = 0, arrests = 0, rescues = 0, won = false }) {
  let gold = REWARDS.participation + (won ? REWARDS.win : 0);
  if (role === ROLE_GUARD) gold += arrests * REWARDS.perArrest;
  else gold += score * REWARDS.perPoint + rescues * REWARDS.perRescue;
  return gold;
}
