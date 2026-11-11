// Server tuning that operators may override without touching code, e.g.
//   HEIST_MATCH_SECONDS=120 HEIST_TARGET_SCORE=200 npm start
//   TWITCH_CHANNEL=mychannel npm start          (enables Chaos Mode)
// (Read from the environment only - never from client-supplied room options.)
import {
  MATCH_SECONDS, TARGET_SCORE, CHAOS_CALM_SECONDS, CHAOS_VOTE_SECONDS, CHAOS_EVENT_SECONDS,
} from "../public/js/shared/constants.js";

function positiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
}

// Twitch logins are 3-25 chars of [a-z0-9_]; accept "#Name" or "Name".
function twitchChannel(value) {
  const name = String(value || "").trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(name) ? name : "";
}

const channel = twitchChannel(process.env.TWITCH_CHANNEL);

export const config = {
  matchSeconds: positiveInt(process.env.HEIST_MATCH_SECONDS, MATCH_SECONDS, 3600),
  targetScore: positiveInt(process.env.HEIST_TARGET_SCORE, TARGET_SCORE, 60000),

  // Chaos Mode runs when a Twitch channel is configured. HEIST_CHAOS=1 turns it
  // on without Twitch (every vote ends 0-0-0, so a random event is picked).
  twitchChannel: channel,
  twitchIrcUrl: process.env.TWITCH_IRC_URL || "wss://irc-ws.chat.twitch.tv:443",
  chaosEnabled: channel !== "" || process.env.HEIST_CHAOS === "1",
  chaosCalmSeconds: positiveInt(process.env.HEIST_CHAOS_CALM_SECONDS, CHAOS_CALM_SECONDS, 240),
  chaosVoteSeconds: positiveInt(process.env.HEIST_CHAOS_VOTE_SECONDS, CHAOS_VOTE_SECONDS, 240),
  chaosEventSeconds: positiveInt(process.env.HEIST_CHAOS_EVENT_SECONDS, CHAOS_EVENT_SECONDS, 240),
};
