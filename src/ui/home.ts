/* The landing page: why each tool exists, one item per tool, then the map.
   Each item: the want (first person), then the tool's name, a one-line
   summary, the "Try it" and full-product buttons (actions.ts) and a visual
   that links to the tool's demo.
   Wording is a draft for Bengisu to edit. */

import { projects, type ProjectEntry } from '../data/projects.js';
import { actions, wayIn } from './actions.js';
import { LAMP_CARDS } from '../lamp/cards/index.js';
import { mountCard } from '../lamp/engine.js';
import { renderMap } from './map.js';
import { el, href } from './shared.js';

interface Want {
  want: string;
  /** Project entry that supplies category, summary page and visual. */
  project: string;
  name: string;
  /** Absent where the details live on the project page (its `parts`). */
  summary?: string;
  /** Where the name shows. 'corner': a tag on the picture's top-left corner;
      'picture': the picture already shows the product's wordmark. Either way
      the heading stays for screen readers. Absent: the name as a heading. */
  nameOn?: 'corner' | 'picture';
}

const WANTS: Want[] = [
  {
    want: 'simply groove.',
    project: 'ysad',
    // The card has no wordmark, so the name goes on the corner.
    nameOn: 'corner',
    name: 'YSAD',
  },
  {
    want: 'simply cover.',
    project: 'rearranged',
    // The card has no wordmark, so the name goes on the corner.
    nameOn: 'corner',
    name: 'Rearranged',
  },
  {
    want: 'simply jam.',
    project: 'tabridge',
    nameOn: 'corner',
    name: 'Ready Set',
  },
  {
    want: 'simply sing.',
    project: 'voxmpe',
    // The card has no wordmark, so the name goes on the corner.
    nameOn: 'corner',
    name: 'Starling',
  },
  {
    want: 'simply split.',
    project: 'stemscribe',
    // The card has no wordmark, so the name goes on the corner.
    nameOn: 'corner',
    name: 'Coming Undone',
  },
  {
    want: 'simply sketch.',
    project: 'session-notes',
    nameOn: 'corner',
    name: 'Session Notes',
  },
  {
    want: 'simply tag.',
    project: 'intentional',
    nameOn: 'corner',
    name: 'Tagline',
  },
  {
    want: 'stay in awe of music, visually too.',
    project: 'odoroki',
    name: 'Odoroki',
    summary: 'Live visuals that follow the music you play and react when it surprises you.',
  },
];

export function renderHome(main: HTMLElement): void {
  document.documentElement.removeAttribute('data-category');

  // Slot for the dessins/illude piece (a later step); empty for now.
  const hero = el(
    'section',
    { class: 'hero' },
    el('div', { class: 'hero-bg', 'aria-hidden': 'true' }),
    el(
      'div',
      { class: 'hero-text' },
      el('h1', { class: 'head' }, 'producing music and tools, because I want to…'),
      el('ol', { class: 'wants' }, ...WANTS.map((w, i) => wantItem(w, i))),
    ),
  );

  // The map follows the list with no heading of its own, as if the stream opened out
  // into it.
  const mapSection = el(
    'section',
    { class: 'map-open', 'aria-label': 'Map of the tools' },
    renderMap(),
  );

  main.append(hero, mapSection);
  drawStream(hero.querySelector<HTMLOListElement>('.wants')!);
  wireGlide();
  wireFog(hero.querySelector<HTMLOListElement>('.wants')!);
}

/* A thin mist: the item nearest the middle of the window is clear, and items
   further away fade and soften a little (down to about 55% and a light blur).
   It follows the scroll; hovering or focusing an item clears it at once, and
   under reduced motion everything stays clear. --fog runs 0 (clear) to 1. */
function wireFog(list: HTMLOListElement): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;
  const update = () => {
    queued = false;
    const items = list.querySelectorAll<HTMLLIElement>(':scope > li');
    for (const li of items) {
      if (reduce.matches) { li.style.removeProperty('--fog'); continue; }
      const r = li.getBoundingClientRect();
      // Distance of the item's nearest edge from the middle of the window,
      // as a share of half the window: 0 when it spans the middle.
      const mid = innerHeight / 2;
      const off = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0;
      const fog = Math.min(1, Math.max(0, (off / mid - 0.15) / 0.7));
      li.style.setProperty('--fog', fog.toFixed(3));
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  reduce.addEventListener('change', queue);
  queue();
}

/* Going to a tool's item (from the map, or a shared #link): glide there on an
   ease-in-out curve, quicker than the browser's own smooth scroll, and centre
   the item in the window (an item taller than the window aligns to the top).
   The arrived-at item's symbol takes its colour. Instant under reduced motion. */
function wireGlide(): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  function glideTo(id: string, push: boolean): void {
    const li = document.getElementById(id);
    if (!li) return;
    for (const x of document.querySelectorAll('.wants > li.arrived')) x.classList.remove('arrived');
    li.classList.add('arrived');
    if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    const r = li.getBoundingClientRect();
    const margin = 24;
    const offset = r.height + margin * 2 < innerHeight ? (innerHeight - r.height) / 2 : margin;
    const to = Math.max(0, scrollY + r.top - offset), from = scrollY, dist = to - from;
    cancelAnimationFrame(raf);
    if (reduce.matches || Math.abs(dist) < 2) { scrollTo(0, to); return; }
    const dur = Math.min(750, Math.max(420, Math.abs(dist) * 0.3));
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      scrollTo(0, from + dist * ease(k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  // A person scrolling takes over from a glide in progress.
  for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => cancelAnimationFrame(raf), { passive: true });
  addEventListener('showcase:go', (e) => glideTo((e as CustomEvent<string>).detail, true));
  addEventListener('popstate', () => { if (location.hash) glideTo(location.hash.slice(1), false); });
  // Opened from a shared link: centre the item once the page has laid out.
  if (location.hash) addEventListener('load', () => glideTo(location.hash.slice(1), false), { once: true });
}

/* The stream: one faint, still curve running down the page between each
   item's text and visual, like the map's curves. Items alternate sides, so it
   winds. Redrawn when the layout changes size; not drawn when items stack. */
function drawStream(list: HTMLOListElement): void {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'stream');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  svg.append(path);
  list.prepend(svg);

  // The stream runs down the gutter between each item's text and visual, and
  // crosses to the next item's gutter only in the open space between items,
  // so it never touches text or images.
  const wide = matchMedia('(min-width: 861px)');
  const redraw = () => {
    const items = [...list.querySelectorAll<HTMLLIElement>(':scope > li')];
    if (!wide.matches) {
      path.setAttribute('d', '');
      return;
    }
    const box = list.getBoundingClientRect();
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    const lanes: { x: number; top: number; bottom: number }[] = [];
    for (const li of items) {
      const text = li.querySelector<HTMLElement>('.item-text');
      const vis = li.querySelector<HTMLElement>('.thumb-col');
      if (!text) continue;
      const lr = li.getBoundingClientRect(), tr = text.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(li).columnGap) || 72;
      let x: number;
      if (vis) {
        const vr = vis.getBoundingClientRect();
        x = (li.classList.contains('flip') ? (vr.right + tr.left) / 2 : (tr.right + vr.left) / 2) - lr.left;
      } else {
        // a tool without a visual: the stream runs past its text, on the open side
        x = (li.classList.contains('right') ? tr.left - gap / 2 : tr.right + gap / 2) - lr.left;
      }
      const top = lr.top - box.top + (parseFloat(getComputedStyle(li).paddingTop) || 0);
      lanes.push({ x, top: top + 22, bottom: lr.bottom - box.top });
    }
    if (lanes.length < 2) { path.setAttribute('d', ''); return; }
    // Down each gutter, then a soft S through the gap to the next one.
    let d = `M${lanes[0]!.x},${lanes[0]!.top}`;
    lanes.forEach((l, i) => {
      if (i > 0) {
        const p = lanes[i - 1]!, mid = (l.top - p.bottom) / 2;
        d += ` C${p.x},${p.bottom + mid} ${l.x},${l.top - mid} ${l.x},${l.top}`;
      }
      d += ` L${l.x},${l.bottom}`;
    });
    path.setAttribute('d', d);
  };
  wide.addEventListener('change', redraw);
  new ResizeObserver(redraw).observe(list);
  addEventListener('load', redraw);
  redraw();
}

/* The organic rhythm: per item, how much of the row the visual takes, where
   the text sits against it, and the space above. Hand-tuned so neighbours
   differ without anything looking random; the sequence repeats if the list
   grows. */
const RHYTHM: { visual: number; align: 'center' | 'start' | 'end'; gapTop: number }[] = [
  // YSAD: its card is a circle, so a narrower column keeps it from looming.
  { visual: 1.2, align: 'center', gapTop: 40 },
  { visual: 1.45, align: 'start', gapTop: 88 },
  { visual: 1.9, align: 'end', gapTop: 72 },
  { visual: 1.5, align: 'center', gapTop: 104 },
  { visual: 1.8, align: 'start', gapTop: 80 },
  // Session Notes: a narrower visual with the text centred.
  { visual: 1.35, align: 'center', gapTop: 96 },
  { visual: 1.55, align: 'center', gapTop: 76 },
];

function wantItem(w: Want, i: number): HTMLElement {
  const p = projects.find((x) => x.id === w.project);
  const page = p?.page && !p.coming ? href(p.page) : null;
  const nameNode = page ? el('a', { href: page }, w.name) : el('span', {}, w.name);

  // Two columns: the want, name and summary on the left; the visual on the
  // right, running the item's full height, as the way in.
  const text = el(
    'div',
    { class: 'item-text' },
    el('p', { class: 'want' }, w.want),
    // The tool's line after its name, unless the want above already says it.
    el('h2', w.nameOn ? { class: 'sr-only' } : {}, nameNode, ...(p?.line && p.line !== w.want ? [' ', el('span', { class: 'tool-line' }, p.line)] : [])),
    ...(w.summary ? [el('p', { class: 'summary' }, w.summary)] : []),
  );
  if (p?.coming) text.append(el('p', { class: 'site-link pending' }, 'coming'));
  else if (p && page) {
    const row = actions(p, page);
    if (row) text.append(row);
  }
  const lamp = p && page && !p.coming ? lampSide(w, p, page) : null;
  const side = lamp ? [lamp] : [];
  const r = RHYTHM[i % RHYTHM.length]!;
  // odd items sit on the right: their text after the visual, or, with no visual yet,
  // their text alone in the right-hand column
  const right = i % 2 === 1;
  const flip = right && !p?.coming;
  const cols = right ? `minmax(0, ${r.visual}fr) minmax(0, 1fr)` : `minmax(0, 1fr) minmax(0, ${r.visual}fr)`;
  return el(
    'li',
    {
      id: w.project, // the map's curves link here
      'data-category': p?.categories[0] ?? '',
      class: [p?.coming ? 'coming' : '', flip ? 'flip' : '', right ? 'right' : ''].filter(Boolean).join(' '),
      style: `--cols: ${cols}; --align: ${r.align}; --gap-top: ${i === 0 ? 40 : r.gapTop}px`,
    },
    text,
    ...side,
  );
}

/* The visual beside each summary: the project's lamp card (src/lamp/), drawn
   in strings. It plays its picture once, silently (sound belongs to the demos),
   the first time it comes into view; a click or Enter opens the same place as
   the "Try the demo" button beside the summary. */
function lampSide(w: Want, p: ProjectEntry, page: string): HTMLElement | null {
  const def = LAMP_CARDS[p.id];
  if (!def) return null;
  const to = wayIn(p, page);
  const box = el('div', { class: 'thumb lamp-thumb' });
  mountCard(box, def, {
    label: `${w.name}: ${p.summary ?? p.lead}. Opens ${to.live ? 'the demo' : 'how it works'}.`,
    silent: true,
    playOnView: true,
    onPress: () => location.assign(to.href),
  });
  if (w.nameOn) box.append(nameTag(w, p));
  return el('div', { class: 'thumb-col' }, box);
}

/** The name as a tag on the card's corner (the heading stays for screen readers). */
function nameTag(w: Want, p: ProjectEntry): HTMLElement {
  return el(
    'span',
    { class: 'name-tag', 'aria-hidden': 'true' },
    // A short name hides its long one, shown on hover (YSAD's easter egg).
    el('span', { class: 'name' }, w.name),
    ...(p.fullName ? [el('span', { class: 'name full' }, p.fullName)] : []),
    // The tool's line, unless the want above already says it.
    ...(p.line && p.line !== w.want ? [el('span', { class: 'tool-line' }, p.line)] : []),
  );
}

