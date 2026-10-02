// Drum kits made in the browser with Web Audio: no samples, nothing to
// license, a few kilobytes. Each kit is four voices (kick, snare, hat, perc),
// each a function (ctx, out, time, vel 1..127, gate in seconds) that schedules
// one hit. Two classic machine flavours (808, 909) and two in the spirit of
// Ableton's Konkrete Drums, which is synthesized too: clicky, metallic,
// textured. These are our own recipes, not Ableton's.
//
//   const voices = synthVoices(KITS['909'])(ctx)  // the player's makeVoices shape

const noiseBuffers = new WeakMap();
function noise(ctx) {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, b);
  }
  const s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}

// A gain that jumps to `peak` at t and decays exponentially over `decay` s.
function env(ctx, t, peak, decay, attack = 0.001) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function osc(ctx, type, freq, t) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// A soft clipper, for grit.
function drive(ctx, amount) {
  const w = ctx.createWaveShaper();
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  w.curve = c;
  return w;
}

const play = (src, t, dur) => { src.start(t); src.stop(t + dur + 0.05); };
const lvl = (vel, k = 1) => (vel / 127) * k;

// ---- 808-style: long boomy kick, tonal snare, metallic square-wave hats ----
const k808 = {
  kick(ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const g = env(ctx, t, lvl(vel, 1.1), 0.7);
    o.connect(g).connect(out); play(o, t, 0.75);
  },
  snare(ctx, out, t, vel) {
    for (const f of [180, 330]) {
      const o = osc(ctx, 'triangle', f, t);
      const g = env(ctx, t, lvl(vel, 0.35), 0.12);
      o.connect(g).connect(out); play(o, t, 0.15);
    }
    const n = noise(ctx), g = env(ctx, t, lvl(vel, 0.5), 0.16);
    n.connect(filter(ctx, 'bandpass', 1800, 0.8)).connect(g).connect(out); play(n, t, 0.2);
  },
  hat(ctx, out, t, vel) {
    const g = env(ctx, t, lvl(vel, 0.28), 0.05);
    const bp = filter(ctx, 'bandpass', 10000, 1), hp = filter(ctx, 'highpass', 7000);
    bp.connect(hp).connect(g).connect(out);
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const o = osc(ctx, 'square', 40 * r, t); o.connect(bp); play(o, t, 0.08); }
  },
  perc(ctx, out, t, vel) { // clap: three quick bursts and a tail
    for (const [dt, dec] of [[0, 0.012], [0.011, 0.012], [0.022, 0.2]]) {
      const n = noise(ctx), g = env(ctx, t + dt, lvl(vel, 0.55), dec);
      n.connect(filter(ctx, 'bandpass', 1200, 1.2)).connect(g).connect(out); play(n, t + dt, dec + 0.02);
    }
  },
};

// ---- 909-style: punchy kick with a click, brighter noisier snare ----
const k909 = {
  kick(ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 190, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.05);
    const g = env(ctx, t, lvl(vel, 1.1), 0.34);
    o.connect(drive(ctx, 1.6)).connect(g).connect(out); play(o, t, 0.4);
    const n = noise(ctx), c = env(ctx, t, lvl(vel, 0.35), 0.006);
    n.connect(filter(ctx, 'highpass', 1500)).connect(c).connect(out); play(n, t, 0.01);
  },
  snare(ctx, out, t, vel) {
    const o = osc(ctx, 'triangle', 190, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.05);
    const g = env(ctx, t, lvl(vel, 0.45), 0.08);
    o.connect(g).connect(out); play(o, t, 0.1);
    const n = noise(ctx), gn = env(ctx, t, lvl(vel, 0.6), 0.22);
    n.connect(filter(ctx, 'highpass', 1000)).connect(gn).connect(out); play(n, t, 0.25);
  },
  hat(ctx, out, t, vel) {
    const n = noise(ctx), g = env(ctx, t, lvl(vel, 0.3), 0.06);
    n.connect(filter(ctx, 'highpass', 8000)).connect(g).connect(out); play(n, t, 0.08);
  },
  perc(ctx, out, t, vel) { // rim shot
    const o = osc(ctx, 'triangle', 1700, t), g = env(ctx, t, lvl(vel, 0.4), 0.03);
    o.connect(filter(ctx, 'bandpass', 1700, 4)).connect(g).connect(out); play(o, t, 0.05);
  },
};

// ---- Concrete, click: short and dry, FM metal, a wooden perc ----
const kClick = {
  kick(ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 95, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.04);
    const g = env(ctx, t, lvl(vel, 1.1), 0.12);
    o.connect(g).connect(out); play(o, t, 0.15);
    const n = noise(ctx), c = env(ctx, t, lvl(vel, 0.6), 0.002);
    n.connect(filter(ctx, 'bandpass', 3500, 2)).connect(c).connect(out); play(n, t, 0.005);
  },
  snare(ctx, out, t, vel) { // FM: a bright metal hit
    const car = osc(ctx, 'sine', 420, t), mod = osc(ctx, 'sine', 420 * 1.41, t);
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(900, t); idx.gain.exponentialRampToValueAtTime(20, t + 0.08);
    mod.connect(idx).connect(car.frequency);
    const g = env(ctx, t, lvl(vel, 0.4), 0.09);
    car.connect(g).connect(out); play(car, t, 0.12); play(mod, t, 0.12);
    const n = noise(ctx), gn = env(ctx, t, lvl(vel, 0.25), 0.04);
    n.connect(filter(ctx, 'bandpass', 3000, 1.5)).connect(gn).connect(out); play(n, t, 0.06);
  },
  hat(ctx, out, t, vel) { // ring-modulated tick
    const a = osc(ctx, 'square', 3130, t), b = osc(ctx, 'square', 4470, t);
    const ring = ctx.createGain(); ring.gain.value = 0;
    b.connect(ring.gain); a.connect(ring);
    const g = env(ctx, t, lvl(vel, 0.25), 0.025);
    ring.connect(filter(ctx, 'highpass', 6000)).connect(g).connect(out); play(a, t, 0.04); play(b, t, 0.04);
  },
  perc(ctx, out, t, vel) { // wood block
    for (const [f, k] of [[820, 0.4], [1640, 0.2]]) {
      const o = osc(ctx, 'sine', f, t), g = env(ctx, t, lvl(vel, k), 0.05);
      o.connect(g).connect(out); play(o, t, 0.07);
    }
  },
};

// ---- Concrete, dust: low and grainy, resonant noise, a swept perc ----
const kDust = {
  kick(ctx, out, t, vel) {
    const o = osc(ctx, 'sine', 70, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const g = env(ctx, t, lvl(vel, 1.0), 0.32);
    o.connect(drive(ctx, 3)).connect(g).connect(out); play(o, t, 0.36);
    const n = noise(ctx), th = env(ctx, t, lvl(vel, 0.3), 0.03);
    n.connect(filter(ctx, 'lowpass', 400)).connect(th).connect(out); play(n, t, 0.05);
  },
  snare(ctx, out, t, vel) {
    const n = noise(ctx), g = env(ctx, t, lvl(vel, 0.7), 0.18);
    n.connect(filter(ctx, 'bandpass', 900, 5)).connect(drive(ctx, 2.5)).connect(g).connect(out); play(n, t, 0.22);
    for (let i = 0; i < 4; i++) { // crackle: a few tiny clicks after the hit
      const dt = 0.01 + Math.random() * 0.08, c = noise(ctx), gc = env(ctx, t + dt, lvl(vel, 0.25), 0.003);
      c.connect(filter(ctx, 'highpass', 4000)).connect(gc).connect(out); play(c, t + dt, 0.006);
    }
  },
  hat(ctx, out, t, vel) {
    const n = noise(ctx), g = env(ctx, t, lvl(vel, 0.28), 0.04);
    n.connect(filter(ctx, 'highpass', 6000)).connect(drive(ctx, 6)).connect(g).connect(out); play(n, t, 0.06);
  },
  perc(ctx, out, t, vel) { // resonant noise, swept down
    const n = noise(ctx), f = filter(ctx, 'bandpass', 2200, 9), g = env(ctx, t, lvl(vel, 0.8), 0.12);
    f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    n.connect(f).connect(g).connect(out); play(n, t, 0.15);
  },
};

export const KITS = {
  '808-style': k808,
  '909-style': k909,
  'Concrete: click': kClick,
  'Concrete: dust': kDust,
};

/** The player's makeVoices for a kit: the four voices, always ready, and the
    output's peak (0 is silence) for the walk scripts. */
export function synthVoices(kit) {
  return (ctx) => {
    const out = ctx.createGain();
    out.gain.value = 0.8;
    const meter = ctx.createAnalyser();
    meter.fftSize = 256;
    out.connect(meter);
    out.connect(ctx.destination);
    const buf = new Float32Array(meter.fftSize);
    const voice = (name) => (time, vel, gate) => kit[name](ctx, out, Math.max(time, ctx.currentTime), vel, gate);
    return {
      kick: voice('kick'), snare: voice('snare'), hat: voice('hat'), perc: voice('perc'),
      ready: true,
      peak() { meter.getFloatTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x)); return m; },
    };
  };
}
