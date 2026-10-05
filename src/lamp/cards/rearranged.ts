/* Rearranged, before and after: the same chords, pressed differently.
   Each row has one string per chord note, at its pitch, stepping with the
   chords. A string sits at its pitch while its note is pressed and dips a
   little when released, so every press shows where it starts and ends.
   Before: one press per bar, held the whole bar.
   After: two presses per bar, shorter, the three notes starting and ending at
   slightly different times.
   Under the lamp the before row's presses split and slide into the after
   pattern, right where the lamp is, and slide back as it leaves. Click a row to
   hear it. */

import { clamp, rgba, smooth } from '../core.js';
import { calm, type CardDef, type CardState, type Point } from '../engine.js';
import { tone } from '../sound.js';

type Row = 'before' | 'after';

const CHORDS = [
  { name: 'Am', notes: [57, 60, 64] }, { name: 'F', notes: [57, 60, 65] },
  { name: 'C', notes: [55, 60, 64] }, { name: 'G', notes: [55, 59, 62] },
];
const BARS = CHORDS.length, LO = 53, HI = 67, VOICES = 3;
// Presses per row, in bars: [start, length], with a small offset per note in the after row.
const PRESSES: Record<Row, (j: number) => [number, number][]> = {
  before: () => [[0, 0.96]],
  after: (j) => [[0 + j * 0.04, 0.3 - j * 0.03], [0.5 + j * 0.06, 0.22 + j * 0.02]],
};
const ROW: Record<Row, [number, number]> = { before: [0.04, 0.42], after: [0.56, 0.94] };
const rowAt = (s: CardState, y: number): Row => (y < s.V((ROW.before[1] + ROW.after[0]) / 2) ? 'before' : 'after');
const rowOf = (s: CardState): Row => (s.row === 'after' ? 'after' : 'before');
const pitchY = (s: CardState, row: Row, n: number): number =>
  s.V(ROW[row][0] + (1 - (n - LO) / (HI - LO)) * (ROW[row][1] - ROW[row][0]));

// How pressed note j is at t (0 released, 1 pressed), pressed the `pattern` way, and which bar it is in.
function pressed(pattern: Row, j: number, t: number): { on: number; bar: number } {
  const x = t * BARS, b = Math.min(BARS - 1, Math.floor(x)), f = x - b, edge = 0.02;
  let on = 0;
  for (const [a, len] of PRESSES[pattern](j)) {
    on = Math.max(on, smooth(clamp((f - a) / edge, 0, 1)) * smooth(clamp((a + len - f) / edge, 0, 1)));
  }
  return { on, bar: b };
}

// A string in `row`, pressed the `pattern` way.
function stringY(s: CardState, row: Row, j: number, t: number, pattern: Row = row): number {
  const { on, bar } = pressed(pattern, j, t);
  return pitchY(s, row, CHORDS[bar]!.notes[j]!) + (1 - on) * 7;
}

// Where a string is, given what the lamp is doing to it: the before row's
// presses become the after pattern under the lamp (not under reduced motion,
// where the two rows stay side by side as before and after).
function place(s: CardState, k: number, t: number): Point {
  const row: Row = k < VOICES ? 'before' : 'after', j = k % VOICES, x = s.U(t);
  let y = stringY(s, row, j, t);
  const w = calm() ? 0 : s.wAt(x, y);
  if (row === 'before') y += (stringY(s, row, j, t, 'after') - y) * w;
  return [x, y];
}

export const rearranged: CardDef = {
  id: 'rearranged',
  category: 'transform',
  still: [0.35, 0.24],
  strings: VOICES * 2,
  points: 400,
  base: () => 0.55,
  // The lamp's motion is worked out in `place`, so rest and tight are the same.
  rest: place,
  tight: place,
  wander: (s, sec) => {
    const t = 0.5 + 0.42 * Math.sin(sec * 0.3), row: Row = Math.sin(sec * 0.17) > 0 ? 'before' : 'after';
    return [s.U(t), s.V((ROW[row][0] + ROW[row][1]) / 2)];
  },
  backdrop: (s, o) => {
    o.lineWidth = 1;
    o.strokeStyle = rgba(s.C.line, 1);
    for (let b = 0; b <= BARS; b++) {
      o.beginPath();
      o.moveTo(s.U(b / BARS), 0);
      o.lineTo(s.U(b / BARS), s.H);
      o.stroke();
    }
  },
  label: (s, x, y) => {
    const ch = CHORDS[Math.min(BARS - 1, Math.floor(clamp(s.u(x), 0, 0.999) * BARS))]!.name;
    if (rowAt(s, y) === 'after') return `after · ${ch}, two shorter presses a bar`;
    return `before → after · ${ch}, one press becomes two`;
  },
  playLabel: (s, p) => ({ text: rowOf(s), x: s.U(p) + 8, y: s.V(ROW[rowOf(s)][0]) + 4 }),
  // Click the top row to hear before, the bottom row to hear after.
  onPlay: (s) => { s.row = rowAt(s, s.y); },
  audio: (a, at, s) => {
    const row = rowOf(s), bar = 3.2 / BARS;
    CHORDS.forEach((ch, b) => ch.notes.forEach((m, j) => {
      for (const [start, len] of PRESSES[row](j)) tone(a, m, at + (b + start) * bar, len * bar, 0.06);
    }));
  },
};
