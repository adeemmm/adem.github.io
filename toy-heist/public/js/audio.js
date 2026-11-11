// Zero-dependency procedural sound engine built on the WebAudio API.
// Every effect is synthesised from oscillators and filtered noise - there are
// no audio files to load.
//
//   audio.unlock()                  call from a user gesture (browser autoplay rules)
//   audio.play("pickup", position)  positional: pans and fades with distance
//   audio.play("victory")           no position: plays "in the head" (UI / alerts)
//   audio.setListener(camera)       once per frame
//
// Each SOUNDS entry is a pure function (ctx, out, t) that schedules nodes
// starting at time t into the node `out`, and returns its duration in seconds.
// That keeps them usable with an OfflineAudioContext for testing.

const STORAGE_KEY = "heist-muted";

// ---------------------------------------------------------------- helpers --

/** One enveloped oscillator note. `freq` may be a number or [[time, freq], ...] glide points. */
function tone(ctx, out, t, { type = "sine", freq, dur, gain = 0.3, attack = 0.005, filter = 0 }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  if (Array.isArray(freq)) {
    osc.frequency.setValueAtTime(freq[0][1], t + freq[0][0]);
    for (let i = 1; i < freq.length; i++) osc.frequency.exponentialRampToValueAtTime(freq[i][1], t + freq[i][0]);
  } else {
    osc.frequency.setValueAtTime(freq, t);
  }
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    osc.connect(lp);
    node = lp;
  }
  node.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const noiseBuffers = new WeakMap();   // one second of white noise per context

function noise(ctx, out, t, { dur, gain = 0.3, type = "lowpass", freq = 800, q = 0.7 }) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Play a sequence of [offsetSeconds, frequency] notes with one voice setting. */
function melody(ctx, out, t, notes, voice) {
  for (const [at, freq] of notes) tone(ctx, out, t + at, { ...voice, freq });
}

// ----------------------------------------------------------------- sounds --

export const SOUNDS = {
  // High-pitched two-note chime: loot grabbed.
  pickup(ctx, out, t) {
    tone(ctx, out, t, { type: "triangle", freq: 1318.5, dur: 0.16, gain: 0.28 });
    tone(ctx, out, t + 0.07, { type: "triangle", freq: 1975.5, dur: 0.3, gain: 0.3 });
    tone(ctx, out, t + 0.07, { type: "sine", freq: 3951, dur: 0.18, gain: 0.08 });
    return 0.4;
  },

  // Heavy thud: loot dropped or tipped into a chute.
  thud(ctx, out, t) {
    tone(ctx, out, t, { type: "sine", freq: [[0, 140], [0.18, 42]], dur: 0.32, gain: 0.7, attack: 0.003 });
    noise(ctx, out, t, { dur: 0.12, gain: 0.35, freq: 320 });
    return 0.35;
  },

  // Deposit: the thud plus a bright "ka-ching".
  deposit(ctx, out, t) {
    SOUNDS.thud(ctx, out, t);
    melody(ctx, out, t + 0.1, [[0, 1568], [0.08, 2093], [0.16, 2637]], { type: "triangle", dur: 0.22, gain: 0.2 });
    return 0.5;
  },

  // Police siren: two-tone wail, the jailbreak alert.
  siren(ctx, out, t) {
    const dur = 2.4;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    for (let i = 0; i <= 6; i++) {   // sweep 620 Hz <-> 1180 Hz, three full wails
      const f = i % 2 === 0 ? 620 : 1180;
      if (i === 0) osc.frequency.setValueAtTime(f, t);
      else osc.frequency.linearRampToValueAtTime(f, t + (dur / 6) * i);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    amp.gain.setValueAtTime(0.22, t + dur - 0.3);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(amp).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    return dur;
  },

  // Detection beep: two sharp blips when a flashlight finds a toy.
  beep(ctx, out, t) {
    tone(ctx, out, t, { type: "square", freq: 1760, dur: 0.07, gain: 0.14, filter: 5000 });
    tone(ctx, out, t + 0.11, { type: "square", freq: 2217, dur: 0.09, gain: 0.14, filter: 5000 });
    return 0.22;
  },

  // Arrest: handcuff click and a falling buzz.
  arrest(ctx, out, t) {
    noise(ctx, out, t, { dur: 0.05, gain: 0.4, type: "highpass", freq: 2500 });
    tone(ctx, out, t + 0.04, { type: "sawtooth", freq: [[0, 520], [0.3, 130]], dur: 0.34, gain: 0.25, filter: 1800 });
    return 0.4;
  },

  // Banana slip: comedy slide whistle.
  slip(ctx, out, t) {
    tone(ctx, out, t, { type: "sine", freq: [[0, 500], [0.12, 1500], [0.4, 260]], dur: 0.45, gain: 0.3 });
    return 0.45;
  },

  // Chaos vote opening: rising attention chirps.
  vote(ctx, out, t) {
    melody(ctx, out, t, [[0, 784], [0.12, 988], [0.24, 1175], [0.36, 1568]], { type: "square", dur: 0.14, gain: 0.12, filter: 4000 });
    return 0.55;
  },

  // Chaos event starting: low rumble + falling stab.
  chaos(ctx, out, t) {
    noise(ctx, out, t, { dur: 0.9, gain: 0.3, freq: 240 });
    tone(ctx, out, t, { type: "sawtooth", freq: [[0, 880], [0.6, 110]], dur: 0.8, gain: 0.22, filter: 2200 });
    return 0.9;
  },

  // Victory jingle: rising major arpeggio with a held top note.
  victory(ctx, out, t) {
    const voice = { type: "triangle", dur: 0.3, gain: 0.26 };
    melody(ctx, out, t, [[0, 523.25], [0.14, 659.25], [0.28, 783.99], [0.42, 1046.5]], voice);
    melody(ctx, out, t + 0.6, [[0, 783.99], [0, 1046.5], [0, 1318.5]], { ...voice, dur: 1.0, gain: 0.2 });
    return 1.7;
  },

  // Defeat jingle: slow falling minor line.
  defeat(ctx, out, t) {
    const voice = { type: "sawtooth", dur: 0.5, gain: 0.2, filter: 1400 };
    melody(ctx, out, t, [[0, 392], [0.32, 349.23], [0.64, 311.13]], voice);
    tone(ctx, out, t + 0.96, { ...voice, freq: [[0, 261.63], [1.0, 196]], dur: 1.2 });
    return 2.2;
  },

  // Footsteps: short filtered-noise taps (toys are light, guards are heavy boots).
  stepToy(ctx, out, t) {
    noise(ctx, out, t, { dur: 0.06, gain: 1.4, type: "bandpass", freq: 900 + Math.random() * 300, q: 1.2 });
    return 0.07;
  },
  stepGuard(ctx, out, t) {
    noise(ctx, out, t, { dur: 0.1, gain: 0.45, freq: 260 + Math.random() * 60 });
    tone(ctx, out, t, { type: "sine", freq: [[0, 95], [0.08, 55]], dur: 0.1, gain: 0.3, attack: 0.003 });
    return 0.11;
  },
};

// Distance behaviour per sound. `ref` = distance (m) at which it starts fading.
const SPATIAL = { default: { ref: 5, rolloff: 1.4 }, siren: { ref: 22, rolloff: 1 }, stepToy: { ref: 3, rolloff: 2 }, stepGuard: { ref: 4, rolloff: 1.8 } };
const MAX_DISTANCE = 70;
const MAX_VOICES = 24;

// ----------------------------------------------------------------- engine --

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = 0;
    this.played = {};       // name -> count, for debugging / tests
    this.listener = { x: 0, y: 0, z: 0 };
    this.muted = false;
    try { this.muted = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* storage unavailable */ }
  }

  /** Create/resume the AudioContext. Must be called from a click or key handler. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;   // no WebAudio: the game simply stays silent
      this.ctx = new Ctx();
      // Gentle limiter so stacked effects never clip.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 8;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0"); } catch { /* storage unavailable */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  /** Move the "ears" to the camera. Call once per frame. */
  setListener(camera) {
    const p = camera.position;
    this.listener.x = p.x; this.listener.y = p.y; this.listener.z = p.z;
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const e = camera.matrixWorld.elements;   // columns: right, up, back
    const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
      l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;
    } else {   // older Safari / Firefox
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /**
   * Play a sound. With `position` ({x, y, z} in world space) it is spatialised:
   * panned towards the source and attenuated with distance. `volume` scales it.
   */
  play(name, position = null, volume = 1) {
    const sound = SOUNDS[name];
    if (!sound || !this.ctx || this.ctx.state !== "running" || this.muted) return;
    if (this.voices >= MAX_VOICES) return;

    const ctx = this.ctx;
    let out = this.master;
    let panner = null;
    if (position) {
      const dx = position.x - this.listener.x, dy = position.y - this.listener.y, dz = position.z - this.listener.z;
      if (dx * dx + dy * dy + dz * dz > MAX_DISTANCE * MAX_DISTANCE) return;   // inaudible: skip the work
      const spatial = SPATIAL[name] || SPATIAL.default;
      panner = ctx.createPanner();
      panner.panningModel = "equalpower";
      panner.distanceModel = "inverse";
      panner.refDistance = spatial.ref;
      panner.rolloffFactor = spatial.rolloff;
      panner.maxDistance = MAX_DISTANCE;
      if (panner.positionX) {
        panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
      } else {
        panner.setPosition(position.x, position.y, position.z);
      }
      panner.connect(this.master);
      out = panner;
    }
    if (volume !== 1) {
      const trim = ctx.createGain();
      trim.gain.value = volume;
      trim.connect(out);
      out = trim;
    }

    const duration = sound(ctx, out, ctx.currentTime + 0.01);
    this.played[name] = (this.played[name] || 0) + 1;
    this.voices++;
    setTimeout(() => {
      this.voices--;
      if (panner) panner.disconnect();
    }, (duration + 0.2) * 1000);
  }
}

/**
 * Positional footsteps for any moving entity. Feed it each drawn avatar's
 * position every frame; it emits a step sound every stride travelled along
 * the ground, so cadence follows speed and distant players fade out naturally.
 */
export class Footsteps {
  constructor(audio) {
    this.audio = audio;
    this.tracks = new Map();   // key -> { x, y, z, travelled }
  }

  /** key: stable id for the entity; pos: {x, y, z}; heavy: guard boots vs toy taps. */
  track(key, pos, heavy) {
    let tr = this.tracks.get(key);
    if (!tr) { tr = { x: pos.x, y: pos.y, z: pos.z, travelled: 0 }; this.tracks.set(key, tr); return; }
    const dx = pos.x - tr.x, dy = pos.y - tr.y, dz = pos.z - tr.z;
    tr.x = pos.x; tr.y = pos.y; tr.z = pos.z;
    const moved = Math.hypot(dx, dz);
    if (moved > 3) { tr.travelled = 0; return; }   // teleport (spawn / jail), not a stride
    if (Math.abs(dy) > 0.03) return;                // airborne: no footfalls
    tr.travelled += moved;
    const stride = heavy ? 1.7 : 1.15;
    if (tr.travelled < stride) return;
    tr.travelled = 0;
    this.audio.play(heavy ? "stepGuard" : "stepToy", pos, 0.6);
  }

  forget(key) { this.tracks.delete(key); }
  clear() { this.tracks.clear(); }
}
