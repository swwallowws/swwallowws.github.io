/* Ready Set: a lead sheet becomes a band in Ableton Live to jam with. Chord
   symbols over a staff; under the lamp the staff's five lines become the set's
   tracks (chords, bass, drums), with your part left open. */

import { clamp, rgba } from '../core.js';
import { mono, type CardDef, type CardState } from '../engine.js';
import { hit, tone } from '../sound.js';

type Role = 'you' | 'chords' | 'bass' | 'drums';

const X0 = 0.02, X1 = 0.98, BARS = 4;
const barX = (s: CardState, b: number): number => s.U(X0 + ((X1 - X0) * b) / BARS);
const CHORDS = ['Am', 'F', 'C', 'G'];
const ROLE: Role[] = ['you', 'chords', 'chords', 'bass', 'drums'];
const LANE: Record<Role, [number, number]> = { you: [0.1, 0.3], chords: [0.35, 0.56], bass: [0.61, 0.78], drums: [0.83, 1] };
const mid = (r: Role): number => (LANE[r][0] + LANE[r][1]) / 2;
/** The lane nearest a height on the card. */
const laneAt = (s: CardState, y: number): Role => {
  const v = (y - 22) / (s.H - 44);
  const roles = Object.keys(LANE) as Role[];
  return roles.reduce((b, r) => (Math.abs(mid(r) - v) < Math.abs(mid(b) - v) ? r : b), roles[0]!);
};
const staffY = (s: CardState, k: number): number => s.V(0.4) + k * s.H * 0.07;
const CH = [0, -1, 1, -0.5], BASS = [0, 0, -2, -2, 1, 1, -1, -1], DR = new Set([0, 4, 6, 8, 12, 14]);
const t2 = (t: number): number => clamp((t - X0) / (X1 - X0), 0, 1);
const TRIADS: Record<string, number[]> = { Am: [57, 60, 64], F: [53, 57, 60], C: [55, 60, 64], G: [55, 59, 62] };

export const readySet: CardDef = {
  id: 'tabridge',
  category: 'transform',
  still: [0.4, 0.45],
  strings: 5,
  points: 320,
  base: (k) => (k === 0 ? 0.7 : 0.5),
  colour: (k) => (k === 0 ? 'mut' : 'acc'),
  rest: (s, k, t, sec) => [s.U(t), staffY(s, k) + Math.sin(t * 6 + sec * 0.7 + k) * 0.7],
  tight: (s, k, t) => {
    const role = ROLE[k]!, u = t2(t);
    if (role === 'you') return [s.U(t), s.V(mid('you'))];
    if (role === 'chords') return [s.U(t), s.V(mid('chords') + CH[Math.min(3, Math.floor(u * 4))]! * 0.03) + (k === 1 ? -4 : 4)];
    if (role === 'bass') return [s.U(t), s.V(mid('bass') + BASS[Math.min(7, Math.floor(u * 8))]! * 0.015)];
    const st = u * 16, near = st - Math.round(st), on = DR.has(Math.round(st) % 16);
    return [s.U(t), s.V(mid('drums') + 0.03) - (on ? Math.exp(-near * near * 60) : 0) * s.H * 0.045];
  },
  wander: (s, sec) => [s.U(0.5 + 0.42 * Math.sin(sec * 0.3)), s.V(0.42 + 0.2 * Math.sin(sec * 0.5))],
  // Underneath: the Ableton Live set. A bar ruler, a clip per track, and your
  // track left open (a dashed outline, nothing in it).
  backdrop: (s, o) => {
    const C = s.C;
    mono(o, 9);
    for (let b = 0; b < BARS; b++) {
      const x = barX(s, b);
      o.strokeStyle = rgba(C.line, 1);
      o.lineWidth = 1;
      o.beginPath();
      o.moveTo(x, 2);
      o.lineTo(x, 12);
      o.stroke();
      o.fillStyle = rgba(C.mut, 1);
      o.fillText(String(b + 1), x + 3, 10);
    }
    const x0 = barX(s, 0) - 4, x1 = barX(s, BARS) + 4;
    for (const [role, [a, b]] of Object.entries(LANE) as [Role, [number, number]][]) {
      const y0 = s.V(a), y1 = s.V(b);
      o.textAlign = 'center';
      if (role === 'you') {
        o.setLineDash([4, 4]);
        o.strokeStyle = rgba(C.mut, 1);
        o.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
        o.setLineDash([]);
        o.fillStyle = rgba(C.mut, 1);
        o.fillText('your part', (x0 + x1) / 2, y0 + 10);
      } else {
        o.fillStyle = rgba(C.ground, 1);
        o.fillRect(x0, y0, x1 - x0, y1 - y0);
        o.fillStyle = rgba(C.acc, 1);
        o.fillRect(x0, y0, x1 - x0, 12);
        o.strokeStyle = rgba(C.acc, 1);
        o.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
        o.fillStyle = rgba(C.ground2, 1);
        o.fillText(role, (x0 + x1) / 2, y0 + 9);
      }
      o.textAlign = 'start';
    }
  },
  // Each chord symbol moves from the lead sheet down into the chords clip as
  // the set shows through, turning the accent colour on the way: one symbol,
  // never two.
  over: (s, ctx) => {
    ctx.font = '600 13px \"Inter Tight\", sans-serif';
    CHORDS.forEach((c, b) => {
      const x = barX(s, b) + 4, y0 = staffY(s, 0) - 12, y1 = s.V(LANE.chords[1]) - 6;
      const lit = s.lit(x, y0 - 2, X0 + ((X1 - X0) * b) / BARS);
      const ink = s.C.ink, acc = s.C.acc;
      ctx.fillStyle = rgba([
        Math.round(ink[0] + (acc[0] - ink[0]) * lit),
        Math.round(ink[1] + (acc[1] - ink[1]) * lit),
        Math.round(ink[2] + (acc[2] - ink[2]) * lit),
      ], 0.9);
      ctx.fillText(c, x + 2 * lit, y0 + (y1 - y0) * lit);
    });
  },
  // The label names a lane: point at that lane's clip, at the lamp's place along it.
  labelAt: (s, x, y) => {
    const role = laneAt(s, y);
    const x0 = barX(s, 0), x1 = barX(s, BARS);
    return [Math.min(x1 - 6, Math.max(x0 + 6, x)), s.V(LANE[role][0]) + 6, 4] as const;
  },
  label: (s, x, y) => {
    const role = laneAt(s, y);
    if (role === 'you') return 'your part · open: sing it, play it, or improvise';
    if (role === 'chords') return `chords · ${CHORDS[Math.min(3, Math.floor(t2(s.u(x)) * 4))]}`;
    return role === 'bass' ? 'bass' : 'drums';
  },
  playLabel: (s, p) => ({ text: 'the band plays · you jam', x: s.U(p) + 8, y: s.V(mid('you')) + 4 }),
  audio: (a, at) => {
    const bar = 3.2 / BARS;
    CHORDS.forEach((c, b) => TRIADS[c]!.forEach((m) => tone(a, m, at + b * bar, bar * 0.95, 0.04, 'sine')));
    [45, 45, 41, 41, 48, 48, 43, 43].forEach((m, i) => tone(a, m, at + (i * bar) / 2, (bar / 2) * 0.9, 0.11, 'sine'));
    for (let i = 0; i < 16; i++) {
      const when = at + (i * 3.2) / 16;
      if (DR.has(i) && i % 4 !== 2) hit(a, 'kick', when);
      if (i % 8 === 4) hit(a, 'snare', when);
      if (i % 2 === 0) hit(a, 'hats', when, 0.6);
    }
  },
};
