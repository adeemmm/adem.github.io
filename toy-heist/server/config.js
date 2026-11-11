// Server tuning that operators may override without touching code, e.g.
//   HEIST_MATCH_SECONDS=120 HEIST_TARGET_SCORE=200 npm start
// (Read from the environment only - never from client-supplied room options.)
import { MATCH_SECONDS, TARGET_SCORE } from "../public/js/shared/constants.js";

function positiveInt(value, fallback, max) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
}

export const config = {
  matchSeconds: positiveInt(process.env.HEIST_MATCH_SECONDS, MATCH_SECONDS, 3600),
  targetScore: positiveInt(process.env.HEIST_TARGET_SCORE, TARGET_SCORE, 60000),
};
