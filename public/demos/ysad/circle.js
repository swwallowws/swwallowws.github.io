// The circle: one ring per voice (kick inside, hats outside), with the current
// pattern's steps around it (16 in 4/4, 14 in 7/8, 18 in 9/8; a step is always
// a 16th), dot size by probability, a slow playhead hand. Spokes mark the
// meter's group starts, so 4/4 shows four even quarters and 7/8 grouped 2+2+3
// three uneven slices. The meter's swing steps (the second 8th of each group)
// sit late by the swing, so the swing shows as a shape. Colours come from the
// design tokens.
//
// Every ring draws in its drum's colour (the design tokens' --drum-*). The kick
// ring is the lead voice, with the largest dots; the other rings sit at lower
// opacity, smaller outward (hats smallest). While a ring's dial moves, and for
// about a bar after, that ring is emphasised (full opacity) and the rest dim
// further. Hits that
// leave fade out and hits that return fade in. When the meter changes (another
// step count or grouping) the old layout, spokes, ticks and dots, fades out as
// the new one fades in. Under reduced motion everything snaps and only the
// emphasis remains.

import { cssColor } from './vendor/design/tokens.js';
import { meterOf } from './player.js';

const RINGS = ['kick', 'snare', 'perc', 'hat']; // inner to outer
const RING_R = [0.36, 0.53, 0.7, 0.87];
// Per ring: max dot radius (fraction of R), resting opacity, opacity while
// another ring is emphasised.
const STYLE = {
  kick:  { dot: 0.06,  alpha: 1,    dim: 0.4,  color: 'kick' },
  snare: { dot: 0.036, alpha: 0.8,  dim: 0.3,  color: 'snare' },
  perc:  { dot: 0.03,  alpha: 0.75, dim: 0.28, color: 'perc' },
  hat:   { dot: 0.024, alpha: 0.7,  dim: 0.26, color: 'hats' },
};
const EASE_S = 0.25;    // time constant of the settle when a pattern changes
const FADE_S = 0.35;    // time constant of a hit fading out or in
const SWAP_S = 0.25;    // time constant of the cross-fade when the meter changes
const FOCUS_S = 0.5;    // time constant of the emphasis coming and going
const FOCUS_HOLD_MS = 2000; // about a bar at 120 BPM
const GLOW_S = 0.6;     // how long a fired hit's ring fades out

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Dot size 0..1 by probability: a sure hit is full size, a 50% ghost about
// half, an empty step nothing.
function dotSize(prob) {
  return prob > 0 ? 0.3 + 0.7 * prob * prob : 0;
}

// Where a step sits, in steps around the bar: swing pushes the meter's swing
// steps late by swing * 0.25 beats = swing steps (m4l/src/engine.js). The
// generator's tiny humanising nudges are played but not drawn, so every dot
// sits on its step's tick and spoke, as in the plugin.
function stepPos(step, swing, _nudge, meter) {
  return step + (meter.swing.includes(step) ? swing : 0);
}

const sameMeter = (a, b) => a.steps === b.steps && a.starts.join() === b.starts.join();

// A layout: one meter's steps with their eased display state per ring and
// step: r = size 0..1, o = opacity 0..1, a = position in steps. A leaving hit
// keeps its size and fades out. Settled on pattern `p` when given.
function makeLayout(meter, p) {
  const shown = RINGS.map((name) => Array.from({ length: meter.steps }, (_, s) => {
    const pr = p ? p[name].prob[s] : 0;
    return {
      r: dotSize(pr),
      o: pr > 0 ? 1 : 0,
      a: p ? stepPos(s, p.swing, p[name].nudge[s] || 0, meter) : s,
    };
  }));
  return { meter, shown };
}

export function createCircle(canvas, { position, now }) {
  const g = canvas.getContext('2d');
  let colors = {};
  let target = null;
  let cur = null;   // the layout being shown
  let old = null;   // the layout fading out after a meter change
  let mix = 1;      // 0..1, how far cur has replaced old
  const glows = []; // { ring, step, steps, t }
  let last = performance.now();
  let size = 0;
  let dpr = 1;
  let focusRing = -1; // the ring whose dial moved last
  let focusUntil = 0; // performance.now() time its emphasis ends
  const emph = RINGS.map(() => 0); // eased emphasis 0..1 per ring
  let focus = 0;      // the largest of emph: how far the other rings dim

  // Opacity of ring i now: resting, dimmed by any emphasis, lifted by its own.
  function ringAlpha(i) {
    const st = STYLE[RINGS[i]];
    const base = st.alpha + (st.dim - st.alpha) * focus;
    return base + (1 - base) * emph[i];
  }

  function refreshColors() {
    colors = {
      acc: cssColor('--acc', canvas),
      line: cssColor('--line', canvas),
      ink: cssColor('--ink', canvas),
      mut: cssColor('--ink-mut', canvas),
      kick: cssColor('--drum-kick', canvas),
      snare: cssColor('--drum-snare', canvas),
      hats: cssColor('--drum-hats', canvas),
      perc: cssColor('--drum-perc', canvas),
    };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    size = canvas.clientWidth;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }

  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    const snap = reduced();
    const k = snap ? 1 : 1 - Math.exp(-dt / EASE_S);
    const kf = snap ? 1 : 1 - Math.exp(-dt / FADE_S);
    const ks = snap ? 1 : 1 - Math.exp(-dt / SWAP_S);
    const kfocus = snap ? 1 : 1 - Math.exp(-dt / FOCUS_S);
    RINGS.forEach((_, i) => {
      emph[i] += ((i === focusRing && t < focusUntil ? 1 : 0) - emph[i]) * kfocus;
    });
    focus = Math.max(...emph);
    if (old) {
      mix += (1 - mix) * ks;
      if (mix > 0.99) { old = null; mix = 1; }
    }

    if (target && cur) {
      const m = cur.meter;
      RINGS.forEach((name, i) => {
        const v = target[name];
        for (let s = 0; s < m.steps; s++) {
          const d = cur.shown[i][s];
          const pr = v.prob[s];
          if (pr > 0) {
            // A returning hit fades in at its size; a present one eases size.
            if (d.o < 0.05) d.r = dotSize(pr);
            else d.r += (dotSize(pr) - d.r) * k;
            d.o += (1 - d.o) * kf;
            d.a += (stepPos(s, target.swing, v.nudge[s] || 0, m) - d.a) * k;
          } else {
            d.o += (0 - d.o) * kf; // keep size and place, just fade
            if (snap) d.r = 0;
          }
        }
      });
    }
    draw(snap);
    requestAnimationFrame(frame);
  }

  // One layout's spokes, grid ticks and dots, at opacity `weight`.
  function drawLayout(L, weight, { cx, cy, R }) {
    if (weight < 0.01) return;
    const n = L.meter.steps;
    const ang = (a) => (a / n) * Math.PI * 2 - Math.PI / 2;

    // Group-start spokes.
    g.globalAlpha = weight;
    g.lineWidth = 1;
    g.strokeStyle = colors.line;
    for (const st of L.meter.starts) {
      const a = ang(st);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R * 0.24, cy + Math.sin(a) * R * 0.24);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
    }

    // Grid ticks on the plain 16th positions, then the hits over them.
    g.fillStyle = colors.line;
    RING_R.forEach((f) => {
      for (let s = 0; s < n; s++) {
        const a = ang(s);
        g.beginPath();
        g.arc(cx + Math.cos(a) * f * R, cy + Math.sin(a) * f * R, 1.5, 0, Math.PI * 2);
        g.fill();
      }
    });
    RINGS.forEach((name, i) => {
      const st = STYLE[name];
      const rr = RING_R[i] * R;
      const alpha = ringAlpha(i) * weight;
      const dotMax = Math.max(2.5, R * st.dot);
      g.fillStyle = colors[st.color];
      for (let s = 0; s < n; s++) {
        const d = L.shown[i][s];
        if (d.r < 0.02 || d.o < 0.01) continue;
        const a = ang(d.a);
        g.globalAlpha = alpha * d.o;
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, dotMax * d.r, 0, Math.PI * 2);
        g.fill();
      }
    });
    g.globalAlpha = 1;
  }

  function draw(snap) {
    if (!size) return;
    const W = size;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    const cx = W / 2;
    const cy = W / 2;
    const R = W / 2 - 4;
    const geo = { cx, cy, R };

    // Ring guides.
    g.lineWidth = 1;
    g.strokeStyle = colors.line;
    RING_R.forEach((rr) => {
      g.beginPath();
      g.arc(cx, cy, rr * R, 0, Math.PI * 2);
      g.stroke();
    });

    // Playhead hand (still under reduced motion: hidden). position() is a
    // fraction of the bar playing now, whatever its length.
    const pos = snap ? null : position();
    if (pos !== null) {
      const a = pos * Math.PI * 2 - Math.PI / 2;
      g.strokeStyle = colors.mut;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.stroke();
    }

    if (old) drawLayout(old, 1 - mix, geo);
    if (cur) drawLayout(cur, old ? mix : 1, geo);

    // Fired hits: a ring that fades out slowly. A hit from a bar of another
    // length (the old meter still playing out) sits on its plain step.
    const tNow = now();
    if (!snap && cur) {
      for (let j = glows.length - 1; j >= 0; j--) {
        const h = glows[j];
        const age = tNow - h.t;
        if (age < 0) continue;
        if (age > GLOW_S || h.ring < 0) { glows.splice(j, 1); continue; }
        const st = STYLE[RINGS[h.ring]];
        const d = h.steps === cur.meter.steps ? cur.shown[h.ring][h.step] : { a: h.step, r: 0.4 };
        const a = (d.a / h.steps) * Math.PI * 2 - Math.PI / 2;
        const rr = RING_R[h.ring] * R;
        g.globalAlpha = (1 - age / GLOW_S) * ringAlpha(h.ring);
        g.strokeStyle = colors[st.color];
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(2.5, R * st.dot) * Math.max(d.r, 0.4) + 4, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    } else {
      glows.length = 0;
    }
  }

  refreshColors();
  resize();
  new ResizeObserver(resize).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshColors);
  requestAnimationFrame(frame);

  return {
    setPattern(p) {
      const meter = meterOf(p);
      target = p;
      if (!cur) {
        // Start settled, then ease from there on.
        cur = makeLayout(meter, p);
      } else if (!sameMeter(cur.meter, meter)) {
        // Another bar: the new layout comes in settled and cross-fades with
        // the old one (a clean switch under reduced motion).
        if (reduced()) {
          old = null;
          mix = 1;
        } else {
          old = mix < 0.5 && old ? old : cur;
          mix = 0;
        }
        cur = makeLayout(meter, p);
      } else {
        cur.meter = meter;
      }
    },
    // Emphasise one voice's ring ('kick', 'hat', ...) now and for about a bar
    // after the last call. Another voice takes the emphasis over, easing.
    focus(voice) {
      const i = RINGS.indexOf(voice);
      if (i < 0) return;
      focusRing = i;
      focusUntil = performance.now() + FOCUS_HOLD_MS;
    },
    // A hit fired at audio time t, on `step` of a bar `steps` long.
    hit(voice, step, t, steps = cur ? cur.meter.steps : 16) {
      glows.push({ ring: RINGS.indexOf(voice), step, steps, t });
    },
    refreshColors,
  };
}
