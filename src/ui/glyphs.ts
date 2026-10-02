/* Every tool's symbol, drawn once. voxmpe and yousuckatdrums get hand-built
   glyphs (a microtonal ladder with a gliding line; sixteen steps around a
   circle); the rest use a Lucide icon. map.ts builds the live map's DOM
   glyphs from this geometry, and scripts/visuals.mjs (via Node's built-in
   TypeScript support, so no build step is needed to read it) renders the
   same data as static SVG markup for the social cards. Neither place should
   restate these numbers or the Lucide-to-tool mapping; import from here.

   scripts/visuals.mjs imports this file directly with `node`, so keep it to
   erasable TypeScript only: no enums, no namespaces, no parameter
   properties, no decorators. */

import { AudioLines, FileMusic, Music, NotebookPen, Shuffle, Tag, type IconNode } from 'lucide';

// ---- voxmpe: a microtonal ladder with a sung line gliding into vibrato ----

export const MPE_LADDER_Y = [-17, -11, -5, 3, 10, 18];
export const MPE_LADDER_X = 23;

export function mpeGlidePath(): string {
  let d = 'M-22,15 C-14,15 -11,4 -4,-3';
  for (let i = 0; i <= 11; i++) d += ` L${(-4 + i * 2.3).toFixed(1)},${(-7 + Math.sin(i * 1.2) * 2.8).toFixed(1)}`;
  return d;
}

/** Static, sanitizer-safe markup for the card: the same ladder and glide,
    recoloured to `currentColor` (the map draws it with `var(--line)` /
    `var(--acc)`, tokens that would go invisible on the card's own
    accent-coloured header). */
export function mpeSymbolSvg(): string {
  const rungs = MPE_LADDER_Y.map(
    (y) => `<line x1='${-MPE_LADDER_X}' y1='${y}' x2='${MPE_LADDER_X}' y2='${y}' stroke-width='1' opacity='0.35'/>`,
  ).join('');
  const glide = `<path d='${mpeGlidePath()}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>`;
  return `<svg viewBox='-26 -22 52 44' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='currentColor'>${rungs}${glide}</svg>`;
}

// ---- yousuckatdrums: sixteen steps around a circle, some hits lit --------

export const PATTERN_HITS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
export const PATTERN_R = 18;

export interface PatternDot {
  cx: number;
  cy: number;
  r: number;
  hit: boolean;
}

export function patternDots(): PatternDot[] {
  return PATTERN_HITS.map((hit, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    return { cx: Math.cos(a) * PATTERN_R, cy: Math.sin(a) * PATTERN_R, r: hit ? 3.3 : 2, hit: !!hit };
  });
}

/** Static, sanitizer-safe markup for the card: `currentColor` fill, the
    unlit steps dimmed with opacity instead of the map's muted token. */
export function patternSymbolSvg(): string {
  const dots = patternDots()
    .map((d) => `<circle cx='${d.cx.toFixed(2)}' cy='${d.cy.toFixed(2)}' r='${d.r}'${d.hit ? '' : " opacity='0.35'"}/>`)
    .join('');
  return `<svg viewBox='-24 -24 48 48' xmlns='http://www.w3.org/2000/svg' fill='currentColor'>${dots}<circle cx='0' cy='0' r='1.8'/></svg>`;
}

// ---- the rest: one Lucide icon per tool, keyed by project id ------------

export const TOOL_ICONS: Record<string, IconNode> = {
  stemscribe: AudioLines,
  rearranged: Shuffle,
  tabridge: FileMusic,
  'session-notes': NotebookPen,
  intentional: Tag,
  home: Music, // the welcome page's own site card, not a project
};

/** A Lucide IconNode as static, sanitizer-safe SVG markup: the same
    fill="none" stroke="currentColor" wrapper Lucide itself uses, so it
    reads the same on the card's accent-coloured header as it does on the
    map and the welcome page's item marks. */
export function lucideSymbolSvg(icon: IconNode): string {
  const raw = icon as unknown as readonly unknown[];
  const children = (Array.isArray(raw[0]) ? raw : ((raw[2] as readonly unknown[]) ?? [])) as readonly [string, Record<string, string | number>][];
  const body = children
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}='${v}'`).join(' ')}/>`)
    .join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`;
}

/** The card symbol for a project id (or "home" for the site card), static
    markup ready to drop into a card's `data.symbol`. `undefined` for an id
    with no icon. */
export function cardSymbol(id: string): string | undefined {
  if (id === 'voxmpe') return mpeSymbolSvg();
  if (id === 'ysad') return patternSymbolSvg();
  const icon = TOOL_ICONS[id];
  return icon ? lucideSymbolSvg(icon) : undefined;
}

// ---- favicons (scripts/favicons.mjs) ------------------------------------
// A browser tab draws these at 16 px. The Lucide icons hold up there as they
// are; the two hand-built glyphs do not (six hairline rungs and sixteen dots
// turn to grey mush), so each gets a simplified tab version below, drawn on a
// 24-unit grid like Lucide so all favicons share one weight.

/** swwallowws' own mark (chosen 2026-09-28, draft "4g"): five flat-topped
    bars, read as piano keys, a waveform and the doubled letters of the name,
    whose bottoms cut a swallow's tail: a shallow V between the inner bars and
    the two outer bars cut steeply into long pointed streamers. Edges sit on
    the 16 px grid (1 px = 1.5 units) so every cut is a clean one-pixel step. */
export function homeMarkSvg(): string {
  const d = 'M1.5,1.5 L4.5,1.5 L4.5,16.5 L1.5,22.5 Z M6,1.5 L9,1.5 L9,10.5 L6,13.5 Z '
    + 'M10.5,1.5 L13.5,1.5 L13.5,9 L12,7.5 L10.5,9 Z M15,1.5 L18,1.5 L18,13.5 L15,10.5 Z '
    + 'M19.5,1.5 L22.5,1.5 L22.5,22.5 L19.5,16.5 Z';
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' stroke='none'><path d='${d}'/></svg>`;
}

/** voxmpe at tab size: three ladder rungs instead of six, and one line that
    glides up from below and settles into a short vibrato between two rungs. */
export function mpeFaviconSvg(): string {
  const rungs = [4, 12, 20].map((y) => `<line x1='2' y1='${y}' x2='22' y2='${y}' stroke-width='1.5' opacity='0.4'/>`).join('');
  const glide = `<path d='M2.5,17.5 C7,17.5 8,8 12,8 q1.5,-3.6 3,0 t3,0 t3,0' stroke-width='2.5'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round'>${rungs}${glide}</svg>`;
}

/** yousuckatdrums at tab size: eight steps instead of sixteen, the first
    eight of the map's pattern (a 3-3-2 tresillo) lit large and solid, the
    rest small and faint. */
export const PATTERN_FAVICON_HITS = PATTERN_HITS.slice(0, 8);

export function patternFaviconSvg(): string {
  const dots = PATTERN_FAVICON_HITS.map((hit, i) => {
    const a = (i / PATTERN_FAVICON_HITS.length) * Math.PI * 2 - Math.PI / 2;
    const cx = (Math.cos(a) * 8).toFixed(2);
    const cy = (Math.sin(a) * 8).toFixed(2);
    return hit ? `<circle cx='${cx}' cy='${cy}' r='3.2'/>` : `<circle cx='${cx}' cy='${cy}' r='1.6' opacity='0.45'/>`;
  }).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-12 -12 24 24' fill='currentColor'>${dots}</svg>`;
}

/** The favicon symbol for a page id ("home" is the welcome page), in
    `currentColor`; scripts/favicons.mjs adds the Paper/Night colours. */
export function faviconSymbol(id: string): string | undefined {
  if (id === 'home') return homeMarkSvg();
  if (id === 'voxmpe') return mpeFaviconSvg();
  if (id === 'ysad') return patternFaviconSvg();
  const icon = TOOL_ICONS[id];
  return icon ? lucideSymbolSvg(icon) : undefined;
}
