/* The map: each symbol is a form music takes, each curve a tool. Three bands
   run left to right: where music starts, what it becomes, where it lands;
   a quieter lane underneath holds the tools that work around the music.
   MIDI sits in the middle as one symbol with an outer ring: curves that
   carry expression (glides, bends, vibrato, any tuning) land on the ring,
   plain MIDI lands in the centre. It moves like still water: symbols settle
   with push-pull forces (curves are springs, symbols repel), then drift on a
   slow shared current; a touched symbol sends one soft ripple, and ripples
   that meet interfere. Resting on something reads it in a card attached
   beside it and keeps its name afterwards; clicking a curve goes to that
   tool's item on the welcome page. Fully still under reduced motion. */

import {
  AudioWaveform, ChartGantt, CircleGauge, Dices, Disc3, Drum, FileAudio, FileText, FolderOpen,
  Guitar, LayoutGrid, ListMusic, Mic, MicVocal, Music, NotebookPen, Piano, Search, Shuffle, Smartphone, Sparkles,
  type IconNode,
} from 'lucide';
import { projects, type Category } from '../data/projects.js';
import { patternDots } from './glyphs.js';

// ---- content ---------------------------------------------------------------------

// Tool display names live here only: the keys are what the map shows.
interface Tool {
  cat: Category;
  project?: string; // project id, for the page link
  coming?: boolean;
  does: string;
}
const TOOLS: Record<string, Tool> = {
  Starling: { cat: 'transcribe', project: 'voxmpe', does: 'Sing, get expressive MIDI that keeps every glide, in any tuning.' },
  'Coming Undone': { cat: 'transcribe', project: 'stemscribe', does: 'Split a recording into its parts and write each one down as MIDI.' },
  Rearranged: { cat: 'transform', project: 'rearranged', does: 'Rearrange songs in the style of another.' },
  'Ready Set': { cat: 'transform', project: 'tabridge', does: 'Search for a piece and get a playable Ableton Live set and its MIDI, with the slides, bends and vibrato from the tab kept as expression.' },
  'YSAD': { cat: 'transform', project: 'ysad', does: 'A pattern generator you play live: pick a style, shape it, fine-tune it hit by hit. The same beat can play drums, a synth, a sample or visuals.' },
  'Session Notes': { cat: 'workflow', project: 'session-notes', does: 'Notes that live with the set. Lyrics that land on the arrangement.' },
  Tagline: { cat: 'workflow', project: 'intentional', does: 'A plain-text music library whose tags travel inside the audio files.' },
  Odoroki: { cat: 'perceive', project: 'odoroki', coming: true, does: 'Live visuals that react when the music surprises you. Coming.' },
};

// Where a symbol sits, left to right: where music starts, what it becomes,
// where it lands; or the lane below, around the music. (Layout only, not shown.)
type Band = 'start' | 'becomes' | 'lands' | 'around';

interface MapNode {
  at: [number, number];
  band: Band;
  icon?: IconNode;
  glyph?: 'pattern';
  cap: string;
  explain: string;
  r: number; // drawn radius, where curves land
  body?: number; // radius the physics and the card use, when bigger than r (MIDI with its ring)
  ringOf?: string; // a ring drawn around another symbol, moving with it as one body
  side?: boolean; // caption to the right (the stacked stems)
  // simulation state
  x: number; y: number; vx: number; vy: number; hx: number; hy: number;
  fx: number; fy: number; bias: [number, number]; hold: number;
}
type NodeSpec = Pick<MapNode, 'at' | 'band' | 'cap' | 'explain'> & Partial<Pick<MapNode, 'icon' | 'glyph' | 'r' | 'body' | 'ringOf' | 'side'>>;

const CORE = 30, HALO = 62; // MIDI's centre and its expressive ring

const SPECS: Record<string, NodeSpec> = {
  // where music starts
  voice: { at: [80, 30], band: 'start', icon: Mic, cap: 'singing', explain: 'A sung phrase, straight from a mic.' },
  search: { at: [80, 140], band: 'start', icon: Search, cap: 'a search', explain: 'A song name. Ready Set finds a free score to start from.' },
  recording: { at: [80, 390], band: 'start', icon: AudioWaveform, cap: 'a recording', explain: 'A finished song, as audio. Coming Undone splits it into parts: one track for each part of the band.' },
  dice: { at: [80, 560], band: 'start', icon: Dices, cap: 'a style', explain: 'One of fifteen, each with its own time signature: house, boom-bap, breaks, half-time, trap, techno, funk and garage in 4/4, then a waltz and grooves in 5/8, 6/8, 7/8, 9/8 and 12/8.' },
  knobs: { at: [80, 640], band: 'start', icon: CircleGauge, cap: 'knobs', explain: 'Ableton Push’s knobs: how busy each drum is, intensity, swing and which take.' },
  // what it becomes
  drums: { at: [300, 290], band: 'becomes', r: 21, side: true, icon: Drum, cap: 'drums', explain: 'The drums, split out of the recording.' },
  bass: { at: [300, 357], band: 'becomes', r: 21, side: true, icon: Guitar, cap: 'bass', explain: 'The bass line, on its own.' },
  vocals: { at: [300, 424], band: 'becomes', r: 21, side: true, icon: MicVocal, cap: 'vocals', explain: 'The voice, on its own.' },
  other: { at: [300, 491], band: 'becomes', r: 21, side: true, icon: Music, cap: 'the rest', explain: 'Everything else: guitars, keys, pads.' },
  pattern: { at: [320, 610], band: 'becomes', r: 34, glyph: 'pattern', cap: 'a drum pattern', explain: 'A beat laid around a circle, on Ableton Push’s pads. Turn a knob and the generator rewrites it, as often as asked.' },
  expressive: { at: [560, 170], band: 'becomes', r: HALO, ringOf: 'midi', cap: 'expressive MIDI',
    explain: 'MIDI where each note keeps its own glides, bends, vibrato and loudness (the standard for this is called MPE), in the usual twelve notes or any other tuning, like Turkish makam’s. It always plays as plain MIDI too, so any instrument or music program can use it.' },
  midi: { at: [560, 170], band: 'becomes', r: CORE, body: HALO, icon: Piano, cap: 'MIDI',
    explain: 'Music written down as notes a computer can play: which note, when, how long and how loud, on a real bar grid. It holds no sound itself, so any instrument can play it.' },
  second: { at: [600, 430], band: 'becomes', icon: ListMusic, cap: 'a second song', explain: 'The song whose band habits get borrowed: its picking, strumming, bass and drums.' },
  // where it lands
  liveset: { at: [860, 40], band: 'lands', icon: LayoutGrid, cap: 'an Ableton Live set', explain: 'A multi-track Ableton Live set: named tracks, a clip per section, the tempo and instruments, ready to play. Slides, bends and vibrato come through as expression.' },
  visuals: { at: [860, 210], band: 'lands', icon: Sparkles, cap: 'live visuals', explain: 'Visuals that react when the music surprises you.' },
  style: { at: [860, 400], band: 'lands', icon: Shuffle, cap: 'one song in the other’s style', explain: 'The first song’s chords, played the way the second song’s band would, never copying its notes.' },
  // around the music
  notes: { at: [560, 804], band: 'around', r: 23, icon: NotebookPen, cap: 'notes and lyrics', explain: 'Lyrics, ideas and to-dos in Markdown (plain text with light formatting), inside Ableton Live 12.' },
  folder: { at: [860, 758], band: 'around', r: 23, icon: FolderOpen, cap: 'saved with the set', explain: 'Set notes save into the set’s folder and travel with it; global notes are there in every set.' },
  arrangement: { at: [860, 851], band: 'around', r: 23, icon: ChartGantt, cap: 'on the arrangement', explain: 'A lyric line tagged [17] or [1:04] lands right there, as a locator or a clip.' },
  phone: { at: [80, 935], band: 'around', r: 23, icon: Smartphone, cap: 'a shared link', explain: 'A link shared from the phone, with a few words on why it caught the ear.' },
  note: { at: [340, 935], band: 'around', r: 23, icon: FileText, cap: 'a note', explain: 'One Markdown note per track, tagged and triaged in Obsidian.' },
  tagged: { at: [600, 935], band: 'around', r: 23, icon: FileAudio, cap: 'a tagged file', explain: 'The tags, written into the audio file itself.' },
  djuced: { at: [860, 935], band: 'around', r: 23, icon: Disc3, cap: 'in the DJ set', explain: 'Searchable by tag in your DJ software (DJUCED, for one), mid-set.' },
};

interface EdgeSpec {
  a: string;
  b: string;
  tool: string;
  label?: string;
  labelDx?: number; // nudges the label along x, where a short curve would crowd it
  note?: string;
  under?: boolean;
  loop?: boolean;
}
const EDGES: EdgeSpec[] = [
  { a: 'voice', b: 'expressive', tool: 'Starling', label: 'Starling' },
  { a: 'search', b: 'expressive', tool: 'Ready Set', label: 'Ready Set' },
  { a: 'expressive', b: 'liveset', tool: 'Ready Set' },
  ...['drums', 'bass', 'vocals', 'other'].flatMap((s): EdgeSpec[] => [
    { a: 'recording', b: s, tool: 'Coming Undone', ...(s === 'drums' ? { label: 'Coming Undone', labelDx: -26 } : {}) },
    { a: s, b: 'midi', tool: 'Coming Undone' },
  ]),
  // The name is too long for the short curves in from the dice and knobs, so it hangs under the loop.
  { a: 'dice', b: 'pattern', tool: 'YSAD' },
  { a: 'knobs', b: 'pattern', tool: 'YSAD' },
  { a: 'pattern', b: 'pattern', tool: 'YSAD', label: 'YSAD', loop: true, note: 'YSAD rewrites the pattern as the knobs turn, bar after bar.' },
  { a: 'pattern', b: 'midi', tool: 'YSAD', note: 'YSAD plays the beat into Ableton Live as MIDI, live from Ableton Push, for drums, a synth, a sample or visuals.' },
  { a: 'midi', b: 'visuals', tool: 'Odoroki', label: 'Odoroki, coming' },
  { a: 'midi', b: 'style', tool: 'Rearranged', label: 'Rearranged' },
  { a: 'second', b: 'style', tool: 'Rearranged' },
  // The endpoints' captions name Session Notes' two features, so the curves just name the tool.
  { a: 'notes', b: 'folder', tool: 'Session Notes', label: 'Session Notes', note: 'Notes that live with the set: saved in its folder, plus global notes for every project.' },
  { a: 'notes', b: 'arrangement', tool: 'Session Notes', note: 'Lyrics that land on the arrangement: tag a line and it goes there.' },
  { a: 'phone', b: 'note', tool: 'Tagline', label: 'Tagline' },
  { a: 'note', b: 'tagged', tool: 'Tagline' },
  { a: 'tagged', b: 'djuced', tool: 'Tagline' },
];

// ---- tuning ----------------------------------------------------------------------------

const R = 28, HIT_PAD = 24, SMALL = 25;
// The settle holds symbols near home firmly enough that the three bands stay columns.
const K = { spring: 0.035, repel: 2600, gap: 20, flow: 0.12, home: 0.06, damp: 0.78 };
const LIVE = { spring: 0.03, home: 0.01, damp: 0.8 }; // water: settles without bounce
const DWELL_MS = 350, LEAVE_MS = 220, RIPPLE_S = 2.6;

const NS = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text != null) n.textContent = text;
  return n;
}

// ---- the map -----------------------------------------------------------------------------

export function renderMap(): HTMLElement {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const NODES: Record<string, MapNode> = {};
  for (const [id, spec] of Object.entries(SPECS)) {
    const hx = spec.at[0] * 0.72, hy = spec.at[1] * 0.72; // homes, pulled closer together
    NODES[id] = { ...spec, r: spec.r ?? R, x: hx, y: hy, vx: 0, vy: 0, hx, hy, fx: 0, fy: 0, bias: [0, 0], hold: 0 };
  }
  const N = (id: string) => NODES[id]!;
  // A ring is drawn and read on its own but moves with the symbol it circles.
  const bodyOf = (id: string) => N(N(id).ringOf ?? id);
  const B = (n: MapNode) => n.body ?? n.r;
  const IDS = Object.keys(NODES).filter((id) => !N(id).ringOf);
  const BODIES = IDS.map(N);
  const SPRINGS = EDGES.filter((e) => !e.loop);
  const syncRings = () => { for (const n of Object.values(NODES)) if (n.ringOf) { const b = N(n.ringOf); n.x = b.x; n.y = b.y; n.hx = b.hx; n.hy = b.hy; } };

  // Push-pull: curves pull like springs, symbols repel (strongly up close),
  // curves are nudged to run left to right, and a weak tie holds each symbol
  // near its home so the reading order survives.
  function accumulate(): void {
    for (const n of BODIES) { n.fx = n.bias[0]; n.fy = n.bias[1]; }
    for (let i = 0; i < BODIES.length; i++) {
      const p = BODIES[i]!;
      for (let j = i + 1; j < BODIES.length; j++) {
        const q = BODIES[j]!;
        let dx = q.x - p.x, dy = q.y - p.y;
        // Small symbols (the stems) may stack closer; they'd zigzag otherwise.
        const pair = p.r < SMALL && q.r < SMALL ? 0.3 : 1;
        const d = Math.hypot(dx, dy) || 0.01, min = B(p) + B(q) + K.gap * pair;
        let f = (K.repel * pair) / (d * d);
        if (d < min) f += (min - d) * 0.5;
        dx /= d; dy /= d;
        p.fx -= dx * f; p.fy -= dy * f; q.fx += dx * f; q.fy += dy * f;
      }
    }
    for (const e of SPRINGS) {
      const p = bodyOf(e.a), q = bodyOf(e.b);
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      // In the lane the curves keep their drawn length, so it spans the bands above.
      const L = p.band === 'around' ? Math.hypot(p.hx - q.hx, p.hy - q.hy) : B(p) + B(q) + (p.r < SMALL || q.r < SMALL ? 70 : 110);
      const f = (d - L) * K.spring;
      p.fx += (dx / d) * f; p.fy += (dy / d) * f; q.fx -= (dx / d) * f; q.fy -= (dy / d) * f;
      const lag = p.x + B(p) + B(q) + 50 - q.x;
      if (lag > 0) { p.fx -= lag * K.flow; q.fx += lag * K.flow; }
    }
    for (const n of BODIES) { n.fx += (n.hx - n.x) * K.home; n.fy += (n.hy - n.y) * K.home; }
  }
  function step(extra?: (n: MapNode) => void): void {
    accumulate();
    for (const n of BODIES) {
      extra?.(n);
      n.vx = (n.vx + n.fx) * K.damp; n.vy = (n.vy + n.fy) * K.damp;
      n.x += n.vx; n.y += n.vy;
    }
  }
  for (let it = 0; it < 900; it++) step();
  // Settled spots become homes; the leftover push there is cancelled so the
  // live water rests exactly where the layout settled.
  for (const n of BODIES) { n.hx = n.x; n.hy = n.y; n.vx = n.vy = 0; }
  Object.assign(K, LIVE);
  accumulate();
  for (const n of BODIES) n.bias = [-n.fx, -n.fy];
  // Crop the drawing to where the symbols landed, with a little room around.
  const xs = BODIES.flatMap((n) => [n.x - B(n), n.x + B(n)]);
  const ys = BODIES.flatMap((n) => [n.y - B(n), n.y + B(n)]);
  const minX = Math.min(...xs) - 30, minY = Math.min(...ys) - 24;
  for (const n of BODIES) { n.x -= minX; n.y -= minY; n.hx -= minX; n.hy -= minY; }
  syncRings();
  const W = Math.max(...xs) - minX + 150, H = Math.max(...ys) - minY + 40;

  // ---- drawing -------------------------------------------------------------------------
  const stage = document.createElement('div');
  stage.className = 'map';
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'graph',
    'aria-label': 'Map of the tools. Tab to a symbol to read about it.' });
  // Rings sit under the curves, so plain-MIDI curves visibly cross them to the centre.
  const bandLayer = s('g', { class: 'bands', 'aria-hidden': 'true' });
  const rippleLayer = s('g'), ringLayer = s('g'), edgeLayer = s('g'), nodeLayer = s('g');
  svg.append(bandLayer, rippleLayer, ringLayer, edgeLayer, nodeLayer);
  const card = document.createElement('div');
  card.className = 'map-card gone';
  const readout = document.createElement('p');
  readout.className = 'sr';
  readout.setAttribute('role', 'status');
  readout.setAttribute('aria-live', 'polite');
  stage.append(svg, card, readout);

  // A thin line above the lane (the tools around the music). No captions: the
  // symbols and the card say what they are.
  {
    const main = BODIES.filter((n) => n.band !== 'around'), lane = BODIES.filter((n) => n.band === 'around');
    // The drum pattern's loop and its label hang below it, so the rule clears those too.
    const pat = N('pattern');
    const top = Math.max(...main.map((n) => n.y + B(n) + 20), pat.y + pat.r + 68), bottom = Math.min(...lane.map((n) => n.y - B(n)));
    const y = (top + bottom) / 2 - 4;
    bandLayer.append(s('line', { class: 'lane-rule', x1: 12, x2: W - 12, y1: y, y2: y }));
  }

  const icon = (node: IconNode, size: number) => {
    const g = s('svg', { x: -size / 2, y: -size / 2, width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'var(--ink)', 'stroke-width': 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    // Lucide icons are ["svg", attrs, children] (older builds: just the children).
    const raw = node as unknown as readonly unknown[];
    const children = (Array.isArray(raw[0]) ? raw : ((raw[2] as readonly unknown[]) ?? [])) as readonly [string, Record<string, string>][];
    for (const [tag, attrs] of children) g.append(s(tag as keyof SVGElementTagNameMap, attrs));
    return g;
  };
  // yousuckatdrums: sixteen steps around a circle, some hits lit.
  // Geometry shared with the card symbol: src/ui/glyphs.ts.
  const glyphPattern = (k: number) => {
    const g = s('g', { transform: `scale(${k})`, 'data-category': 'transform' });
    for (const d of patternDots()) g.append(s('circle', { cx: d.cx, cy: d.cy, r: d.r, fill: d.hit ? 'var(--acc)' : 'var(--line)' }));
    g.append(s('circle', { cx: 0, cy: 0, r: 1.8, fill: 'var(--ink)' }));
    return g;
  };
  // The expressive ring: a faint band around MIDI's centre, a line in it that
  // wavers like vibrato, and its name along the top. The band itself goes under
  // the curves; its outline, name and hit area go with the symbols.
  const inner = CORE + 3;
  const mid = (inner + HALO) / 2;
  const ringBand = (outer: number) =>
    `M${outer},0 A${outer},${outer} 0 1,0 ${-outer},0 A${outer},${outer} 0 1,0 ${outer},0 Z ` +
    `M${inner},0 A${inner},${inner} 0 1,1 ${-inner},0 A${inner},${inner} 0 1,1 ${inner},0 Z`;
  const vibrato = () => {
    // From the right of the name, round the bottom, to its left: angles in degrees, 0 = right, 90 = down.
    // Like a held note: it starts level, the vibrato swells, then settles again.
    let d = '';
    for (let a = -28; a <= 208; a += 2) {
      const u = (a + 28) / 236, t = (a * Math.PI) / 180, rr = mid + Math.sin(a * 0.3) * 2.6 * Math.sin(Math.PI * u);
      d += `${d ? 'L' : 'M'}${(Math.cos(t) * rr).toFixed(1)},${(Math.sin(t) * rr).toFixed(1)}`;
    }
    return d;
  };
  const ringUnder = (n: MapNode) => {
    const g = s('g', { class: 'node ring-body' });
    g.append(s('path', { class: 'band-fill', d: ringBand(n.r), 'fill-rule': 'evenodd' }));
    g.append(s('path', { class: 'wave', d: vibrato(), fill: 'none', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
    return g;
  };

  // ---- state -------------------------------------------------------------------------------
  type What = { node: string } | { edge: EdgeRec } | null;
  interface EdgeRec extends EdgeSpec { i: number; g: SVGGElement; line: SVGPathElement; dot: SVGCircleElement; hit: SVGPathElement; lbl: SVGTextElement | null; geo?: Geo }
  interface Geo { d: string; ex: number; ey: number; lx: number; ly: number }
  let current: What = null, pinned: What = null, side: string | null = null, litNow = new Set<string>();
  let now = 0, lastPointer = 'mouse';
  let dwellTimer: number | undefined, leaveTimer: number | undefined;
  const dwell = (fn: () => void) => { clearTimeout(dwellTimer); dwellTimer = window.setTimeout(fn, DWELL_MS); };
  const undwell = () => clearTimeout(dwellTimer);
  const leaveSoon = () => { clearTimeout(leaveTimer); leaveTimer = window.setTimeout(() => show(pinned), LEAVE_MS); };

  // ---- nodes ---------------------------------------------------------------------------------
  const nodeEls: Record<string, SVGGElement[]> = {}; // the symbol, plus a ring's under-layer
  for (const [id, n] of Object.entries(NODES)) {
    const g = s('g', { class: `node${n.band === 'around' ? ' lane' : ''}${n.ringOf ? ' halo' : ''}`, tabindex: 0, role: 'button', 'aria-label': `${n.cap}: ${n.explain}` });
    const els = [g];
    if (n.ringOf) {
      // Its own hit area: the band between the centre and just past the outline.
      g.append(s('path', { class: 'hit', d: ringBand(n.r + 12), 'fill-rule': 'evenodd', fill: 'transparent' }));
      g.append(s('circle', { class: 'ring', r: n.r, fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.5 }));
      const arcId = `map-arc-${id}`, a0 = (208 * Math.PI) / 180, a1 = (-28 * Math.PI) / 180, ar = mid - 3.5;
      g.append(s('path', { id: arcId, d: `M${Math.cos(a0) * ar},${Math.sin(a0) * ar} A${ar},${ar} 0 0,1 ${Math.cos(a1) * ar},${Math.sin(a1) * ar}`, fill: 'none' }));
      const t = s('text', { class: 'ring-name', 'font-size': 10.5 });
      t.append(s('textPath', { href: `#${arcId}`, startOffset: '50%', 'text-anchor': 'middle' }, 'expressive'));
      g.append(t);
      const under = ringUnder(n);
      ringLayer.append(under);
      els.push(under);
    } else {
      g.append(s('circle', { class: 'hit', r: n.body ? n.r + 4 : n.r + HIT_PAD, fill: 'transparent' }));
      g.append(s('circle', { class: 'ring', r: n.r, fill: 'var(--ground-2)', stroke: 'var(--line)', 'stroke-width': 1.5 }));
      g.append(n.glyph === 'pattern' ? glyphPattern(n.r / 30) : icon(n.icon!, n.r < SMALL ? 18 : 26));
      const below = B(n) + 16;
      g.append(s('text', { class: 'cap', x: n.side ? n.r + 7 : 0, y: n.side ? 4.5 : below,
        'text-anchor': n.side ? 'start' : 'middle', 'font-size': 12.5 }, n.cap));
    }
    nodeLayer.append(g);
    nodeEls[id] = els;
    g.addEventListener('mouseenter', () => { show({ node: id }); ripple(id); dwell(() => g.classList.add('found')); });
    g.addEventListener('mouseleave', () => { undwell(); leaveSoon(); });
    g.addEventListener('focus', () => { show({ node: id }); g.classList.add('found'); });
    g.addEventListener('blur', () => show(pinned));
    g.addEventListener('click', (e) => { e.stopPropagation(); g.classList.add('found'); pin({ node: id }); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Escape') { pinned = null; show(null); g.blur(); } });
  }
  svg.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });

  // ---- edges ---------------------------------------------------------------------------------
  // A curve leads to its tool's item on the welcome page (above the map).
  const pageOf = (tool: Tool) => (tool.project && projects.some((x) => x.id === tool.project) ? `#${tool.project}` : null);
  const edgeEls: EdgeRec[] = EDGES.map((e, i) => {
    const t = TOOLS[e.tool]!;
    const page = pageOf(t);
    const lane = N(e.a).band === 'around';
    const g = s('g', { class: `edge${lane ? ' lane' : ''}`, 'data-category': t.cat });
    const a = page ? s('a', { href: page }) : s('g');
    const line = s('path', { class: 'line', fill: 'none', stroke: 'var(--acc)', 'stroke-width': lane ? 2 : 2.6, 'stroke-linecap': 'round',
      ...(t.coming ? { 'stroke-dasharray': '2 7' } : {}) });
    const dot = s('circle', { class: 'end', r: lane ? 3 : 3.5, fill: 'var(--acc)' });
    const hit = s('path', { class: 'hit', fill: 'none', stroke: 'transparent', 'stroke-width': 20 });
    a.append(line, dot, hit);
    g.append(a);
    const lbl = e.label ? s('text', { class: 'lbl', 'text-anchor': 'middle', fill: 'var(--acc)', 'font-size': lane ? 13 : 14, 'font-weight': 700 }, e.label) : null;
    if (lbl) g.append(lbl);
    edgeLayer.append(g);
    const rec: EdgeRec = { ...e, i, g, line, dot, hit, lbl };
    hit.addEventListener('mouseenter', () => { show({ edge: rec }); dwell(() => discoverTool(e.tool)); });
    hit.addEventListener('mouseleave', () => { undwell(); leaveSoon(); });
    // Click goes to the tool's item on the welcome page; on touch the first
    // tap only shows the card.
    a.addEventListener('click', (ev) => {
      ev.stopPropagation();
      discoverTool(e.tool);
      const already = pinned && 'edge' in pinned && pinned.edge === rec;
      if (!page || (lastPointer !== 'mouse' && !already)) { ev.preventDefault(); pin({ edge: rec }); return; }
      // The page glides to the item itself (centred, eased), so the link's
      // default jump is replaced; the address still updates.
      ev.preventDefault();
      dispatchEvent(new CustomEvent('showcase:go', { detail: t.project }));
    });
    return rec;
  });
  const discoverTool = (tool: string) => { for (const r of edgeEls) if (r.tool === tool) r.g.classList.add('found'); };

  // ---- geometry and rendering ------------------------------------------------------------------
  function geometry(rec: EdgeRec): Geo {
    const p = N(rec.a), q = N(rec.b);
    const px = p.x, py = p.y;
    if (rec.loop) {
      // Below the pattern, clear of the curve that leaves it for MIDI.
      const r = p.r, sx = px + r * 0.8, sy = py + r * 0.6, ex = px - r * 0.8, ey = py + r * 0.6;
      return { d: `M${sx},${sy} C${px + r + 34},${py + r + 54} ${px - r - 34},${py + r + 54} ${ex},${ey}`, ex, ey, lx: px, ly: py + r + 62 };
    }
    const ang = Math.atan2(q.y - py, q.x - px);
    const sx = px + Math.cos(ang) * (p.r + 3), sy = py + Math.sin(ang) * (p.r + 3);
    const ex = q.x - Math.cos(ang) * (q.r + 5), ey = q.y - Math.sin(ang) * (q.r + 5);
    const dx = (ex - sx) * 0.5;
    const sway = reduce.matches ? 0 : Math.sin(now * 0.3 + rec.i * 1.3) * 5; // reeds
    const mx = 0.5 * sx + 0.5 * ex, my = 0.5 * sy + 0.5 * ey + sway * 0.75;
    return { d: `M${sx},${sy} C${sx + dx},${sy + sway} ${ex - dx},${ey + sway} ${ex},${ey}`, ex, ey, lx: mx + (rec.labelDx ?? 0), ly: rec.under ? my + 20 : my - 9 };
  }
  function render(): void {
    syncRings();
    for (const [id, n] of Object.entries(NODES)) for (const el of nodeEls[id]!) el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
    for (const rec of edgeEls) {
      const gm = geometry(rec);
      rec.geo = gm;
      rec.line.setAttribute('d', gm.d);
      rec.hit.setAttribute('d', gm.d);
      rec.dot.setAttribute('cx', String(gm.ex));
      rec.dot.setAttribute('cy', String(gm.ey));
      if (rec.lbl) { rec.lbl.setAttribute('x', String(gm.lx)); rec.lbl.setAttribute('y', String(gm.ly)); }
    }
    placeCard();
  }

  // ---- ripples: one faint ring when a symbol is touched ------------------------------------------
  const ripples: { n: MapNode; ring: SVGCircleElement; t0: number }[] = [];
  function ripple(id: string): void {
    if (reduce.matches) return;
    const ring = s('circle', { fill: 'none', stroke: 'var(--ink-mut)', 'stroke-width': 1, opacity: 0 });
    rippleLayer.append(ring);
    ripples.push({ n: bodyOf(id), ring, t0: now });
  }
  function drawRipples(time: number): void {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]!;
      const k = (time - rp.t0) / RIPPLE_S;
      if (k >= 1) { rp.ring.remove(); ripples.splice(i, 1); continue; }
      const e = 1 - (1 - k) ** 3, r = B(rp.n) + 4 + e * 50, o = 0.22 * (1 - k);
      rp.ring.setAttribute('cx', String(rp.n.x)); rp.ring.setAttribute('cy', String(rp.n.y));
      rp.ring.setAttribute('r', String(r)); rp.ring.setAttribute('opacity', o.toFixed(3));
    }
  }

  // ---- motion: still, flowing water ------------------------------------------------------------------
  let mouse: { x: number; y: number } | null = null, last: { x: number; y: number } | null = null;
  const pv = { x: 0, y: 0 };
  const toMap = (e: PointerEvent) => { const m = svg.getScreenCTM()!; return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d }; };
  svg.addEventListener('pointermove', (e) => { mouse = toMap(e); });
  svg.addEventListener('pointerleave', () => { mouse = null; });

  function frame(t: number): void {
    const time = t / 1000;
    now = time;
    drawRipples(time);
    if (mouse && last) { pv.x = pv.x * 0.6 + (mouse.x - last.x) * 0.4; pv.y = pv.y * 0.6 + (mouse.y - last.y) * 0.4; }
    else { pv.x *= 0.6; pv.y *= 0.6; }
    last = mouse ? { ...mouse } : null;
    step((n) => {
      const m = B(n) + 8; // soft walls
      if (n.x < m) n.fx += (m - n.x) * 0.2;
      if (n.x > W - m) n.fx -= (n.x - (W - m)) * 0.2;
      if (n.y < m) n.fy += (m - n.y) * 0.2;
      if (n.y > H - m) n.fy -= (n.y - (H - m)) * 0.2;
      // The symbol being read is held nearly still, and let go slowly after.
      const target = current && 'node' in current && bodyOf(current.node) === n ? 1 : 0;
      n.hold += (target - n.hold) * (target ? 0.15 : 0.018);
      const free = 1 - n.hold, c = 1 - 0.65 * n.hold;
      // A slow current neighbours share, like leaves on a still pond: barely there.
      n.fx += Math.sin(time * 0.09 + n.hx * 0.006 + n.hy * 0.002) * 0.014 * c;
      n.fy += Math.cos(time * 0.07 + n.hy * 0.006 - n.hx * 0.002) * 0.014 * c;
      n.vx *= 1 - 0.15 * n.hold; n.vy *= 1 - 0.15 * n.hold;
      // A hand through water: only movement stirs, and only gently.
      if (mouse && free > 0.02) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy), speed = Math.hypot(pv.x, pv.y);
        if (d < 140 && speed > 1.2) {
          const k = (1 - d / 140) ** 2 * Math.min(speed, 12) * 0.01 * free;
          n.fx += (dx / (d || 1)) * k + pv.x * 0.003 * free;
          n.fy += (dy / (d || 1)) * k + pv.y * 0.003 * free;
        }
      }
    });
    render();
    if (!reduce.matches && stage.isConnected) requestAnimationFrame(frame);
  }
  reduce.addEventListener('change', () => { if (!reduce.matches) requestAnimationFrame(frame); else render(); });

  // ---- the card, attached to what's being explored --------------------------------------------------
  const GAP = 12;
  function anchor(what: Exclude<What, null>) {
    if ('node' in what) { const n = N(what.node); return { x: n.x, y: n.y, r: B(n) + 6 }; }
    const g = what.edge.geo ?? geometry(what.edge);
    return { x: g.lx, y: g.ly, r: 14 };
  }
  function box(sideName: string, a: { x: number; y: number; r: number }, wv: number, hv: number): [number, number] {
    if (sideName === 'right') return [a.x + a.r + GAP, a.y - hv / 2];
    if (sideName === 'left') return [a.x - a.r - GAP - wv, a.y - hv / 2];
    if (sideName === 'below') return [a.x - wv / 2, a.y + a.r + GAP + 10];
    return [a.x - wv / 2, a.y - a.r - GAP - hv];
  }
  // Pick the side that covers the fewest symbols; covering the thing's own
  // connections (lit) costs five times more. Captions count as part of a symbol.
  function chooseSide(a: { x: number; y: number; r: number }, wv: number, hv: number): string {
    let best = 'right', bestScore = Infinity;
    for (const name of ['right', 'left', 'below', 'above']) {
      const [x, y] = box(name, a, wv, hv);
      let score = x < 0 || y < 0 || x + wv > W || y + hv > H ? 1e6 : 0;
      for (const [id, n] of Object.entries(NODES)) {
        const r = B(n);
        const top = n.y - r, bottom = n.y + r + (n.side ? 0 : 20);
        const left = n.x - r - (n.side ? 0 : 30), right = n.x + r + (n.side ? 60 : 30);
        const ox = Math.max(0, Math.min(x + wv, right) - Math.max(x, left));
        const oy = Math.max(0, Math.min(y + hv, bottom) - Math.max(y, top));
        score += ox * oy * (litNow.has(id) ? 5 : 1);
      }
      if (score < bestScore) { bestScore = score; best = name; }
    }
    return best;
  }
  function placeCard(): void {
    if (!current) return; // a fading card stays where it was
    const m = svg.getScreenCTM();
    if (!m) return;
    const sb = stage.getBoundingClientRect(), scale = m.a;
    const wv = card.offsetWidth / scale, hv = card.offsetHeight / scale;
    const a = anchor(current);
    side ??= chooseSide(a, wv, hv);
    let [x, y] = box(side, a, wv, hv);
    x = Math.max(0, Math.min(W - wv, x)); y = Math.max(0, Math.min(H - hv, y));
    card.style.left = `${m.e - sb.left + stage.scrollLeft + x * scale}px`;
    card.style.top = `${m.f - sb.top + y * scale}px`;
  }

  // ---- exploring -----------------------------------------------------------------------------------
  const same = (x: What, y: What) =>
    !!x && !!y && ('node' in x && 'node' in y ? x.node === y.node : 'edge' in x && 'edge' in y && x.edge === y.edge);
  function pin(what: What): void { pinned = same(pinned, what) ? null : what; show(pinned); }
  stage.addEventListener('click', () => { pinned = null; show(null); });

  function show(what: What): void {
    clearTimeout(leaveTimer);
    svg.classList.toggle('exploring', !!what);
    const lit = new Set<string>();
    for (const rec of edgeEls) {
      const on = !!what && ('edge' in what ? rec.tool === what.edge.tool : rec.a === what.node || rec.b === what.node);
      rec.g.classList.toggle('on', on);
      rec.g.classList.toggle('focus', !!what && 'edge' in what && rec.tool === what.edge.tool);
      if (on) { lit.add(rec.a); lit.add(rec.b); }
    }
    if (what && 'node' in what) lit.add(what.node);
    litNow = lit;
    for (const [id, els] of Object.entries(nodeEls)) for (const g of els) {
      g.classList.toggle('on', lit.has(id));
      g.classList.toggle('focus', !!what && 'node' in what && what.node === id);
    }
    current = what;
    side = null;
    if (!what) { card.classList.add('gone'); readout.textContent = ''; return; }

    card.replaceChildren();
    const h = document.createElement('strong'), p = document.createElement('p');
    if ('node' in what) {
      const n = N(what.node);
      h.textContent = n.cap;
      p.textContent = n.explain;
      card.append(h, p);
      const tools = [...new Set(edgeEls.filter((r) => r.a === what.node || r.b === what.node).map((r) => r.tool))];
      if (tools.length) {
        const ul = document.createElement('ul');
        for (const name of tools) {
          const li = document.createElement('li');
          li.dataset['category'] = TOOLS[name]!.cat;
          li.textContent = TOOLS[name]!.coming ? `${name} (coming)` : name;
          ul.append(li);
        }
        card.append(ul);
      }
    } else {
      const t = TOOLS[what.edge.tool]!;
      h.textContent = what.edge.tool;
      h.dataset['category'] = t.cat;
      const line = projects.find((x) => x.id === t.project)?.line;
      if (line) h.append(' ', Object.assign(document.createElement('span'), { className: 'tool-line', textContent: line }));
      p.textContent = what.edge.note ?? t.does;
      card.append(h, p);
    }
    readout.textContent = card.textContent;
    card.classList.remove('gone');
    placeCard();
  }

  render();
  // Start once the map is in the page (it needs layout for the card).
  requestAnimationFrame(() => { render(); if (!reduce.matches) requestAnimationFrame(frame); });
  return stage;
}
