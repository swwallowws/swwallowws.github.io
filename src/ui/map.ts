/* The map at the foot of the welcome page: the landscape (landscape.ts) drawn in
   strings. Each tool is a track across the forms music takes, drawn as three fine
   strands that pinch together at its marks and shimmer a little between them; an
   input is a tick, a stop on the way a dot, the output an arrowhead. MIDI's three
   nested sets are rings, broken where their names sit.

   It moves on its own: flat for a moment, rising into the hill (the nesting as
   height), a slow half-turn, then flat again. Pointing at a track or its tool's
   name draws its strands taut while the other tools fade back; clicking glides to
   the tool's item above. A hidden list of the same links serves keyboards and
   screen readers, and focusing one draws its track taut too. Under reduced
   motion the map stays flat and still. Colours and type come from the design
   tokens and follow the theme. */

import { cssColor } from '../../vendor/design/tokens.js';
import { projects, type Category } from '../data/projects.js';
import {
  COLS, H0, HEAD_Y, LIFT, NAME_X, RING_FONT, RINGS, ROWS, X, auto, height, heightFor, proj, rowY, scaleFor,
  smooth, trackPts, xOf, type Pt, type Row, type View,
} from './landscape.js';

const PINCH = 40; // world units over which strands come together at a mark
const CATS: Category[] = ['transcribe', 'transform', 'perceive', 'workflow'];

interface Tool { row: Row; i: number; name: string; cat: Category; coming: boolean; world: Pt[]; len: number[]; nrm: [number, number][]; near: number[] }

/** Each row's points, arc length, normals and distance to its nearest mark: fixed, so worked out once. */
function tools(): Tool[] {
  return ROWS.map((row, i) => {
    const p = projects.find((x) => x.id === row.id);
    const world = trackPts(row, i);
    const len = [0];
    for (let j = 1; j < world.length; j++) len.push(len[j - 1]! + Math.hypot(world[j]![0] - world[j - 1]![0], world[j]![1] - world[j - 1]![1]));
    const nrm = world.map((_, j): [number, number] => {
      const a = world[Math.max(0, j - 1)]!, b = world[Math.min(world.length - 1, j + 1)]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    });
    const marks = row.loop ? [0, world.length - 1] : row.stops.map(([k]) => {
      const x = xOf(k);
      let best = 0;
      world.forEach(([wx], j) => { if (Math.abs(wx - x) < Math.abs(world[best]![0] - x)) best = j; });
      return best;
    });
    const near = world.map((_, j) => Math.min(...marks.map((m) => Math.abs(len[j]! - len[m]!))));
    return { row, i, name: p?.name ?? row.id, cat: p?.categories[0] ?? 'workflow', coming: !!p?.coming, world, len, nrm, near };
  });
}

type Rgb = [number, number, number];
const toRgb = (css: string): Rgb => {
  const m = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
};
const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;

export function renderMap(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'map';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A map of the tools: each one a line from what it takes in to what it gives back, across sound, tab or score, MIDI and an Ableton Live set. MIDI holds expressive MIDI, which holds microtonal.');
  box.append(canvas);
  const ctx = canvas.getContext('2d')!;

  // Probes for the category accents (cssColor reads a token inside an element).
  const probes = Object.fromEntries(CATS.map((c) => {
    const s = document.createElement('span');
    s.dataset['category'] = c;
    s.hidden = true;
    box.append(s);
    return [c, s];
  })) as Record<Category, HTMLElement>;

  const TOOLS = tools();
  // The same links, for keyboards and screen readers.
  const list = document.createElement('ul');
  list.className = 'sr-only';
  for (const t of TOOLS) {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = `#${t.row.id}`;
    a.textContent = t.name;
    a.addEventListener('click', (e) => { e.preventDefault(); go(t.row.id); });
    a.addEventListener('focus', () => { keyFocus = t.i; wake(); });
    a.addEventListener('blur', () => { keyFocus = -1; wake(); });
    li.append(a);
    list.append(li);
  }
  box.append(list);

  // ---- colours and type, from the tokens, following the theme ----
  let C = { ground: [0, 0, 0] as Rgb, ink: [0, 0, 0] as Rgb, mut: [0, 0, 0] as Rgb, line: [0, 0, 0] as Rgb, acc: {} as Record<Category, Rgb> };
  let mono = 'monospace';
  function readTokens(): void {
    C = {
      ground: toRgb(cssColor('--ground', box)), ink: toRgb(cssColor('--ink', box)),
      mut: toRgb(cssColor('--ink-mut', box)), line: toRgb(cssColor('--line', box)),
      acc: Object.fromEntries(CATS.map((c) => [c, toRgb(cssColor('--acc', probes[c]))])) as Record<Category, Rgb>,
    };
    mono = getComputedStyle(box).getPropertyValue('--font-mono').trim() || 'monospace';
  }
  new MutationObserver(() => { readTokens(); wake(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTokens(); wake(); });

  // ---- size ----
  let W = 0, S = 1, H = 0;
  function size(): void {
    W = canvas.clientWidth;
    S = scaleFor(W);
    H = heightFor(S);
    const d = devicePixelRatio || 1;
    canvas.width = Math.round(W * d);
    canvas.height = Math.round(H * d);
    canvas.style.height = `${H}px`;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  new ResizeObserver(() => { size(); wake(); }).observe(canvas);

  // ---- the pointer, the focus, and going to a tool ----
  const pointer = { x: -1e9, y: -1e9 };
  let focus = -1, keyFocus = -1;
  const taut = TOOLS.map(() => 0), presence = TOOLS.map(() => 1);
  const view: View = { pitch: 0, yaw: 0 };
  const P = (x: number, y: number, z: number) => proj(view, S, x, y, z);
  function findFocus(): number {
    if (keyFocus >= 0) return keyFocus;
    if (pointer.x < -1e8) return -1;
    let best = -1, bd = 10;
    for (const t of TOOLS) {
      const [nx, ny] = P(NAME_X, rowY(t.i), 0);
      if (pointer.x > nx - 120 * S && pointer.x < nx + 4 && Math.abs(pointer.y - ny) < 10) return t.i;
      for (const [x, y, z] of t.world) {
        const [px, py] = P(x, y, z), d = Math.hypot(px - pointer.x, py - pointer.y);
        if (d < bd) { bd = d; best = t.i; }
      }
    }
    return best;
  }
  function go(id: string): void { dispatchEvent(new CustomEvent('showcase:go', { detail: id })); }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    wake();
  });
  canvas.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e9; wake(); });
  canvas.addEventListener('click', () => { const f = findFocus(); if (f >= 0) go(TOOLS[f]!.row.id); });

  // ---- drawing ----
  function text(str: string, x: number, y: number, z: number, o: { size?: number; color: Rgb; align?: CanvasTextAlign; weight?: number; dx?: number; dy?: number; alpha?: number }): void {
    const [px, py] = P(x, y, z);
    ctx.font = `${o.weight ?? 400} ${(o.size ?? 11) * Math.max(S, 0.75)}px ${mono}`;
    ctx.textAlign = o.align ?? 'center';
    const tx = px + (o.dx ?? 0) * S, ty = py + (o.dy ?? 0) * S;
    // a halo in the ground colour, so text stays legible where lines cross it
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = rgba(C.ground, o.alpha ?? 1);
    ctx.strokeText(str, tx, ty);
    ctx.fillStyle = rgba(o.color, o.alpha ?? 1);
    ctx.fillText(str, tx, ty);
  }
  function polyline(pts: Pt[], color: string, width: number): void {
    ctx.beginPath();
    pts.forEach(([x, y, z], k) => { const [px, py] = P(x, y, z); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function drawTrack(t: Tool, sec: number, still: boolean): void {
    const want = focus === t.i ? 1 : 0, fade = focus >= 0 && focus !== t.i ? 0.3 : 1;
    taut[t.i] = still ? want : taut[t.i]! + (want - taut[t.i]!) * 0.12;
    presence[t.i] = still ? fade : presence[t.i]! + (fade - presence[t.i]!) * 0.12;
    const loose = 1 - taut[t.i]!, col = C.acc[t.cat];
    // (a tool still to come stays one dashed line: three dashed strands read as noise)
    const strands = t.coming ? [0] : [-1, 0, 1];
    ctx.setLineDash(t.coming ? [5, 5] : []);
    for (const s of strands) {
      ctx.beginPath();
      t.world.forEach(([x, y, z], j) => {
        const f = smooth(t.near[j]! / PINCH) * loose;
        const shimmer = strands.length > 1 && !still ? 1.1 * Math.sin(t.len[j]! * 0.045 + s * 2.1 + sec * 0.9 + t.i) : 0;
        const off = f * (s * 1.4 + shimmer * (s === 0 ? 0.4 : 1));
        const [px, py] = P(x + t.nrm[j]![0] * off, y + t.nrm[j]![1] * off, z);
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.strokeStyle = rgba(col, presence[t.i]!);
      // taut, the strands lie on one another and read as a single firmer line
      ctx.lineWidth = (strands.length > 1 ? 1 : 2) + taut[t.i]! * 0.6;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawMarks(t: Tool): void {
    const col = C.acc[t.cat], a = presence[t.i]!, u = Math.max(S, 0.8), y = rowY(t.i);
    const screen = t.world.map(([x, yy, z]) => P(x, yy, z));
    const unit = (p: [number, number], q: [number, number]): [number, number] => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
    const at = (x: number) => { let j = t.world.findIndex(([wx]) => wx >= x); if (j < 0) j = t.world.length - 1; return j; };
    ctx.strokeStyle = rgba(col, a); ctx.fillStyle = rgba(col, a); ctx.lineWidth = 2; ctx.lineCap = 'round';
    const tick = ([px, py]: [number, number], [dx, dy]: [number, number]) => {
      ctx.beginPath(); ctx.moveTo(px - dy * 6 * u, py + dx * 6 * u); ctx.lineTo(px + dy * 6 * u, py - dx * 6 * u); ctx.stroke();
    };
    const arrow = ([px, py]: [number, number], [dx, dy]: [number, number]) => {
      ctx.beginPath();
      ctx.moveTo(px + dx * 2 * u, py + dy * 2 * u);
      ctx.lineTo(px - dx * 9 * u - dy * 5 * u, py - dy * 9 * u + dx * 5 * u);
      ctx.lineTo(px - dx * 9 * u + dy * 5 * u, py - dy * 9 * u - dx * 5 * u);
      ctx.closePath(); ctx.fill();
    };
    if (t.row.loop) {
      const n = screen.length - 1;
      tick(screen[0]!, unit(screen[0]!, screen[2]!));
      arrow(screen[n]!, unit(screen[n - 2]!, screen[n]!));
      return;
    }
    const lastX = Math.max(...t.row.stops.map(([k]) => xOf(k)));
    for (const [k, note, input] of t.row.stops) {
      const x = xOf(k), z = height(x, y), j = at(x);
      const dir = unit(screen[Math.max(0, j - 2)]!, screen[Math.min(screen.length - 1, j + 2)]!);
      const p = P(x, y, z);
      if (input) tick(p, dir);
      else if (x === lastX) arrow(p, dir);
      else { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5 * u, 0, Math.PI * 2); ctx.fill(); }
      if (!note) continue;
      if (k === 'margin') text(note, x, y, z, { color: C.mut, size: 11.5, dx: 4, dy: 20, align: 'left', alpha: a });
      else text(note, x, y, z, { color: C.mut, size: 11.5, dy: 20, align: k === 'out' ? 'right' : 'center', alpha: a });
    }
  }

  function draw(sec: number, still: boolean): void {
    focus = findFocus();
    canvas.style.cursor = focus >= 0 ? 'pointer' : 'default';
    // which tool has the focus, for scripts/check-site.mjs (as the lamp cards report theirs)
    const fid = focus >= 0 ? TOOLS[focus]!.row.id : '';
    if (box.dataset['focus'] !== fid) box.dataset['focus'] = fid;
    ctx.clearRect(0, 0, W, H);

    // column guides on the ground, and their names along the top of the MIDI ring
    for (const [k] of COLS) polyline([[X[k], HEAD_Y + 13, 0], [X[k], H0 - 10, 0]], rgba(C.line, 1), 1);
    for (const [k, name] of COLS) text(name, X[k], HEAD_Y, 0, { color: C.ink, dy: 4 });

    // the nested sets: a faint ring at each terrace's foot once tilted, and its top,
    // broken where its name sits
    RINGS.forEach((e, i) => {
      const point = (a: number, z: number): Pt => [e.cx + Math.cos(a) * e.rx, e.cy + Math.sin(a) * e.ry, z];
      const ring = (z: number, gap = 0) => Array.from({ length: 161 }, (_, k) => point(e.at + gap + (k / 160) * (Math.PI * 2 - 2 * gap), z));
      const z = LIFT * (i + 1);
      if (view.pitch > 0.05) polyline(ring(LIFT * i), rgba(C.mut, 0.25 * Math.min(1, view.pitch * 2)), 1);
      ctx.font = `400 ${RING_FONT * Math.max(S, 0.75)}px ${mono}`;
      const w = ctx.measureText(e.name).width / S;
      const speed = Math.hypot(e.rx * Math.sin(e.at), e.ry * Math.cos(e.at));
      polyline(ring(z, (w / 2 + 8) / speed), rgba(C.mut, 0.75), 1.1);
      const [x, y] = point(e.at, z);
      // MIDI reads as one of the headings it sits level with; the inner rings stay quieter
      text(e.name, x, y, z, { color: i === 0 ? C.ink : C.mut, size: RING_FONT, dy: 4 });
    });

    // the tracks, climbing the sets they pass through, then their names and marks
    for (const t of TOOLS) {
      drawTrack(t, sec, still);
      // right-aligned just before the margin, so the name stays on its row as the map turns
      text(t.name, NAME_X, rowY(t.i), 0, { color: C.acc[t.cat], align: 'right', weight: 700, size: 12.5, dy: 4, alpha: presence[t.i]! });
      drawMarks(t);
    }
  }

  // ---- time: the loop runs while the map is on screen; reduced motion holds it flat ----
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last = 0, clock = 0, visible = false;
  function frame(ms: number): void {
    raf = 0;
    if (!C.acc.transcribe) readTokens();
    if (!W) size();
    const still = reduce.matches;
    const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0;
    last = ms;
    if (still) { view.pitch = 0; view.yaw = 0; }
    else {
      clock += dt;
      const v = auto(clock);
      view.pitch += (v.pitch - view.pitch) * 0.1;
      view.yaw += (v.yaw - view.yaw) * 0.1;
    }
    draw(clock, still);
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  function wake(): void { if (!raf) raf = requestAnimationFrame(frame); }
  new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    last = 0;
    if (visible) wake();
  }).observe(canvas);
  reduce.addEventListener('change', wake);

  // first paint once the box is in the page and the fonts are in
  requestAnimationFrame(() => { readTokens(); size(); wake(); });
  document.fonts?.ready.then(() => { readTokens(); wake(); });
  return box;
}
