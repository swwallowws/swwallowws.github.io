/* Tagline, on its own page: the card merged with the six steps below it. Its
   width is the six steps' columns (Capture, Inbox, Triage, Own, Sync, Play,
   as in src/data/projects.ts), and the strings change as they cross them,
   left to right: they arrive loose and tangled (Capture, Inbox); at Triage
   the drops go slack and fall away while the keepers begin to straighten; at
   Own the keepers run straight; at Sync their hashtags are threaded on; at
   Play they lie close together in the crate. The picture is the six steps
   without the lamp; the lamp names the step and the capture under it, and a
   click runs the playhead through the steps, lighting each column. */

import { clamp, rgba, smooth } from '../core.js';
import { mono, type CardDef, type CardState } from '../engine.js';
import { tone } from '../sound.js';

const STEPS = ['Capture', 'Inbox', 'Triage', 'Own', 'Sync', 'Play'];
const N = STEPS.length;

interface Capture { why: string; keep: string[] | null }
const CAPS: Capture[] = [
  { why: 'the bassline at 2:10', keep: ['#descent', '#dj-able'] },
  { why: 'heard it at a friend’s', keep: null },
  { why: 'that vocal chop', keep: ['#warm-up', '#vocal'] },
  { why: 'good for a slow start', keep: ['#warm-up'] },
  { why: 'too busy, maybe', keep: null },
  { why: 'the drop, obviously', keep: ['#peak', '#dj-able'] },
];
const cap = (k: number): Capture => CAPS[k]!;
const keepers = CAPS.map((c, i) => (c.keep ? i : -1)).filter((i) => i >= 0);

/** Where the steps begin, as fractions of the card's width. */
const at = (step: number): number => step / N;
const stepOf = (t: number): number => Math.min(N - 1, Math.floor(clamp(t, 0, 0.999) * N));
/** How far along a stretch of steps t is, eased: 0 before `from`, 1 after `to`. */
const across = (t: number, from: number, to: number): number => smooth(clamp((t - at(from)) / (at(to) - at(from)), 0, 1));

const tangle = (s: CardState, k: number, t: number, sec: number): number =>
  s.V(0.5 + 0.34 * Math.sin(t * (2.2 + k * 0.55) + k * 1.9 + sec * 0.2) * Math.sin(t * 1.7 + k * 0.8));
// A keeper's lane once straight, and its place in the crate at Play.
const lane = (s: CardState, k: number): number => s.V(0.12 + keepers.indexOf(k) * 0.2);
const crate = (s: CardState, k: number): number => s.V(0.33 + keepers.indexOf(k) * 0.08);

/** A string's height at t: the six steps' story, left to right. */
function staged(s: CardState, k: number, t: number, sec: number): number {
  const y = tangle(s, k, t, sec);
  if (!cap(k).keep) return y + s.H * 1.2 * across(t, 2, 3); // dropped at Triage: falls out of the card
  const straight = y + (lane(s, k) - y) * across(t, 2, 4); // sorted at Triage, straight by Own's end
  return straight + (crate(s, k) - straight) * across(t, 5, 6); // gathered into the crate at Play
}

/** The capture nearest to height y at t, among the strings still on the card there. */
function nearest(s: CardState, t: number, y: number): number {
  let best = 0, bd = Infinity;
  CAPS.forEach((c, k) => {
    if (!c.keep && stepOf(t) > 2) return;
    const d = Math.abs(staged(s, k, t, s.sec) - y);
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}

/** What a step does to one capture, in a few words. */
function say(step: number, c: Capture): string {
  const why = `“${c.why}”`;
  if (step < 2) return `${STEPS[step]} · ${why}${step === 1 ? ', now a note' : ''}`;
  if (!c.keep) return `${STEPS[step]} · ${why} · dropped`;
  return [
    `Triage · ${why} · kept`,
    `Own · ${why} · its file, found`,
    `Sync · ${why} · ${c.keep.join(' ')} written in`,
    `Play · ${why} · in the crate`,
  ][step - 2]!;
}

export const taglineFlow: CardDef = {
  id: 'intentional',
  category: 'workflow',
  still: [0.5, 0.45],
  strings: CAPS.length,
  points: 240,
  dur: 4.2,
  base: (k) => (cap(k).keep ? 0.55 : 0.35),
  colour: (k) => (cap(k).keep ? 'acc' : 'mut'),
  // The story is the shape itself; the lamp and the playhead only bring colour.
  rest: (s, k, t, sec) => [t * s.W, staged(s, k, t, sec)],
  tight: (s, k, t, sec) => [t * s.W, staged(s, k, t, sec)],
  // Keepers colour as they get sorted; drops stay muted.
  intensity: (_s, k, t, w) => (cap(k).keep ? Math.max(w, 0.7 * across(t, 2, 4)) : w * 0.5),
  sweepX: (s, p) => p * s.W,
  // The six columns' dividers, continuing up from the steps below.
  surface: (s, ctx) => {
    ctx.strokeStyle = rgba(s.C.line, 0.7);
    ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      const x = Math.round(at(i) * s.W) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s.H);
      ctx.stroke();
    }
  },
  // The hashtags, threaded onto the keepers in the Sync column; and while
  // playing, the column the playhead is in, lit, and named for the page.
  over: (s, ctx) => {
    if (s.playing) {
      const i = stepOf(s.p);
      ctx.fillStyle = rgba(s.C.acc, 0.06);
      ctx.fillRect(at(i) * s.W, 0, s.W / N, s.H);
      if (s.el.dataset['step'] !== String(i)) s.el.dataset['step'] = String(i);
    } else if (s.el.dataset['step']) {
      delete s.el.dataset['step'];
    }
    mono(ctx, 10);
    keepers.forEach((k) => {
      let x = at(4) * s.W + 10;
      const y = staged(s, k, 4.5 / N, s.sec);
      for (const h of cap(k).keep!) {
        const tw = ctx.measureText(h).width;
        ctx.fillStyle = rgba(s.C.ground, 1);
        ctx.fillRect(x - 5, y - 8, tw + 10, 16);
        ctx.strokeStyle = rgba(s.C.acc, 1);
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4.5, y - 7.5, tw + 9, 15);
        ctx.fillStyle = rgba(s.C.ink, 1);
        ctx.fillText(h, x, y + 3.5);
        x += tw + 16;
      }
    });
  },
  label: (s, x, y) => {
    const t = clamp(x / s.W, 0, 0.999);
    return say(stepOf(t), cap(nearest(s, t, y)));
  },
  playLabel: (s, p) => ({ text: STEPS[stepOf(p)]!, x: p * s.W + 8, y: s.V(0.02) + 8 }),
  // A soft note per step; at Triage, a falling tone for each drop.
  audio: (a, at0) => {
    const step = 4.2 / N;
    [72, 74, 76, 79, 81, 84].forEach((m, i) => tone(a, m, at0 + i * step, 0.3, 0.06, 'sine'));
    CAPS.forEach((c, k) => { if (!c.keep) tone(a, 52, at0 + 2 * step + k * 0.08, 0.35, 0.06, 'triangle', 45); });
  },
};
