/* The landing page: why each tool exists, one item per tool.
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
import { VISUALS } from '../data/visuals.generated.js';
import { Volume2, VolumeX, type IconNode } from 'lucide';
import { lucideSymbolSvg } from './glyphs.js';
import { illudeBand } from './illude-band.js';

interface Want {
  want: string;
  /** Project entry that supplies category, summary page and visual. */
  project: string;
  name: string;
  /** Absent where the details live on the project page (its `parts`). */
  summary?: string;
}

const WANTS: Want[] = [
  {
    want: 'simply groove.',
    project: 'ysad',
    name: 'YSAD',
  },
  {
    want: 'simply cover.',
    project: 'rearranged',
    name: 'Rearranged',
  },
  {
    want: 'simply jam.',
    project: 'tabridge',
    name: 'Ready Set',
  },
  {
    want: 'simply sing.',
    project: 'voxmpe',
    name: 'Starling',
  },
  {
    want: 'simply split.',
    project: 'stemscribe',
    name: 'Coming Undone',
  },
  {
    want: 'simply sketch.',
    project: 'session-notes',
    name: 'Session Notes',
  },
  {
    want: 'simply tag.',
    project: 'intentional',
    name: 'Tagline',
  },
  {
    want: 'simply wonder.',
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
      stage(),
      el('ol', { class: 'wants' }, ...WANTS.map((w) => wantItem(w))),
    ),
  );

  main.append(hero);
  // The map lives on the GitHub profile README only. It renders here just with
  // ?map, for scripts/profile-map.mjs to screenshot.
  if (new URLSearchParams(location.search).has('map')) {
    main.append(el('section', { class: 'map-open', 'aria-label': 'Map of the tools' }, renderMap()));
  }
  wireGlide();
  wireFocus(hero.querySelector<HTMLOListElement>('.wants')!);
}

/* The stage under the headline: every tool as a vertical band showing its
   product. A band out of focus is a dimmed slice of it (the hook's poster
   frame, or the lamp still) carrying its want line; the band under the pointer
   opens to the width of its media and plays its loop, with the want and the
   tool's name on its corner. Its neighbours open a little, the rest stay
   narrow. Odoroki, with nothing recorded yet, runs illude's shader live
   (illude-band.ts). With the pointer away (or on touch) the stage steps
   through the tools on its own. A click glides to the tool's item. Under
   reduced motion it holds still on the first tool. */
// how the bands share the width: a gaussian around the tool in focus; the open
// band's height (amp) is solved in size() so it is exactly as wide as its media
const SIGMA = 0.5, MIN_GROW = 1, EASE = 0.09;
// the widest hook is 1000 x 930; every media slot is this wide for its height
const MEDIA_ASPECT = 1.08;
// the shares of a hook cut off its top or left edge in the stage, where the
// hook shows the tool's own name and the band names it already
const HOOK_CROP: Record<string, { top?: number; left?: number }> = {
  ysad: { top: 0.075 }, tabridge: { top: 0.15 }, voxmpe: { left: 0.09 },
};
// how long the stage rests on each tool when nothing points at it
const STEP_MS = 4500;
function stage(): HTMLElement {
  const box = el('div', { class: 'stage', role: 'group', 'aria-label': 'The tools' });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bands = WANTS.map((w) => {
    const p = projects.find((x) => x.id === w.project);
    const vis = VISUALS[w.project];
    const v = vis?.videos.includes('hook')
      ? (el('video', { class: 'band-media', muted: '', loop: '', playsinline: '', preload: 'metadata', src: href(`visuals/${w.project}/hook.mp4`), 'aria-hidden': 'true' }) as HTMLVideoElement)
      : null;
    if (v) v.muted = true;
    // without a hook, the lamp still in its Night theme (the stage is dark in both page themes)
    const still = !v && vis?.shots.includes('lamp')
      ? el('img', { class: 'band-media', src: href(`visuals/${w.project}/lamp-night.png`), alt: '', loading: 'lazy' })
      : null;
    const media = v ?? still;
    // out of focus: the tool's lamp card, live (src/lamp/); a tool without one
    // shows its hook's poster frame (visuals.mjs writes it beside the hook) or its still
    const def = LAMP_CARDS[w.project];
    const lamp = def ? el('div', { class: 'band-poster band-lamp', 'data-theme': 'night' }) : null;
    const poster = lamp ? null : v ? href(`visuals/${w.project}/hook.jpg`) : still ? href(`visuals/${w.project}/lamp-night.png`) : null;
    // the band names the tool, so its hook doesn't: a hook whose name sits on an edge is cut there
    const crop = HOOK_CROP[w.project];
    if (media && crop && v) { media.style.setProperty('--crop-top', String(crop.top ?? 0)); media.style.setProperty('--crop-left', String(crop.left ?? 0)); }
    const frame = media ? el('div', { class: 'band-frame' }, el('div', { class: 'band-crop' }, media)) : null;
    // the frame keeps the media's own shape, less what is cut
    const shape = (w0: number, h0: number) => frame?.style.setProperty('--media-ratio', String((w0 * (1 - (crop?.left ?? 0))) / (h0 * (1 - (crop?.top ?? 0)))));
    if (v) v.addEventListener('loadedmetadata', () => shape(v.videoWidth, v.videoHeight));
    else if (still) still.addEventListener('load', () => shape((still as HTMLImageElement).naturalWidth, (still as HTMLImageElement).naturalHeight));
    const band = el('a', { class: `band${still ? ' has-still' : ''}${lamp || poster ? '' : ' no-poster'}`, href: `#${w.project}`, 'data-category': p?.categories[0] ?? '', 'aria-label': `${w.want} ${w.name}` },
      ...(lamp ? [lamp] : poster ? [el('img', { class: 'band-poster', src: poster, alt: '', 'aria-hidden': 'true' })] : []),
      el('span', { class: 'band-want', 'aria-hidden': 'true' }, w.want),
      el('div', { class: `band-open${media ? '' : ' bare'}`, 'aria-hidden': 'true' },
        el('div', { class: 'band-text' },
          el('p', { class: 'band-tag' }, w.want),
          el('p', { class: 'band-title' }, w.name)),
        ...(frame ? [frame] : [])));
    // Odoroki continues illude: with nothing recorded yet, its band runs illude's shader
    const live = !poster && w.project === 'odoroki' ? illudeBand(() => getComputedStyle(band.querySelector('.band-want')!).color) : null;
    if (live) { band.prepend(live.canvas); band.classList.remove('no-poster'); }
    box.append(band);
    // the card plays once when it comes into view and keeps its lamp wandering;
    // a click goes through to the band (wired below), so the card itself does nothing more
    if (lamp && def) mountCard(lamp, def, { label: `${w.name}: ${w.want} Opens it here.`, silent: true, playOnView: true, onPress: () => {} });
    return { band, v, live, grow: 1 };
  });
  const n = bands.length;
  let amp = 10;
  const growAt = (i: number, c: number) => MIN_GROW + amp * Math.exp(-((i - c) ** 2) / (2 * SIGMA * SIGMA));
  // the open band's share of the width when the stage rests on a tool, at the
  // tool where it is smallest
  const restShare = () => {
    let share = 1;
    for (let c = 0; c < n; c++) {
      let t = 0;
      for (let i = 0; i < n; i++) t += growAt(i, c);
      share = Math.min(share, growAt(c, c) / t);
    }
    return share;
  };
  // one type size for every want, so the tag never changes size: the size at
  // which the longest want and its name fit the open band
  const MAX_PX = 40, MIN_PX = 14;
  const INSET = 16; // --stage-inset in app.css
  const ROOM = 6; // for the type's rounding, which isn't quite linear
  const text = bands[0]!.band.querySelector<HTMLElement>('.band-text')!;
  // twice: the media's height is what the words' row leaves, and the words'
  // size follows the band's width
  const size = () => { fit(); fit(); };
  const fit = () => {
    const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
    const width = box.clientWidth - (n - 1) * gap;
    const textRow = text.offsetHeight + INSET * 2;
    const tag = text.querySelector<HTMLElement>('.band-tag')!, title = text.querySelector<HTMLElement>('.band-title')!;
    const keep = [tag.textContent ?? '', title.textContent ?? ''] as const;
    // the widest want and name at a type size (the tags' padding doesn't scale with it)
    const widestAt = (px: number) => {
      box.style.setProperty('--tag-size', `${px}px`);
      let wide = 1;
      for (const w of WANTS) { tag.textContent = w.want; title.textContent = w.name; wide = Math.max(wide, text.scrollWidth); }
      return wide;
    };
    const smallest = widestAt(MIN_PX);
    const widest = widestAt(MAX_PX);
    tag.textContent = keep[0];
    title.textContent = keep[1];
    // the open band is as wide as its media under the words' row, up to half
    // the stage, and never narrower than the words at their smallest (a phone)
    const mediaW = Math.floor((box.clientHeight - textRow) * MEDIA_ASPECT);
    const wordsW = smallest + INSET * 2 + ROOM;
    const want = Math.min(0.8, Math.max(Math.min(0.5, mediaW / width), wordsW / width));
    let lo = 0, hi = 400;
    for (let k = 0; k < 40; k++) { amp = (lo + hi) / 2; if (restShare() < want) lo = amp; else hi = amp; }
    amp = hi;
    const openW = Math.floor(width * restShare());
    box.style.setProperty('--open-w', `${openW}px`);
    for (const b of bands) b.live?.size(openW, box.clientHeight);
    // the words' width is the type's, which scales, plus the tags' padding, which doesn't
    const perPx = (widest - smallest) / (MAX_PX - MIN_PX);
    const px = Math.max(MIN_PX, Math.min(MAX_PX, MIN_PX + (openW - INSET * 2 - ROOM - smallest) / perPx));
    box.style.setProperty('--tag-size', `${px.toFixed(1)}px`);
    // a still stage draws only on demand
    if (reduce) requestAnimationFrame(tick);
  };
  new ResizeObserver(size).observe(box);
  void document.fonts.ready.then(size);
  let target = 0; // the tool the stage rests on (0 .. n-1); starts on the first
  let centre = 0;
  const t0 = performance.now();
  let pointer: number | null = null;
  let shown = 0;
  // The band under the pointer opens. Only a pointer move changes it, so the
  // bands shifting under a still pointer never hand the stage on by themselves.
  // A tap opens a band too (touch has no hover); a click on the open band goes to its item.
  box.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const i = bands.findIndex((x) => x.band === (e.target as Element).closest('.band'));
    if (i >= 0) pointer = i;
  });
  bands.forEach((b, i) => b.band.addEventListener('click', (e) => {
    if (i === shown) return;
    e.preventDefault();
    pointer = i;
  }));
  box.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer = null; });
  const tick = (t: number) => {
    // away from the pointer the stage steps from the first tool to the last and back
    const k = Math.floor((t - t0) / STEP_MS) % (2 * (n - 1));
    target = pointer ?? (k < n ? k : 2 * (n - 1) - k);
    centre += (target - centre) * EASE;
    if (Math.abs(target - centre) < 0.001) centre = target;
    let best = 0;
    bands.forEach((b, i) => {
      b.grow = growAt(i, centre);
      b.band.style.flexGrow = b.grow.toFixed(3);
      if (b.grow > bands[best]!.grow) best = i;
    });
    shown = best;
    // the hand-over is instant: the words, the dimming and the media all
    // change on the same frame, so nothing of one tool lingers on the next
    bands.forEach((b, i) => {
      const open = i === best;
      b.band.classList.toggle('open', open);
      if (b.v) { if (open && !reduce) { if (b.v.paused) void b.v.play().catch(() => {}); } else if (!b.v.paused) b.v.pause(); }
      b.live?.draw(t);
    });
    if (!reduce) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return box;
}

/* Focus (an item's hook playing) goes to the item whose centre is nearest the
   window's middle, and only once scrolling has paused: a quick scroll past
   never flips anything. An item that drifts out of the middle third lets go at
   once. Nothing plays under reduced motion. */
function wireFocus(list: HTMLOListElement): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;
  let settle = 0;
  const focusNearest = () => {
    const items = [...list.querySelectorAll<HTMLLIElement>(':scope > li')];
    const mid = innerHeight / 2;
    let best: HTMLLIElement | null = null, bestOff = Infinity;
    for (const li of items) {
      const r = li.getBoundingClientRect();
      const off = Math.abs(r.top + r.height / 2 - mid);
      if (off < bestOff) { best = li; bestOff = off; }
    }
    for (const li of items) setFocus(li, !reduce.matches && li === best && bestOff < innerHeight * 0.2);
  };
  const update = () => {
    queued = false;
    const mid = innerHeight / 2;
    for (const li of list.querySelectorAll<HTMLLIElement>(':scope > li')) {
      const r = li.getBoundingClientRect();
      if (reduce.matches || (li.classList.contains('focused') && Math.abs(r.top + r.height / 2 - mid) > innerHeight / 3)) setFocus(li, false);
    }
    // focus follows the middle as you scroll, checked a frame behind
    clearTimeout(settle);
    settle = window.setTimeout(focusNearest, 0);
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


function wantItem(w: Want): HTMLElement {
  const p = projects.find((x) => x.id === w.project);
  const page = p?.page && !p.coming ? href(p.page) : null;
  const nameNode = page ? el('a', { href: page }, w.name) : el('span', {}, w.name);
  const video = p && page && !p.coming ? videoSide(w, p, page) : null;

  // The text on the left, the hook on the right. What the tool ships as is
  // said once, in the links under it (actions.ts), each format its own link.
  const text = el(
    'div',
    { class: 'item-text' },
    el('p', { class: 'want' }, w.want),
    // The tool's line after its name, unless the want above already says it.
    el('h2', {}, nameNode, ...(p?.line && p.line !== w.want ? [' ', el('span', { class: 'tool-line' }, p.line)] : [])),
    // a line about it: the tool's own summary (its project page's lead), or the want's
    ...(p?.summary ?? w.summary ? [el('p', { class: 'summary' }, (p?.summary ?? w.summary)!)] : []),
  );
  if (p?.coming) text.append(el('p', { class: 'pending' }, 'coming'));
  else if (p && page) {
    const row = actions(p, page);
    if (row) text.append(row);
  }
  return el(
    'li',
    {
      id: w.project, // the stage's bands and shared links come here
      'data-category': p?.categories[0] ?? '',
      class: [p?.coming ? 'coming' : '', video ? '' : 'no-visual'].filter(Boolean).join(' '),
    },
    text,
    // without a hook, a tool whose formats are one flow (Tagline) shows the flow where the hook would be
    ...(video ? [video] : p?.ways && !p.coming ? [el('p', { class: 'item-ways' }, p.ways)] : []),
  );
}

/* The visual beside each summary: the project's `hook` (visuals/<id>/hook.mp4:
   a short loop of the real product, no captions), always there. It shows its
   first frame (hook.jpg) until the item comes to the middle of the window
   (wireFocus), then plays muted, with a button for the sound when it has
   one; a click opens the demo, like the way-in link beside the summary.
   Out of focus it pauses, so one video plays at a time. The video is fetched
   once the item is within a screen of the window. A tool without a hook yet
   shows its text alone. */
const ITEM_VIDEO = 'hook';
function videoSide(w: Want, p: ProjectEntry, page: string): HTMLElement | null {
  if (!VISUALS[p.id]?.videos.includes(ITEM_VIDEO)) return null;
  const base = href(`visuals/${p.id}/${ITEM_VIDEO}`);
  const video = el('video', { muted: '', loop: '', playsinline: '', preload: 'auto', poster: `${base}.jpg`, 'aria-hidden': 'true' }) as HTMLVideoElement;
  video.muted = true;
  video.dataset.src = `${base}.mp4`;
  const near = new IntersectionObserver(([e]) => {
    if (!e!.isIntersecting) return;
    if (!video.src) video.src = video.dataset.src!;
    near.disconnect();
  }, { rootMargin: '100% 0px' });
  near.observe(video);
  const to = wayIn(p, page);
  const box = el('div', { class: 'thumb video-thumb' },
    el('a', { href: to.href, 'aria-label': `${w.name}: ${p.summary ?? p.lead}. Opens ${to.live ? 'the demo' : 'how it works'}.` }, video,
      // said quietly on hover, so a click that opens the demo isn't a surprise
      el('span', { class: 'thumb-cue', 'aria-hidden': 'true' }, to.live ? 'open the demo →' : 'how it works →')));
  // a sound button, centred over the picture, only for a video with sound
  if (!VISUALS[p.id]?.silent?.includes(ITEM_VIDEO)) {
    const sound = el('button', { class: 'focus-sound', type: 'button', 'aria-label': 'Sound on' }, svgIcon(VolumeX));
    sound.addEventListener('click', () => {
      video.muted = !video.muted;
      sound.replaceChildren(svgIcon(video.muted ? VolumeX : Volume2));
      sound.setAttribute('aria-label', video.muted ? 'Sound on' : 'Sound off');
    });
    box.append(sound, scrubBar(video));
  }
  return box;
}

/* A hook with sound gets a thin line along its bottom, like a phone video's:
   where the loop is, and draggable to any moment. No other controls. It sits
   beside the link, so dragging it never opens the demo. */
function scrubBar(video: HTMLVideoElement): HTMLElement {
  const fill = el('span', { class: 'scrub-fill' });
  const bar = el('div', { class: 'scrub', 'aria-hidden': 'true' }, fill);
  const show = () => {
    const d = video.duration || 0;
    fill.style.transform = `scaleX(${d ? video.currentTime / d : 0})`;
  };
  // timeupdate is a few times a second; follow the frames while playing so the line glides
  let raf = 0;
  const tick = () => {
    show();
    if (!video.paused) raf = requestAnimationFrame(tick);
  };
  video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
  for (const e of ['seeked', 'pause', 'loadedmetadata']) video.addEventListener(e, show);
  const seek = (e: PointerEvent) => {
    const r = bar.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (video.duration) video.currentTime = k * video.duration;
    show();
  };
  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('dragging');
    seek(e);
  });
  bar.addEventListener('pointermove', (e) => { if (bar.hasPointerCapture(e.pointerId)) seek(e); });
  for (const t of ['pointerup', 'pointercancel'] as const) bar.addEventListener(t, () => bar.classList.remove('dragging'));
  return bar;
}
function svgIcon(node: IconNode): HTMLElement {
  const span = el('span', { class: 'focus-icon', 'aria-hidden': 'true' });
  span.innerHTML = lucideSymbolSvg(node);
  return span;
}

function setFocus(li: HTMLLIElement, on: boolean): void {
  if (li.classList.contains('focused') === on) return;
  li.classList.toggle('focused', on);
  const video = li.querySelector<HTMLVideoElement>('.video-thumb video');
  if (!video) return;
  if (on) {
    if (!video.src && video.dataset.src) video.src = video.dataset.src;
    void video.play().catch(() => {});
  } else {
    video.pause();
    video.muted = true;
    const sound = li.querySelector('.focus-sound');
    if (sound) { sound.replaceChildren(svgIcon(VolumeX)); sound.setAttribute('aria-label', 'Sound on'); }
  }
}
