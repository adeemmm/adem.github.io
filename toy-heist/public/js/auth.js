// Main-menu account flow:
//   1. name      enter a username (or "Play as Guest")
//   2. password  new name -> create a password; known name -> log in
//   3. lobby     create / join a lobby
// Talks to /api/auth/* (server/auth.js). On success it holds a session token,
// which game.js passes when joining a room; guests have token === null.
// The token is kept in sessionStorage so a page reload stays signed in.

const TOKEN_KEY = "heist-session";
const NAME_KEY = "heist-name";

async function post(path, body) {
  let res;
  try {
    res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function store(key, value) {
  try {
    const area = key === TOKEN_KEY ? sessionStorage : localStorage;
    if (value === null) area.removeItem(key); else area.setItem(key, value);
  } catch { /* storage unavailable: stay signed in for this page only */ }
}

function load(key) {
  try { return (key === TOKEN_KEY ? sessionStorage : localStorage).getItem(key); } catch { return null; }
}

export class AuthMenu {
  constructor(root) {
    const $ = (id) => root.querySelector(`#${id}`);
    this.steps = { name: $("step-name"), password: $("step-password"), lobby: $("step-lobby") };
    this.el = {
      name: $("name"), continue: $("continue"), guest: $("guest"),
      prompt: $("auth-prompt"), password: $("password"), confirm: $("confirm"), confirmRow: $("confirm-row"),
      submit: $("auth-submit"), back: $("auth-back"), who: $("who"), signout: $("signout"), error: $("error"),
    };
    this.token = null;        // session token; null while signed out or playing as a guest
    this.username = "";       // canonical account name once signed in
    this.pending = null;      // { username, exists } between steps 1 and 2

    this.el.name.value = load(NAME_KEY) || "";
    this.steps.name.addEventListener("submit", (e) => { e.preventDefault(); this.checkName(); });
    this.steps.password.addEventListener("submit", (e) => { e.preventDefault(); this.submitPassword(); });
    this.el.guest.addEventListener("click", () => this.enterLobby(null, ""));
    this.el.back.addEventListener("click", () => this.show("name"));
    this.el.signout.addEventListener("click", () => this.signOut());

    this.show("name");
    this.resume();
  }

  show(step, message = "") {
    for (const [name, node] of Object.entries(this.steps)) node.hidden = name !== step;
    this.el.error.textContent = message;
    if (step === "name") this.el.name.focus();
    if (step === "password") { this.el.password.value = this.el.confirm.value = ""; this.el.password.focus(); }
  }

  /** Re-use a session from before a page reload, if the server still knows it. */
  async resume() {
    const token = load(TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("expired");
      const data = await res.json();
      if (this.steps.name.hidden) return;   // the player has already moved on
      this.enterLobby(token, data.username);
    } catch {
      store(TOKEN_KEY, null);
    }
  }

  /** Step 1 -> 2: ask the server whether this name is new or registered. */
  async checkName() {
    this.el.error.textContent = "";
    this.el.continue.disabled = true;
    try {
      const result = await post("check", { username: this.el.name.value });
      this.pending = result;
      const name = document.createElement("b");
      name.textContent = result.username;
      this.el.prompt.replaceChildren(
        result.exists ? "Welcome back, " : "",
        name,
        result.exists ? ". Enter your password." : " is available. Create a password to save your gold and skins.",
      );
      this.el.confirmRow.hidden = result.exists;
      this.el.password.autocomplete = result.exists ? "current-password" : "new-password";
      this.el.submit.textContent = result.exists ? "Log in" : "Create account";
      this.show("password");
    } catch (err) {
      this.el.error.textContent = err.message;
    } finally {
      this.el.continue.disabled = false;
    }
  }

  /** Step 2 -> 3: register a new account or log in to an existing one. */
  async submitPassword() {
    const { username, exists } = this.pending;
    const password = this.el.password.value;
    this.el.error.textContent = "";
    if (!exists && password !== this.el.confirm.value) {
      this.el.error.textContent = "The two passwords do not match";
      return;
    }
    this.el.submit.disabled = true;
    try {
      const result = await post(exists ? "login" : "register", { username, password });
      store(NAME_KEY, result.username);
      store(TOKEN_KEY, result.token);
      this.enterLobby(result.token, result.username);
    } catch (err) {
      this.el.error.textContent = err.message;
    } finally {
      this.el.submit.disabled = false;
    }
  }

  enterLobby(token, username) {
    this.token = token;
    this.username = username;
    const name = document.createElement("b");
    name.textContent = username;
    if (token) this.el.who.replaceChildren("Signed in as ", name);
    else this.el.who.replaceChildren("Playing as a guest. Progress will not be saved.");
    this.el.signout.textContent = token ? "Sign out" : "Back";
    this.el.password.value = this.el.confirm.value = "";
    this.show("lobby");
  }

  /** Forget the session and return to the name step (optionally explaining why). */
  signOut(message = "") {
    this.token = null;
    this.username = "";
    store(TOKEN_KEY, null);
    this.show("name", message);
  }
}
