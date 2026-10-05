/* YSAD: the circle's four rings, with a hand that always turns. Follows the
   real circle: kick inside to hats outside, a hit on its 16th sized by
   probability, spokes on the beats, a muted hand. Each ring is seven strings
   lying close together; at a hit they fan apart into a round shape, filling it
   with parallel lines, so the hit is a disc made of the strings themselves, with
   no outline and nothing drawn on top. The strings the hand has just passed pull
   taut, then loosen again. */

import { rgba } from '../core.js';
import { calm, type CardDef, type CardState, type Point } from '../engine.js';
import { hit } from '../sound.js';

type Ring = 'kick' | 'snare' | 'perc' | 'hats';

const RINGS: Ring[] = ['kick', 'snare', 'perc', 'hats'];
const RING_R = [0.36, 0.53, 0.7, 0.87], DOT = [0.06, 0.036, 0.03, 0.024], BASE = [0.5, 0.42, 0.38, 0.34];
const PROB: Record<Ring, Record<number, number>> = {
  kick: { 0: 1, 6: 0.5, 8: 1, 10: 0.7 },
  snare: { 4: 1, 12: 1, 15: 0.3 },
  perc: { 3: 0.5, 11: 0.4, 14: 0.6 },
  hats: { 0: 1, 1: 0.3, 2: 1, 3: 0.3, 4: 1, 5: 0.3, 6: 1, 7: 0.3, 8: 1, 9: 0.3, 10: 1, 11: 0.3, 12: 1, 13: 0.3, 14: 1, 15: 0.3 },
};
const BAR = 3.2, PER = 7, MID = (PER - 1) / 2;
const size = (p: number): number => (p > 0 ? 0.3 + 0.7 * p * p : 0);
const geo = (s: CardState): { cx: number; cy: number; R: number } => ({ cx: s.W / 2, cy: s.H / 2, R: Math.min(s.W, s.H) / 2 - 8 });
const ang = (t: number): number => t * Math.PI * 2 - Math.PI / 2;
const ringOf = (k: number): number => Math.floor(k / PER);
const laneOf = (k: number): number => ((k % PER) - MID) / MID; // -1 .. 1 across the ring
const probAt = (ring: number, step: number): number => PROB[RINGS[ring]!][step] ?? 0;

// How far the ring's strings fan apart at t: a circle's half-width around each
// hit, its radius set by the hit's probability, zero between hits.
function halfWidth(s: CardState, ring: number, t: number): number {
  const { R } = geo(s), st = t * 16, pr = probAt(ring, Math.round(st) % 16);
  if (!pr) return 0;
  const d = Math.max(3, R * DOT[ring]!) * size(pr) * 1.25;
  const off = ((st - Math.round(st)) / 16) * Math.PI * 2 * RING_R[ring]! * R;
  return Math.sqrt(Math.max(0, d * d - off * off));
}

// Where the hand is: the playhead while playing, otherwise its own slow turn.
const hand = (s: CardState): number => (s.playing ? s.p : (s.sec / BAR) % 1);
const onRing = (s: CardState, t: number, r: number): Point => {
  const { cx, cy } = geo(s), a = ang(t);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
};

export const ysad: CardDef = {
  id: 'ysad',
  category: 'transform',
  still: [0.62, 0.38],
  strings: RINGS.length * PER,
  points: 420,
  dur: BAR,
  colour: (k) => RINGS[ringOf(k)]!,
  base: (k) => BASE[ringOf(k)]!,
  // Loose, the strings sway a little and the discs are already there, softer.
  rest: (s, k, t, sec) => {
    const ring = ringOf(k), { R } = geo(s);
    const r = RING_R[ring]! * R + laneOf(k) * (halfWidth(s, ring, t) * 0.8 + 2.2) + Math.sin(ang(t) * 3 + sec * 0.5 + ring * 1.3 + k) * 1.2;
    return onRing(s, t, r);
  },
  tight: (s, k, t) => {
    const ring = ringOf(k), { R } = geo(s);
    return onRing(s, t, RING_R[ring]! * R + laneOf(k) * (halfWidth(s, ring, t) + 0.5));
  },
  // The discs carry their drum's colour at rest too; lit, everything colours.
  intensity: (_s, k, t, w) => {
    const st = t * 16, pr = probAt(ringOf(k), Math.round(st) % 16);
    const near = st - Math.round(st), g = pr ? size(pr) * Math.exp(-near * near * 30) : 0;
    return Math.max(w * (0.3 + 0.7 * g), 0.65 * g);
  },
  thick: 0.3,
  // Behind the turning hand the strings pull taut, then loosen over a quarter turn.
  lift: (s, _k, t) => {
    if (calm() || s.sweep >= 0) return 0;
    const d = (((hand(s) - t) % 1) + 1) % 1;
    return d < 0.25 ? (1 - d / 0.25) ** 2 : 0;
  },
  wander: (s, sec) => {
    const { cx, cy, R } = geo(s), a = sec * 0.3 + s.seed, r = R * 0.6;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  },
  backdrop: (s, o) => {
    const { cx, cy, R } = geo(s);
    o.strokeStyle = rgba(s.C.line, 1);
    o.lineWidth = 1;
    for (const st of [0, 4, 8, 12]) {
      const a = ang(st / 16);
      o.beginPath();
      o.moveTo(cx + Math.cos(a) * R * 0.24, cy + Math.sin(a) * R * 0.24);
      o.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      o.stroke();
    }
    o.fillStyle = rgba(s.C.line, 1);
    for (const f of RING_R) {
      for (let i = 0; i < 16; i++) {
        const a = ang(i / 16);
        o.beginPath();
        o.arc(cx + Math.cos(a) * f * R, cy + Math.sin(a) * f * R, 1.5, 0, Math.PI * 2);
        o.fill();
      }
    }
  },
  sweepMask: (s, o, p) => {
    const { cx, cy } = geo(s);
    o.beginPath();
    o.moveTo(cx, cy);
    o.arc(cx, cy, s.W, ang(0), ang(p));
    o.closePath();
  },
  // The hand, always; while playing it is the playhead.
  over: (s, ctx) => {
    if (calm()) return;
    const { cx, cy, R } = geo(s), a = ang(hand(s));
    ctx.strokeStyle = rgba(s.C.mut, 1);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  },
  playhead: () => {},
  label: (s, x, y) => {
    const { cx, cy, R } = geo(s), r = Math.hypot(x - cx, y - cy) / R;
    if (r < 0.25) return null;
    const ring = RING_R.reduce((b, f, i) => (Math.abs(f - r) < Math.abs(RING_R[b]! - r) ? i : b), 0);
    const t = ((Math.atan2(y - cy, x - cx) + Math.PI / 2) / (Math.PI * 2) + 1) % 1;
    const step = Math.round(t * 16) % 16, pr = probAt(ring, step);
    return pr ? `${RINGS[ring]} · ${Math.round(pr * 100)}% chance on step ${step + 1}` : RINGS[ring]!;
  },
  audio: (a, at) => {
    for (let i = 0; i < 16; i++) {
      for (const name of RINGS) {
        const pr = PROB[name][i];
        if (pr && Math.random() < pr) hit(a, name, at + (i * BAR) / 16);
      }
    }
  },
};
