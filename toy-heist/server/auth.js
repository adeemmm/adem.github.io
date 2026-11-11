// Account authentication over HTTP.
//
//   POST /api/auth/check     { username }            -> { username, exists }
//   POST /api/auth/register  { username, password }  -> { username, token }
//   POST /api/auth/login     { username, password }  -> { username, token }
//   GET  /api/auth/me        Authorization: Bearer   -> { username }
//
// A successful register/login returns a random session token. The client
// passes it when joining a room and HeistRoom.onAuth resolves it back to the
// account, so passwords never travel over the game socket. Sessions live in
// memory: restarting the server simply asks everyone to log in again.

import crypto from "node:crypto";
import express from "express";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_ \-]{1,14}[A-Za-z0-9_]$/;   // 3-16 chars
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;   // bcrypt ignores bytes past 72

// Brute-force damping: per client address, at most this many failed logins
// or new registrations per window.
const LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LIMIT_MAX = 10;

/** Canonical username, or "" if it is not acceptable. */
export function cleanUsername(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  return USERNAME_PATTERN.test(name) ? name : "";
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} bytes`;
  return "";
}

export class SessionStore {
  constructor() {
    this.sessions = new Map();   // token -> { username, expires }
  }

  create(username) {
    this.prune();
    const token = crypto.randomBytes(24).toString("base64url");
    this.sessions.set(token, { username, expires: Date.now() + SESSION_TTL_MS });
    return token;
  }

  /** Username for a live token, or null. */
  resolve(token) {
    if (typeof token !== "string") return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expires < Date.now()) { this.sessions.delete(token); return null; }
    return session.username;
  }

  prune() {
    const now = Date.now();
    for (const [token, session] of this.sessions) if (session.expires < now) this.sessions.delete(token);
  }
}

class AttemptLimiter {
  constructor() { this.hits = new Map(); }   // key -> { count, resetAt }

  blocked(key) {
    const entry = this.hits.get(key);
    return !!entry && entry.resetAt > Date.now() && entry.count >= LIMIT_MAX;
  }

  record(key) {
    const now = Date.now();
    if (this.hits.size > 5000) for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) this.hits.set(key, { count: 1, resetAt: now + LIMIT_WINDOW_MS });
    else entry.count++;
  }
}

/** The process-wide session store, shared by the HTTP routes and the game rooms. */
export const sessions = new SessionStore();

export function createAuthRouter(db) {
  const router = express.Router();
  const limiter = new AttemptLimiter();
  router.use(express.json({ limit: "2kb" }));

  const fail = (res, status, error) => res.status(status).json({ error });
  const tooMany = (res) => fail(res, 429, "Too many attempts. Wait a few minutes and try again.");

  router.post("/check", (req, res) => {
    const username = cleanUsername(req.body && req.body.username);
    if (!username) return fail(res, 400, "Names are 3-16 letters, numbers, spaces, - or _");
    const account = db.getAccount(username);
    // A row without a password (created before accounts existed) is unclaimed:
    // whoever logs in first sets its password.
    res.json({ username: account ? account.username : username, exists: !!account && account.hasPassword });
  });

  router.post("/register", async (req, res) => {
    const username = cleanUsername(req.body && req.body.username);
    const password = req.body && req.body.password;
    if (!username) return fail(res, 400, "Names are 3-16 letters, numbers, spaces, - or _");
    const problem = passwordProblem(password);
    if (problem) return fail(res, 400, problem);
    if (limiter.blocked(req.ip)) return tooMany(res);
    limiter.record(req.ip);

    const created = await db.registerPlayer(username, password);
    if (!created) return fail(res, 409, "That name is already taken. Log in instead.");
    res.json({ username: created, token: sessions.create(created) });
  });

  router.post("/login", async (req, res) => {
    const username = cleanUsername(req.body && req.body.username);
    const password = req.body && req.body.password;
    if (!username || typeof password !== "string" || !password) return fail(res, 400, "Enter your name and password");
    if (limiter.blocked(req.ip)) return tooMany(res);

    const verified = await db.verifyPlayer(username, password);
    if (!verified) {
      limiter.record(req.ip);
      return fail(res, 401, "Wrong name or password");
    }
    res.json({ username: verified, token: sessions.create(verified) });
  });

  router.get("/me", (req, res) => {
    const header = req.get("authorization") || "";
    const username = sessions.resolve(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (!username) return fail(res, 401, "Not logged in");
    res.json({ username });
  });

  // Errors from this router (bad JSON, storage failures) answer as JSON, not HTML.
  router.use((err, _req, res, _next) => {
    if (!err.status || err.status >= 500) console.error(`[auth] ${err.message}`);
    fail(res, err.status && err.status < 500 ? 400 : 500, err.status && err.status < 500 ? "Bad request" : "Server error");
  });

  return router;
}
