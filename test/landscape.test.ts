/* The landscape map's legibility, checked across its whole loop (src/ui/landscape.ts):
   no name, heading or mark crowds a line at any moment, the two tools that never
   touch MIDI stay clear of its ring, and every row is a real project. Text widths
   are estimated (Geist Mono advances 0.6 em), at the map's width on a laptop. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS, HEAD_Y, LIFT, LOOP_S, NAME_X, RING_FONT, RINGS, ROWS, X, auto, height, proj, rowY, scaleFor, trackPts, xOf,
  type View,
} from '../src/ui/landscape.ts';
import { readFileSync } from 'node:fs';

// projects.ts reads browser globals, so its ids are read from its text here.
const projectIds = new Set(
  [...readFileSync(new URL('../src/data/projects.ts', import.meta.url), 'utf8').matchAll(/^\s+id: '([\w-]+)',$/gm)].map((m) => m[1]),
);

const S = scaleFor(1180);
const views: View[] = [];
for (let t = 0; t < LOOP_S; t += 0.25) views.push(auto(t));
const fontPx = (size: number) => size * Math.max(S, 0.75);
const box = (cx: number, baseline: number, chars: number, size: number): [number, number, number, number] => {
  const w = chars * 0.6 * fontPx(size), h = fontPx(size);
  return [cx - w / 2, baseline - h * 0.8, cx + w / 2, baseline + h * 0.2];
};
const toBox = (b: [number, number, number, number], [x, y]: [number, number]) =>
  Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));
const tracks = (v: View) => ROWS.flatMap((r, i) => trackPts(r, i).map(([x, y, z]) => ({ id: r.id, p: proj(v, S, x, y, z) })));
const ring = (v: View, e: (typeof RINGS)[number], z: number) =>
  Array.from({ length: 240 }, (_, k) => { const a = (k / 240) * Math.PI * 2; return proj(v, S, e.cx + Math.cos(a) * e.rx, e.cy + Math.sin(a) * e.ry, z); });

test('every row is a project on the site, each once', () => {
  assert.ok(projectIds.size >= 8, `found ${projectIds.size} project ids`);
  for (const r of ROWS) assert.ok(projectIds.has(r.id), r.id);
  assert.equal(new Set(ROWS.map((r) => r.id)).size, ROWS.length);
});

test('the loop starts flat, tilts, and comes back flat', () => {
  assert.deepEqual(auto(0), { pitch: 0, yaw: 0 });
  assert.ok(Math.max(...views.map((v) => v.pitch)) > 0.6);
  assert.deepEqual(auto(LOOP_S - 0.01), { pitch: 0, yaw: 0 });
});

test('each ring name stays 12 px clear of every line, all the way round the loop', () => {
  for (const v of views) {
    const pts = tracks(v);
    RINGS.forEach((e, i) => {
      const [px, py] = proj(v, S, e.cx + Math.cos(e.at) * e.rx, e.cy + Math.sin(e.at) * e.ry, LIFT * (i + 1));
      const b = box(px, py + 4 * S, e.name.length, RING_FONT);
      for (const { id, p } of pts) assert.ok(toBox(b, p) >= 12, `${e.name} is ${toBox(b, p).toFixed(1)} px from ${id} at pitch ${v.pitch.toFixed(2)}`);
    });
  }
});

test('the column headings stay 14 px clear of the MIDI ring and every line', () => {
  for (const v of views) {
    const obstacles = [...ring(v, RINGS[0]!, 0), ...ring(v, RINGS[0]!, LIFT), ...tracks(v).map((t) => t.p)];
    for (const [k, name] of COLS) {
      const [px, py] = proj(v, S, X[k], HEAD_Y, 0);
      const b = box(px, py + 4 * S, name.length, 11);
      for (const p of obstacles) assert.ok(toBox(b, p) >= 14, `${name} is ${toBox(b, p).toFixed(1)} px from a line at pitch ${v.pitch.toFixed(2)}`);
    }
  }
});

test('marks of different tools stay 30 px apart', () => {
  for (const v of views) {
    const marks = ROWS.flatMap((r, i) => r.stops.map(([k]) => {
      const x = xOf(k), y = rowY(i);
      return { id: r.id, p: proj(v, S, x, y, height(x, y)) };
    }));
    for (const a of marks) for (const b of marks) {
      if (a.id === b.id) continue;
      const d = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]);
      assert.ok(d >= 30, `${a.id} and ${b.id} marks are ${d.toFixed(1)} px apart`);
    }
  }
});

test('the tools that never touch MIDI stay 30 px clear of its ring, foot and top', () => {
  const off = ROWS.map((r, i) => [r, i] as const).filter(([r]) => !r.loop && !r.stops.some(([k]) => k === 'mid' || k === 'midL'));
  assert.deepEqual(off.map(([r]) => r.id), ['intentional', 'session-notes']);
  for (const v of views) {
    const midi = [...ring(v, RINGS[0]!, 0), ...ring(v, RINGS[0]!, LIFT)];
    for (const [r, i] of off) for (const [x, y, z] of trackPts(r, i)) {
      const p = proj(v, S, x, y, z);
      const d = Math.min(...midi.map(([mx, my]) => Math.hypot(p[0] - mx, p[1] - my)));
      assert.ok(d >= 30, `${r.id} comes ${d.toFixed(1)} px from the MIDI ring`);
    }
  }
});

test('tool names end left of every track, so names never sit on a line', () => {
  for (const r of ROWS) for (const [k] of r.stops) assert.ok(xOf(k) > NAME_X + 40, `${r.id} starts too close to its name`);
});
