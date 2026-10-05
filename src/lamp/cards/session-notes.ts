/* Session Notes: lyric lines, each at its bar like clips stacked down an
   Ableton Live arrangement, pull taut into clips where they sit. */

import { rgba } from '../core.js';
import { mono, type CardDef, type CardState } from '../engine.js';
import { tone } from '../sound.js';

const LYR = [
  { bar: 1, text: 'low sun, high tide' },
  { bar: 5, text: 'swallow whole the off-key hums' },
  { bar: 9, text: 'then slowly fade from sight' },
];
const lyr = (i: number): { bar: number; text: string } => LYR[i]!;
const TL = (bar: number, f = 0): number => (bar - 1) / 12 + ((f * 4) / 12) * 0.96;
const rowY = (s: CardState, i: number): number => s.V(0.14 + i * 0.3);
const lineAt = (s: CardState, y: number): number =>
  LYR.reduce((b, _l, i) => (Math.abs(rowY(s, i) + 12 - y) < Math.abs(rowY(s, b) + 12 - y) ? i : b), 0);

export const sessionNotes: CardDef = {
  id: 'session-notes',
  category: 'workflow',
  still: [0.4, 0.55],
  strings: 9,
  base: (k) => (k % 3 === 1 ? 0.6 : 0.3),
  rest: (s, k, t, sec) => {
    const i = Math.floor(k / 3), j = k % 3;
    return [s.U(TL(lyr(i).bar, t)), rowY(s, i) + 12 + Math.sin(t * 16 + i * 2 + j * 0.9 + sec * 0.6) * 3 + (j - 1) * 2];
  },
  tight: (s, k, t) => {
    const i = Math.floor(k / 3), j = k % 3;
    return [s.U(TL(lyr(i).bar, t)), rowY(s, i) + 12 + (j - 1) * 6];
  },
  when: (k, t) => TL(lyr(Math.floor(k / 3)).bar, t),
  wander: (s, sec) => {
    const i = Math.floor((Math.sin(sec * 0.25) + 1) * 1.49);
    return [s.U(TL(lyr(i).bar, 0.5)), rowY(s, i) + 12];
  },
  // The lyrics themselves, as written in the note.
  surface: (s, ctx) => {
    ctx.font = '14px \"Inter Tight\", sans-serif';
    LYR.forEach((l, i) => {
      ctx.fillStyle = rgba(s.C.ink, 0.75);
      ctx.fillText(l.text, s.U(TL(l.bar)), rowY(s, i));
    });
  },
  backdrop: (s, o) => {
    o.strokeStyle = rgba(s.C.line, 1);
    o.lineWidth = 1;
    mono(o, 10);
    for (let b = 1; b <= 13; b++) {
      const x = s.U(TL(b));
      o.beginPath();
      o.moveTo(x, 0);
      o.lineTo(x, s.H);
      o.stroke();
    }
    LYR.forEach((l, i) => {
      o.fillStyle = rgba(s.C.acc, 1);
      o.fillText(`[${l.bar}]`, s.U(TL(l.bar)) - 2, rowY(s, i) + 34);
    });
  },
  label: (s, _x, y) => {
    const l = lyr(lineAt(s, y));
    return `[${l.bar}] · a clip on bar ${l.bar}`;
  },
  audio: (a, at) =>
    LYR.forEach((l, i) =>
      [60, 64, 67].forEach((m, j) => tone(a, m + [0, 5, -3][i]!, at + ((l.bar - 1) / 12) * 3.2 + j * 0.04, 0.9, 0.05)),
    ),
};
