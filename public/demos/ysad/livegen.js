// The demo's patterns, made live: YSAD's own generator (crates/ysad-wasm,
// built into demo/ysad.wasm by m4l/tools/build-wasm.sh), the one the plugin
// and the Max device run, compiled. Every dial shapes the beat exactly as in
// the product. patterns.json only carries what the page shows around it (the
// style names, each style's meter and own swing, the Swing menu's amounts).
//
//   const gen = await loadGenerator('ysad.wasm', data);
//   gen.pattern('Half-time', { kick, snare, hats, perc, intensity, swingIdx, take })
//
// The result is the player's pattern: per voice (kick, snare, hat, perc) the
// arrays prob, vel (MIDI 1..127), gate and nudge (steps), with the voice
// defaults filled in, plus `swing` (the style's own swing plus the menu's,
// capped at 0.90, as the device plays it) and `meter`.

export const VOICES = ['kick', 'snare', 'hat', 'perc'];
const SWING_MAX = 0.9;
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// One voice of the generator's pattern (m4l/src/pattern.js's shape) in the
// player's shape. `null` per step means the voice default.
export function voiceOut(v) {
  const out = { prob: [], vel: [], gate: [], nudge: [] };
  for (let s = 0; s < v.nSteps; s++) {
    const hit = v.prob[s] > 0;
    out.prob.push(r4(v.prob[s]));
    out.vel.push(hit ? r4(v.vel[s] ?? v.baseVel) : 0);
    out.gate.push(hit ? r4(v.gate[s] ?? v.gateLength) : 0);
    out.nudge.push(hit ? r4(v.nudge[s] ?? 0) : 0);
  }
  return out;
}

/** The player's pattern from the generator's, a style's meter and the swing. */
export function demoPattern(p, meter, swing) {
  const out = {};
  VOICES.forEach((name, i) => { out[name] = voiceOut(p.voices[i]); });
  out.swing = r4(Math.min(SWING_MAX, Math.max(0, swing)));
  out.meter = meter;
  return out;
}

// JSON in and out of the module (see crates/ysad-wasm).
function caller(instance) {
  const ex = instance.exports;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return (input) => {
    const bytes = enc.encode(JSON.stringify(input));
    const ptr = ex.alloc(bytes.length);
    new Uint8Array(ex.memory.buffer, ptr, bytes.length).set(bytes);
    ex.regenerate(ptr, bytes.length);
    const res = JSON.parse(dec.decode(new Uint8Array(ex.memory.buffer, ex.out_ptr(), ex.out_len())));
    if (res.error) throw new Error(`ysad generator: ${res.error}`);
    return res;
  };
}

/** The generator around an instantiated module, for the page's data. */
export function generatorFrom(instance, data) {
  const call = caller(instance);
  return {
    pattern(style, c) {
      const preset = data.presets.indexOf(style);
      const info = data.patterns[style];
      const p = call({
        preset: preset < 0 ? 0 : preset,
        part: [c.kick, c.snare, c.hats, c.perc],
        intensity: c.intensity,
        groove: c.swingIdx | 0,
        take: c.take | 0,
      });
      return demoPattern(p, info.meter, info.swing + (data.grooveAmounts[c.swingIdx | 0] || 0));
    },
  };
}

/** Fetches and compiles the module, then wraps it. */
export async function loadGenerator(url, data) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {});
  return generatorFrom(instance, data);
}
