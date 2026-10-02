// The demo's pattern player: plays YSAD's patterns (made live by the generator
// in WebAssembly, livegen.js) through the drum voices (voices.js) with the Max
// device's swing and firing rules. Timing rules mirror m4l/src/engine.js;
// nothing here generates patterns.

// Every pattern plays in its own meter: a step is always a 16th at BPM (a
// quarter-note beat), so a bar is meter.steps 16ths long (7/8: 14 steps, 3.5
// beats) and swing delays the meter's swing steps (the second 8th of each group).
// 120, Live's default tempo, which the device follows: at 100 the Hats knob's
// changes to the hat ring were too slow to hear.
export const BPM = 120;
export const VOICES = ['kick', 'snare', 'hat', 'perc'];

// The meter of a pattern without one (4/4), in precompute.js's meterInfo shape.
export const FOUR_FOUR = Object.freeze({
  label: '4/4', groups: [1, 1, 1, 1], steps: 16, starts: [0, 4, 8, 12],
  swing: [2, 6, 10, 14], barBeats: 4, info: '4/4',
});

const LOOKAHEAD_MS = 25;   // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.1; // seconds of audio scheduled ahead of the clock

export function meterOf(p) {
  return (p && p.meter) || FOUR_FOUR;
}

// Steps in one bar of pattern `p`.
export function barSteps(p) {
  return meterOf(p).steps;
}

// m4l/src/engine.js swingOffsetBeats with a meter: the meter's swing steps are
// late by swing * 0.25 beats; every other step stays put. Returned in seconds,
// with a beat being 4 steps of `stepDur`.
export function swingOffset(step, swing, stepDur, meter = FOUR_FOUR) {
  if (!(swing > 0)) return 0;
  const n = meter.steps;
  const s = ((step % n) + n) % n;
  return meter.swing.includes(s) ? swing * 0.25 * (stepDur * 4) : 0;
}

// The bar clock: hands out steps one at a time with their start times. The
// pattern is read (getPattern) at every bar start and fixes that bar's length,
// so a style change lands on the next bar line even when the step count changes.
export function createBarClock(getPattern, stepDur) {
  let step = 0;
  let time = 0;
  let pattern = null;
  let steps = FOUR_FOUR.steps;
  let bar = null;  // { start, dur } of the latest bar begun
  let prev = null; // and of the one before it
  return {
    reset(t) {
      step = 0;
      time = t;
      pattern = null;
      bar = null;
      prev = null;
    },
    get time() { return time; },
    // The next step: { step, time, pattern, barStart }; step 0 opens a bar.
    next() {
      if (step === 0) {
        pattern = getPattern();
        steps = barSteps(pattern);
        prev = bar;
        bar = { start: time, dur: steps * stepDur };
      }
      const out = { step, time, pattern, barStart: bar.start };
      time += stepDur;
      step = (step + 1) % steps;
      return out;
    },
    // Where time `t` sits, 0..1 around the bar playing then, or null before
    // the first bar. The latest bar can be scheduled just ahead of the clock;
    // until it starts, the one before it is the one playing.
    position(t) {
      const b = prev && t < bar.start ? prev : bar;
      if (!b) return null;
      const x = (t - b.start) / b.dur;
      return Math.min(1, Math.max(0, x)) % 1;
    },
  };
}

// Stochastic firing, as in engine.js: a hit sounds when rng() < prob.
export function fires(prob, rng) {
  return prob > 0 && rng() < prob;
}

// The "kick" step: the knob has to go down to `low` or below, then come back
// up to `back` or above. Returns true once, on the push that completes it.
export function kickGesture({ low = 0.2, back = 0.45 } = {}) {
  let wentLow = false;
  let done = false;
  return {
    push(v) {
      if (done) return false;
      if (v <= low) wentLow = true;
      else if (wentLow && v >= back) {
        done = true;
        return true;
      }
      return false;
    },
  };
}

// The "hats" step: Hats starts at 0 (no hats), and the knob has to come up to
// `high` or above, where the hat ring is plainly there. Returns true once.
export function hatsGesture({ high = 0.5 } = {}) {
  let done = false;
  return {
    push(v) {
      if (done || v < high) return false;
      done = true;
      return true;
    },
  };
}


// mulberry32, copied from m4l/src/rng.js (makeRng) so the demo has no
// CommonJS dependency in the browser.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// createPlayer({ getPattern, makeVoices, seed? })
//   getPattern(): the Pattern to play; read once at every bar start, so a knob
//     move lands on the next bar.
//   makeVoices(ctx): { kick(time, vel, gate), snare(...), hat(...), perc(...),
//     ready? }: with `ready` false the first bar waits until it turns true.
// start() must be called from inside a user gesture: it creates or resumes the
// AudioContext there, so the first press always sounds.
export function createPlayer({ getPattern, makeVoices, seed = 0x79736164 }) {
  const stepDur = 60 / BPM / 4;
  const rng = mulberry32(seed);
  const clock = createBarClock(getPattern, stepDur);
  let ctx = null;
  let voices = null;
  let timer = null;
  let bars = 0;
  const listeners = [];

  function scheduleStep({ step: s, time, pattern: p }) {
    if (s === 0) bars++;
    if (!p) return;
    const meter = meterOf(p);
    for (const name of VOICES) {
      const v = p[name];
      if (!v || !fires(v.prob[s], rng)) continue;
      let t = time + swingOffset(s, p.swing, stepDur, meter) + (v.nudge[s] || 0) * stepDur;
      if (t < ctx.currentTime) t = ctx.currentTime;
      voices[name](t, v.vel[s], v.gate[s] * stepDur);
      for (const fn of listeners) fn(name, s, t, meter.steps);
    }
  }

  // Voices that load (a soundfont) say `ready: false` until they can sound; the
  // first bar starts once they can, so no hit of it is lost.
  let started = false;
  function tick() {
    if (!started) {
      if (voices.ready === false) return;
      clock.reset(ctx.currentTime + 0.05);
      started = true;
    }
    while (clock.time < ctx.currentTime + SCHEDULE_AHEAD) scheduleStep(clock.next());
  }

  return {
    start() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        voices = makeVoices(ctx);
      }
      if (ctx.state !== 'running') ctx.resume();
      if (timer) return;
      started = false;
      tick();
      timer = setInterval(tick, LOOKAHEAD_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    get playing() { return timer !== null; },
    get ctx() { return ctx; },
    get bars() { return bars; },
    // Where the playhead is, 0..1 around the bar playing now (whatever its
    // length), or null while stopped.
    position() {
      if (!timer || !ctx || !started) return null;
      return clock.position(ctx.currentTime);
    },
    get voices() { return voices; },
    // fn(voice, step, time, steps): steps is the bar length the hit was played in.
    onHit(fn) { listeners.push(fn); },
    now() { return ctx ? ctx.currentTime : 0; },
  };
}
