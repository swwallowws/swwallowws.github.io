/* The lamp: draws one project's card in strings, on a canvas.
   A card is a bundle of strings with a rest form (the music as a musician
   knows it) and a taut form (what the tool makes of it). The lamp, a soft light
   under the pointer, pulls the strings it touches taut and shows the card's
   backdrop beneath it; a click (or Enter, or Space) plays the card, and
   everything the playhead passes turns taut, then relaxes. Text lives only in
   the lamp's label or rides with the playhead.
   Spec: docs/superpowers/specs/2026-10-05-lamp-visuals-design.md */

import { cssColor } from '../../vendor/design/tokens.js';
import { behind, clamp, lampRadius, lampWeight, mixRgb, parseRgb, playState, rgba, type Rgb } from './core.js';
import { audio } from './sound.js';

export type ColourKey = 'ground' | 'ground2' | 'ink' | 'mut' | 'line' | 'acc' | 'kick' | 'snare' | 'hats' | 'perc';
export type Point = [number, number];

const TOKENS: Record<ColourKey, string> = {
  ground: '--ground', ground2: '--ground-2', ink: '--ink', mut: '--ink-mut', line: '--line', acc: '--acc',
  kick: '--drum-kick', snare: '--drum-snare', hats: '--drum-hats', perc: '--drum-perc',
};

/** What a card's functions see each frame. Positions are in px within the card. */
export interface CardState {
  readonly el: HTMLElement;
  W: number;
  H: number;
  /** The pointer, and whether it is over the card. */
  x: number;
  y: number;
  inside: boolean;
  /** The lamp's centre: it eases toward the pointer, or wanders when idle. */
  lx: number;
  ly: number;
  /** Seconds: 0 under reduced motion, 1 in a still. */
  sec: number;
  /** The click's play (see core.ts playState). */
  p: number;
  playing: boolean;
  sweep: number;
  keep: number;
  C: Record<ColourKey, Rgb>;
  /** Differs per card, so idle lamps don't wander in step. */
  seed: number;
  /** A card's own note about the last click (Rearranged: which row). */
  row?: string;
  /** Fractions of the drawing area (inside a 22 px margin) to px, and back. */
  U(u: number): number;
  V(v: number): number;
  u(x: number): number;
  /** How strongly the lamp pulls the point (x, y) taut, 0..1 (1 everywhere under reduced motion). */
  wAt(x: number, y: number): number;
  /** As wAt, or the playhead's hold for a point it reaches at `when`. */
  lit(x: number, y: number, when: number): number;
}

/** One project's card. `rest` and `tight` give string k's point at t (0..1 along the string). */
export interface CardDef {
  id: string;
  category: 'transcribe' | 'transform' | 'perceive' | 'workflow';
  strings: number;
  points?: number;
  /** Seconds a click plays. Default 3.2. */
  dur?: number;
  /** How much thicker a fully taut string gets. Default 0.4. */
  thick?: number;
  /** Where the lamp sits in a still capture, as fractions of the card. Default the centre. */
  still?: Point;
  rest(s: CardState, k: number, t: number, sec: number): Point;
  tight(s: CardState, k: number, t: number, sec: number): Point;
  /** When the playhead reaches string k's point t (0..1). Default t. */
  when?(k: number, t: number): number;
  /** A card's own pull toward taut, besides the lamp and the playhead (YSAD's hand). */
  lift?(s: CardState, k: number, t: number): number;
  /** How intensely a piece shows (colour and thickness), given how taut it is. Default w. */
  intensity?(s: CardState, k: number, t: number, w: number): number;
  colour?(k: number): ColourKey;
  /** A string's opacity at rest. Default 0.7 for the middle string, 0.3 for the rest. */
  base?(k: number): number;
  wander?(s: CardState, sec: number): Point;
  /** What lies beneath, shown through the lamp and behind the playhead. */
  backdrop?(s: CardState, o: CanvasRenderingContext2D): void;
  /** Drawn under the strings, always (lyrics). */
  surface?(s: CardState, ctx: CanvasRenderingContext2D, sec: number): void;
  /** Drawn over the strings, always (chord symbols, hashtags, YSAD's hand). */
  over?(s: CardState, ctx: CanvasRenderingContext2D, sec: number): void;
  sweepMask?(s: CardState, o: CanvasRenderingContext2D, p: number): void;
  sweepX?(s: CardState, p: number): number;
  playhead?(s: CardState, ctx: CanvasRenderingContext2D, p: number): void;
  label?(s: CardState, x: number, y: number): string | null;
  playLabel?(s: CardState, p: number): { text: string; x: number; y: number } | null;
  /** Runs on every click, before the sound (and when there is no sound). */
  onPlay?(s: CardState): void;
  audio?(a: AudioContext, at: number, s: CardState): void;
}

const POINTS = 160, LEVELS = 8, PAD = 22, RELAX_MS = 1200, IDLE_MS = 2500;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
/** Whether the reader asked for reduced motion: then cards draw still and taut. */
export const calm = (): boolean => motionQuery.matches;

/** Sets a canvas font to the design system's mono at `px`. */
export const mono = (c: CanvasRenderingContext2D, px: number): void => {
  c.font = `${px}px "JetBrains Mono", monospace`;
};

interface Mounted {
  s: CardState;
  def: CardDef;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  off: HTMLCanvasElement;
  octx: CanvasRenderingContext2D;
  R: number;
  visible: boolean;
  last: number;
  playStart: number;
  still: boolean;
  label: string;
  playing: boolean;
  ready: boolean;
}

const mounted = new Set<Mounted>();
let running = false;

export function mountCard(host: HTMLElement, def: CardDef, opts: { label: string; still?: boolean }): { destroy(): void } {
  host.classList.add('lamp-host');
  host.dataset['category'] = def.category;
  host.dataset['label'] = '';
  host.dataset['playing'] = '0';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'button');
  canvas.setAttribute('aria-label', `${opts.label}. Press to play.`);
  host.append(canvas);
  const off = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const octx = off.getContext('2d');
  if (!ctx || !octx) throw new Error('canvas 2D is not available');

  const s: CardState = {
    el: host, W: 0, H: 0, x: 0, y: 0, inside: false, lx: 0, ly: 0, sec: 0,
    p: -1, playing: false, sweep: -1, keep: 1,
    C: {} as Record<ColourKey, Rgb>,
    seed: mounted.size * 1.7,
    U: (u) => PAD + u * (s.W - 2 * PAD),
    V: (v) => PAD + v * (s.H - 2 * PAD),
    u: (x) => (x - PAD) / (s.W - 2 * PAD),
    wAt: (x, y) => (calm() ? 1 : lampWeight(x - s.lx, y - s.ly, m.R)),
    lit: (x, y, when) => Math.max(s.wAt(x, y), s.sweep >= 0 && when <= s.sweep ? s.keep : 0),
  };
  const m: Mounted = {
    s, def, canvas, ctx, off, octx, R: 0, visible: true, last: -Infinity, playStart: -1,
    still: !!opts.still, label: '', playing: false, ready: false,
  };
  readColours(m);

  const at = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    s.x = e.clientX - r.left;
    s.y = e.clientY - r.top;
    s.inside = true;
    m.last = performance.now();
  };
  canvas.addEventListener('pointermove', at);
  canvas.addEventListener('pointerdown', at);
  canvas.addEventListener('pointerleave', () => { s.inside = false; });
  canvas.addEventListener('pointercancel', () => { s.inside = false; });
  canvas.addEventListener('click', () => play(m));
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    play(m);
  });

  const size = (): void => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width || !r.height) return;
    for (const c of [canvas, off]) {
      c.width = Math.round(r.width * d);
      c.height = Math.round(r.height * d);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    octx.setTransform(d, 0, 0, d, 0, 0);
    const first = !s.W;
    s.W = r.width;
    s.H = r.height;
    m.R = lampRadius(s.W);
    if (first) [s.lx, s.ly] = wander(m, 0);
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { m.visible = !!e?.isIntersecting; });
  io.observe(canvas);

  mounted.add(m);
  start();
  return {
    destroy(): void {
      mounted.delete(m);
      ro.disconnect();
      io.disconnect();
      canvas.remove();
    },
  };
}

function readColours(m: Mounted): void {
  for (const key of Object.keys(TOKENS) as ColourKey[]) m.s.C[key] = parseRgb(cssColor(TOKENS[key], m.s.el));
}

function start(): void {
  if (running) return;
  running = true;
  const recolour = (): void => { for (const m of mounted) readColours(m); };
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
  const frame = (ms: number): void => {
    for (const m of mounted) if (m.visible) draw(m, ms);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function play(m: Mounted): void {
  if (m.still) return;
  m.def.onPlay?.(m.s);
  const a = audio();
  if (a && m.def.audio) {
    try {
      m.def.audio(a, a.currentTime + 0.06, m.s);
    } catch {
      // The sound is a bonus: the picture plays regardless.
    }
  }
  m.playStart = performance.now() + 60;
}

function wander(m: Mounted, sec: number): Point {
  const { s, def } = m;
  if (def.wander) return def.wander(s, sec);
  const t = 0.5 + 0.4 * Math.sin(sec * 0.3 + s.seed);
  return def.rest(s, Math.floor(def.strings / 2), t, sec);
}

const sweepX = (s: CardState, p: number): number => s.U(p);

function draw(m: Mounted, ms: number): void {
  const { s, def, ctx } = m;
  const { W, H, C } = s;
  if (!W || !H) return;
  const quiet = calm();
  s.sec = m.still ? 1 : quiet ? 0 : ms / 1000;

  // Where the lamp is: fixed in a still; else easing toward the pointer, or
  // wandering when idle (and staying put under reduced motion).
  if (m.still) {
    const [u, v] = def.still ?? [0.5, 0.5];
    s.lx = u * W;
    s.ly = v * H;
  } else {
    const idle = !s.inside || ms - m.last > IDLE_MS;
    if (!(quiet && idle)) {
      const [tx, ty] = idle ? wander(m, ms / 1000) : [s.x, s.y];
      const k = idle ? 0.04 : 0.25;
      s.lx += (tx - s.lx) * k;
      s.ly += (ty - s.ly) * k;
    }
  }

  const ps = m.still || quiet ? playState(ms, -1, 1) : playState(ms, m.playStart, (def.dur ?? 3.2) * 1000, RELAX_MS);
  s.p = ps.p;
  s.playing = ps.playing;
  s.sweep = ps.sweep;
  s.keep = ps.keep;
  if (ps.playing !== m.playing) {
    m.playing = ps.playing;
    s.el.dataset['playing'] = ps.playing ? '1' : '0';
  }

  ctx.fillStyle = rgba(C.ground2, 1);
  ctx.fillRect(0, 0, W, H);
  def.surface?.(s, ctx, s.sec);
  light(m, quiet);

  // The strings: each in a few paths by how taut and intense its pieces are.
  const mid = (def.strings - 1) / 2, N = def.points ?? POINTS;
  for (let k = 0; k < def.strings; k++) {
    const paths = Array.from({ length: LEVELS + 1 }, () => new Path2D());
    let px = 0, py = 0;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const [rx, ry] = def.rest(s, k, t, s.sec);
      const [tx, ty] = def.tight(s, k, t, s.sec);
      let w = s.wAt(rx, ry);
      if (def.lift) w = Math.max(w, def.lift(s, k, t));
      if (s.sweep >= 0) w = Math.max(w, behind(def.when ? def.when(k, t) : t, s.sweep, s.keep));
      const x = rx + (tx - rx) * w, y = ry + (ty - ry) * w;
      if (i > 0) {
        const lv = Math.round(clamp(def.intensity ? def.intensity(s, k, t, w) : w, 0, 1) * LEVELS);
        const path = paths[lv]!;
        path.moveTo(px, py);
        path.lineTo(x, y);
      }
      px = x;
      py = y;
    }
    const col = C[def.colour?.(k) ?? 'acc'];
    const base = def.base ? def.base(k) : Math.abs(k - mid) < 0.6 ? 0.7 : 0.3;
    for (let lv = 0; lv <= LEVELS; lv++) {
      const w = lv / LEVELS;
      ctx.strokeStyle = rgba(mixRgb(C.mut, col, w), base + (1 - base) * w * 0.9);
      ctx.lineWidth = 1 + w * (def.thick ?? 0.4);
      ctx.stroke(paths[lv]!);
    }
  }
  def.over?.(s, ctx, s.sec);

  // The playhead and its label while playing; otherwise the lamp's label.
  let label = '';
  if (s.playing) {
    ctx.strokeStyle = rgba(C.acc, 0.55);
    ctx.lineWidth = 1;
    if (def.playhead) def.playhead(s, ctx, s.p);
    else {
      const x = (def.sweepX ?? sweepX)(s, s.p);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const pl = def.playLabel?.(s, s.p);
    if (pl) tag(s, ctx, pl.text, pl.x, pl.y, C.acc);
  } else if (def.label && (s.inside || !quiet)) {
    label = def.label(s, s.lx, s.ly) ?? '';
    if (label) tag(s, ctx, label, s.lx + m.R * 0.45, s.ly - m.R * 0.45);
  }
  if (label !== m.label) {
    m.label = label;
    s.el.dataset['label'] = label;
  }
  if (!m.ready) {
    m.ready = true;
    s.el.dataset['ready'] = '1';
  }
}

/* The backdrop shows through the lamp, and everywhere the playhead has
   passed; under reduced motion it shows whole. */
function light(m: Mounted, quiet: boolean): void {
  const { s, def, ctx, off, octx } = m;
  const backdrop = def.backdrop;
  if (!backdrop) return;
  const { W, H } = s;
  const pass = (mask: (() => void) | null): void => {
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, W, H);
    backdrop(s, octx);
    if (mask) {
      octx.globalCompositeOperation = 'destination-in';
      mask();
    }
    ctx.drawImage(off, 0, 0, W, H);
  };
  if (quiet) {
    pass(null);
    return;
  }
  pass(() => {
    const g = octx.createRadialGradient(s.lx, s.ly, m.R * 0.4, s.lx, s.ly, m.R * 1.1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(0, 0, W, H);
  });
  if (s.sweep >= 0 && s.keep > 0) {
    pass(() => {
      octx.fillStyle = `rgba(0,0,0,${s.keep})`;
      if (def.sweepMask) def.sweepMask(s, octx, s.sweep);
      else {
        octx.beginPath();
        octx.rect(0, 0, (def.sweepX ?? sweepX)(s, s.sweep), H);
      }
      octx.fill();
    });
  }
}

/** A small label on a ground-coloured strip, kept inside the card. */
function tag(s: CardState, c: CanvasRenderingContext2D, text: string, x: number, y: number, colour: Rgb = s.C.ink): void {
  mono(c, 10);
  const tw = c.measureText(text).width;
  const cx = clamp(x, 4, Math.max(4, s.W - tw - 8));
  const cy = clamp(y, 12, s.H - 6);
  c.fillStyle = rgba(s.C.ground2, 0.92);
  c.fillRect(cx - 3, cy - 10, tw + 6, 14);
  c.fillStyle = rgba(colour, 1);
  c.fillText(text, cx, cy);
}
