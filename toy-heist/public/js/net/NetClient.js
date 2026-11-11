// Thin wrapper around the Colyseus browser client (loaded as the global
// `Colyseus` from /vendor/colyseus/colyseus.js). Owns the socket; everything
// else talks to the server through this class.
import { MSG_INPUT, MSG_SNAPSHOT, MSG_START, MSG_EVENT, MSG_SHOP, MSG_PROFILE } from "../shared/constants.js";

const ROOM_NAME = "heist";

export class NetClient {
  constructor() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.client = new Colyseus.Client(`${proto}://${location.host}`);
    this.room = null;
    this.onSnapshot = () => {};   // (snapshot) high-frequency transforms
    this.onState = () => {};      // (state) roster / roles / phase changed
    this.onEvent = () => {};      // (event) one-shot gameplay events, e.g. deposits
    this.onProfile = () => {};    // (profile) our private gold / unlocks / stats, or { error }
    this.onDisconnect = () => {}; // (code)
  }

  get sessionId() { return this.room ? this.room.sessionId : null; }

  // `token` is the session token from AuthMenu, or null to play as a guest.
  async createLobby(token) {
    try {
      this.attach(await this.client.create(ROOM_NAME, { token }));
    } catch (err) {
      throw authError(err) || err;
    }
  }

  async joinLobby(code, token) {
    if (!/^\d{4}$/.test(code)) throw new Error("Enter a 4-digit code");
    try {
      this.attach(await this.client.joinById(code, { token }));
    } catch (err) {
      throw authError(err) || new Error(/full|locked/i.test(err.message) ? "That lobby is full" : `No lobby with code ${code}`);
    }
  }

  attach(room) {
    this.room = room;
    room.onMessage(MSG_SNAPSHOT, (snap) => this.onSnapshot(snap));
    room.onMessage(MSG_EVENT, (ev) => this.onEvent(ev));
    room.onMessage(MSG_PROFILE, (profile) => this.onProfile(profile));
    room.onStateChange((state) => this.onState(state));
    room.onLeave((code) => { this.room = null; this.onDisconnect(code); });
    room.onError((code, message) => console.error("room error", code, message));
  }

  sendInput(input) { if (this.room) this.room.send(MSG_INPUT, input); }
  sendShop(action, skinId) { if (this.room) this.room.send(MSG_SHOP, { a: action, id: skinId }); }
  requestStart() { if (this.room) this.room.send(MSG_START); }
}

// The room rejects joins with 401 (session expired) or 409 (account already in
// the lobby); those messages are written for the player, so pass them through.
function authError(err) {
  if (err && (err.code === 401 || err.code === 409)) {
    const error = new Error(err.message);
    error.code = err.code;
    return error;
  }
  return null;
}
