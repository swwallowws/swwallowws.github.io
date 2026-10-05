/* Starling: a voice becomes notes, every slide kept. At rest the voice is a
   bundle of strings swaying around the sung pitch, wider where it is louder;
   taut, it lies on the notes it found. */

import { hz, nameOf, rgba } from '../core.js';
import { mono, type CardDef, type CardState } from '../engine.js';

interface Note { a: number; b: number; n: number; v?: boolean }
const NOTES: Note[] = [
  { a: 0.03, b: 0.16, n: 60 }, { a: 0.2, b: 0.31, n: 64 }, { a: 0.35, b: 0.52, n: 62, v: true },
  { a: 0.56, b: 0.71, n: 67 }, { a: 0.75, b: 0.85, n: 65 }, { a: 0.88, b: 0.98, n: 64, v: true },
];
const FIRST = NOTES[0]!, LAST = NOTES[NOTES.length - 1]!;
const T0 = FIRST.a, T1 = LAST.b, LO = 55, HI = 71;

const noteAt = (t: number): Note | null => NOTES.find((n) => t >= n.a && t <= n.b) ?? null;
const yOf = (s: CardState, n: number): number => s.V(1 - (n - LO) / (HI - LO));

/** The sung pitch at t: each note scooped into, some with vibrato, sliding between. */
function semi(t: number): number {
  for (let i = 0; i < NOTES.length; i++) {
    const n = NOTES[i]!;
    if (t >= n.a && t <= n.b) {
      const p = (t - n.a) / (n.b - n.a), prev = i ? NOTES[i - 1]!.n : n.n - 1;
      const scoop = p < 0.18 ? (prev - n.n) * (1 - p / 0.18) ** 2 * 0.5 : 0;
      const vib = n.v ? Math.sin(p * 44) * 0.35 * Math.min(1, p * 3) : 0;
      return n.n + scoop + vib;
    }
    const next = NOTES[i + 1];
    if (next && t > n.b && t < next.a) {
      const q = (t - n.b) / (next.a - n.b);
      return n.n + (next.n - n.n) * q * q * (3 - 2 * q);
    }
  }
  return t < T0 ? FIRST.n : LAST.n;
}

/** How loud the voice is at t. */
function amp(t: number): number {
  const n = noteAt(t);
  if (!n) return 0.35;
  const p = (t - n.a) / (n.b - n.a);
  return 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, p * 1.15 + 0.04));
}

const u = (t: number): number => T0 + (T1 - T0) * t;

/** What the voice is doing at a point: holding a note, or sliding between two. */
function say(x: number): string | null {
  const n = noteAt(x);
  if (n) return n.v ? `${nameOf(n.n)} · vibrato kept` : nameOf(n.n);
  const i = NOTES.findIndex((m) => m.a > x);
  return i > 0 ? `slide ${nameOf(NOTES[i - 1]!.n)} → ${nameOf(NOTES[i]!.n)} · kept` : null;
}

export const starling: CardDef = {
  id: 'voxmpe',
  category: 'transcribe',
  still: [0.42, 0.42],
  strings: 9,
  rest: (s, k, t, sec) => {
    const x = u(t), a = amp(x);
    return [s.U(x), yOf(s, semi(x)) + (k - 4) * a * 4.5 + Math.sin(x * 9 + sec * 0.7 + k * 0.8) * a * 1.5];
  },
  tight: (s, k, t) => {
    const x = u(t), n = noteAt(x);
    return [s.U(x), (n ? yOf(s, n.n) : yOf(s, semi(x))) + (k - 4) * 0.7];
  },
  when: (_k, t) => u(t),
  backdrop: (s, o) => {
    o.strokeStyle = rgba(s.C.line, 1);
    o.lineWidth = 1;
    for (let n = LO; n <= HI; n++) {
      const y = yOf(s, n);
      o.beginPath();
      o.moveTo(0, y);
      o.lineTo(s.W, y);
      o.stroke();
    }
    mono(o, 10);
    o.fillStyle = rgba(s.C.ink, 1);
    for (const n of NOTES) o.fillText(nameOf(n.n), s.U(n.a), yOf(s, n.n) - 9);
  },
  label: (s, x) => say(s.u(x)),
  playLabel: (s, p) => {
    const text = say(p);
    return text ? { text, x: s.U(p) + 8, y: s.V(0.04) } : null;
  },
  audio: (a, at) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    g.gain.setValueAtTime(0, at);
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, when = at + t * 3.2;
      o.frequency.linearRampToValueAtTime(hz(semi(t)), when);
      g.gain.linearRampToValueAtTime(t < T0 || t > T1 ? 0 : 0.14 * amp(t), when);
    }
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 3.3);
  },
};
