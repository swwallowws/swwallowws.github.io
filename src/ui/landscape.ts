/* The landscape: the geometry of the welcome page's map (map.ts draws it).

   Tracks run across the forms music takes, one row per tool: sound, a tab or a
   score, MIDI, an Ableton Live set. MIDI is three nested sets, plain MIDI holding
   expressive MIDI holding microtonal; flat, their rings read as contour lines,
   tilted, the nesting is height, and each track climbs as far as its tool
   reaches. The map tilts on its own on a slow loop (`auto`), held flat under
   reduced motion.

   Everything here is in a 1100-wide world, pure and testable;
   test/landscape.test.ts checks that no name, heading or mark crowds a line at
   any moment of the loop. */

export type Stop = 'margin' | 'sound' | 'score' | 'mid' | 'midL' | 'set' | 'out';

export interface Row {
  /** The project id (src/data/projects.ts): its name, category and item. */
  id: string;
  /** Stops left to right: [form, note?, input?] (input = where it starts). */
  stops: [Stop, string?, true?][];
  /** MIDI in, MIDI out: an ellipse travelled most of the way round. */
  loop?: { rx: number; ry: number; dy: number; from: number; sweep: number };
}

export interface Ring { name: string; cx: number; cy: number; rx: number; ry: number; at: number }

export const W0 = 1100;
export const ROW = 58;
export const TOP = 90;
/** The rows that never touch MIDI sit below the rest, an extra gap under the MIDI ring. */
export const BELOW = 6;
export const BELOW_GAP = 26;
export const rowY = (i: number): number => TOP + i * ROW + (i >= BELOW ? BELOW_GAP : 0);

/** Where the tool names end (right-aligned). */
export const NAME_X = 148;
/** margin: where tracks that don't start in a named form begin; out: the right-hand
    ends, a short way past the set. */
export const X = { margin: 222, sound: 290, score: 400, mid: 640, set: 900, out: 1000 } as const;
export const xOf = (k: Stop): number => (k === 'midL' ? X.mid - 95 : X[k]);

/** Column guides and their names. The right-hand edge has no name: only two tools
    end there, in different things, so each end is named under its mark. MIDI is
    named on its ring, in the same row. */
export const COLS: ['sound' | 'score' | 'set', string][] = [['sound', 'sound'], ['score', 'tab or score'], ['set', 'Ableton Live set']];

/* Rows, top to bottom: the tools that touch MIDI together, so the sets can hold
   them, each colour kept together; the two that don't touch MIDI below. Words only
   where a track starts in the margin, which has no column name. */
export const ROWS: Row[] = [
  // (stops in plain MIDI's band, short of the centre, so Starling can climb past it)
  { id: 'stemscribe', stops: [['sound', '', true], ['midL']] },
  { id: 'voxmpe', stops: [['sound', '', true], ['mid'], ['set']] },
  { id: 'tabridge', stops: [['score', '', true], ['mid'], ['set']] },
  { id: 'rearranged', stops: [], loop: { rx: 68, ry: 14, dy: 10, from: 0.62 * Math.PI, sweep: 1.72 * Math.PI } },
  { id: 'ysad', stops: [['margin', 'style', true], ['mid'], ['set']] },
  { id: 'odoroki', stops: [['sound', '', true], ['mid', '', true], ['out', 'live visuals']] },
  { id: 'intentional', stops: [['margin', 'link', true], ['out', 'DJ crate']] },
  { id: 'session-notes', stops: [['margin', 'lyrics', true], ['set']] },
];

/** The nested sets, each holding the next. Each ring is broken where its name sits
    (`at`, an angle on the ring), at a spot no track crosses at any angle of the loop. */
export const RINGS: Ring[] = [
  // top: level with the column headings
  { name: 'MIDI', cx: X.mid, cy: (rowY(0) + rowY(5)) / 2, rx: 215, ry: (rowY(5) - rowY(0)) / 2 + 34, at: -Math.PI / 2 },
  // bottom, between Ready Set and Rearranged
  { name: 'expressive', cx: X.mid, cy: (rowY(1) + rowY(2)) / 2, rx: 140, ry: ROW / 2 + 34, at: Math.PI / 2 },
  // bottom, between Starling and Ready Set
  { name: 'microtonal', cx: X.mid, cy: rowY(1), rx: 78, ry: 30, at: Math.PI / 2 },
];

/** The heading row runs along the top of the MIDI ring, where MIDI is named. */
export const HEAD_Y = RINGS[0]!.cy - RINGS[0]!.ry;
export const RING_FONT = 11;
export const LIFT = 28;
export const H0 = rowY(ROWS.length - 1) + 50;

export const smooth = (t: number): number => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/** Height of the ground at (x, y): a soft terrace for each set the point is inside. */
export function height(x: number, y: number): number {
  let h = 0;
  for (const e of RINGS) h += LIFT * smooth((1.06 - Math.hypot((x - e.cx) / e.rx, (y - e.cy) / e.ry)) / 0.12);
  return h;
}

export type Pt = [number, number, number];

/** A track's points in the world: straight between its stops (the only bends are the
    climbs onto each terrace when tilted), or its loop. */
export function trackPts(r: Row, i: number): Pt[] {
  const y = rowY(i);
  const pts: Pt[] = [];
  if (r.loop) {
    const { rx, ry, from, sweep, dy } = r.loop;
    for (let k = 0; k <= 90; k++) {
      const a = from + (k / 90) * sweep, x = X.mid + Math.cos(a) * rx, yy = y + dy + Math.sin(a) * ry;
      pts.push([x, yy, height(x, yy)]);
    }
    return pts;
  }
  const xs = r.stops.map(([k]) => xOf(k)).sort((a, b) => a - b);
  const from = xs[0]!, to = xs[xs.length - 1]!;
  for (let x = from; x <= to + 0.01; x += 4) {
    const xx = Math.min(x, to);
    pts.push([xx, y, height(xx, y)]);
  }
  return pts;
}

// ---- the view ---------------------------------------------------------------------

export interface View { pitch: number; yaw: number }
/** A margin around the world, so the slight turn never pushes a name off the edge. */
export const PAD = 60;
const CX = 620, CY = (TOP + H0) / 2;
/** The canvas height for a scale (CSS px per world unit). */
export const heightFor = (s: number): number => Math.round((H0 + 140) * s);
/** World (x, y, z) to screen px, for a view and a scale. */
export function proj(v: View, s: number, x: number, y: number, z: number): [number, number] {
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
  const dx = x - CX, dy = y - CY;
  const rx = dx * cy - dy * sy, ry = dx * sy + dy * cy;
  const py = CY + ry * Math.cos(v.pitch) - z * Math.sin(v.pitch);
  return [(CX + rx + PAD) * s, (py + 50 + (v.pitch > 0 ? 30 : 0) * Math.sin(v.pitch)) * s];
}
export const scaleFor = (width: number): number => width / (W0 + 2 * PAD);

/** Steep enough to read as a hill, shallow enough that a lifted row never rises past
    the row above it. */
export const TILT = 0.7;
export const YAW = 0.1;
/** On its own: flat for a moment, rising into the hill, a slow half-turn there, then
    settling flat again (seconds per phase). */
export const LOOP: ['flat' | 'rise' | 'hold' | 'fall', number][] = [['flat', 1.5], ['rise', 3.5], ['hold', 7], ['fall', 3.5], ['flat', 2.5]];
export const LOOP_S = LOOP.reduce((a, [, d]) => a + d, 0);
/** The view at t seconds into the loop. */
export function auto(t: number): View {
  let u = ((t % LOOP_S) + LOOP_S) % LOOP_S;
  for (const [phase, d] of LOOP) {
    if (u < d) {
      const k = smooth(u / d);
      if (phase === 'rise') return { pitch: TILT * k, yaw: -YAW * k };
      if (phase === 'hold') return { pitch: TILT, yaw: -YAW + 2 * YAW * k };
      if (phase === 'fall') return { pitch: TILT * (1 - k), yaw: YAW * (1 - k) };
      return { pitch: 0, yaw: 0 };
    }
    u -= d;
  }
  return { pitch: 0, yaw: 0 };
}
