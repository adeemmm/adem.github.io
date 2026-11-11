// Load-test helper: fills a lobby with wandering bots.
//   node tools/bots.js <code> [count=31] [url=ws://localhost:2567]
import { Client } from "colyseus.js";
import { TICK_MS, MSG_INPUT, MSG_SNAPSHOT } from "../public/js/shared/constants.js";

const [code, countArg, url = "ws://localhost:2567"] = process.argv.slice(2);
if (!code) { console.error("usage: node tools/bots.js <code> [count] [url]"); process.exit(1); }
const count = Number(countArg) || 31;

for (let i = 0; i < count; i++) {
  try {
    const room = await new Client(url).joinById(code, { name: `Bot${i + 1}` });
    let seq = 0, yaw = Math.random() * Math.PI * 2, jump = false;
    room.onMessage(MSG_SNAPSHOT, () => {});
    const timer = setInterval(() => {
      if (Math.random() < 0.02) yaw += (Math.random() - 0.5) * 2.5;
      jump = Math.random() < 0.03;
      room.send(MSG_INPUT, { s: ++seq, f: 1, r: 0, y: yaw, j: jump, e: Math.random() < 0.02 });   // occasionally grab/drop loot
    }, TICK_MS);
    room.onLeave(() => clearInterval(timer));
  } catch (err) {
    console.error(`bot ${i + 1} failed to join: ${err.message}`);
    break;
  }
}
console.log(`bots connected to lobby ${code}`);
