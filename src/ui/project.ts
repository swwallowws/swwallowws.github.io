/* One project page: a contained first screen (the head beside the live
   demo), then the project's story beat by beat.
   Each beat pairs a heading and a sentence or two with the visual that shows
   it, so text and visuals alternate. Wide visuals (live tools, flows,
   screenshot rows) sit under their text at full width; the rest (videos
   included) sit beside it, alternating sides. Empty
   slots render as labelled placeholders, so filling one later is a data change. */

import { categoryLabel, type Beat, type ProjectEntry, type Slot } from '../data/projects.js';
import { LAMP_CARDS, LAMP_FLOW_CARDS } from '../lamp/cards/index.js';
import { mountCard, type CardDef } from '../lamp/engine.js';
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX, type IconNode } from 'lucide';
import { VISUALS } from '../data/visuals.generated.js';
import { actions, FULL_VERSION } from './actions.js';
import { THEME_EVENT } from './chrome.js';
import { lucideSymbolSvg } from './glyphs.js';
import { badges, el, eyebrow, href, whereRows } from './shared.js';

const WIDE = new Set(['live', 'flow', 'shots']);

/* A project with a live demo opens on one contained screen: the name, lead
   and three or four highlights on the left, the demo on the right at a modest
   size, both starting on the same top line. The highlights are the titles of
   the story beats that follow, each linking down to its beat. The live beat
   itself is the demo, so it isn't repeated below. */
const HIGHLIGHTS = 4;

export function renderProject(main: HTMLElement, p: ProjectEntry): void {
  document.documentElement.dataset['category'] = p.categories[0]!;

  const story = p.story ?? [];
  const liveBeat = p.live && 'url' in p.live ? story.find((b) => b.show === 'live') : undefined;
  const rest = story.filter((b) => b !== liveBeat);

  // The back link sits above the hero, so the text and the demo share one top line.
  main.append(el('a', { class: 'back', href: href('') }, '← all projects'));
  const text = el(
    'div',
    { class: 'page-head' },
    // Pages with the new head (details in place of the lead) drop the category line.
    ...(p.parts ? [] : [eyebrow(p.categories.map(categoryLabel).join(' · '))]),
    // --chars lets a long name scale down to its column instead of overflowing.
    // The new head puts the way to the full product at the far right of the
    // title's row: its first destination (GitHub for now, later a store).
    p.parts && p.get?.[0]
      ? el(
          'div',
          { class: 'head-top' },
          titleEl(p),
          el(
            'a',
            {
              class: 'btn btn-try full-version',
              href: p.get[0].href,
              target: '_blank',
              rel: 'noopener',
              'aria-label': `The full version of ${p.name}: ${p.get[0].label} (opens in a new tab)`,
            },
            FULL_VERSION,
            el('span', { class: 'ext', 'aria-hidden': 'true' }, '↗'),
          ),
        )
      : p.parts && (p.comingTo || (p.live && 'url' in p.live))
        ? el('div', { class: 'head-top' }, titleEl(p), el('span', { class: 'full-coming big' }, p.comingTo ? `Coming soon to ${p.comingTo}` : 'Full version coming soon'))
        : titleEl(p),
    ...(p.line ? [el('p', { class: 'tool-line big' }, p.line)] : []),
  );
  if (p.parts) {
    // The details: the summary, what you give it, what it does, what you get,
    // then what it is available as and works in, one labelled block.
    // Technical terms get their notes after the page is drawn (ui/terms.ts).
    text.append(el('p', { class: 'lede' }, p.summary ?? p.lead));
    // The details, then the facts. Available as, Works in and Built with
    // start folded to their label and open sideways on hover or focus.
    const dl = el('dl', { class: 'labelled big details' });
    const row = (label: string, content: Node | string | (Node | string)[], fold = false): void => {
      const dd = el('dd', fold ? { class: 'fold' } : {}, ...[content].flat());
      const dt = el('dt', fold ? { class: 'fold', tabindex: '0' } : {}, label);
      dl.append(dt, dd);
    };
    row('Give it', p.parts.give);
    row('It', p.parts.does);
    row('Get', p.parts.get);
    if (p.availableAs?.length) row('Available as', badges(p.availableAs), true);
    if (p.worksIn?.length) row('Works in', badges(p.worksIn), true);
    if (p.builtWith?.length) row('Built with', badges(p.builtWith), true);
    if (p.credit) row('Thanks', p.credit);
    text.append(dl);
  } else {
    text.append(
      el('p', { class: 'fromto big' }, p.from, el('span', { class: 'arrow' }, ' → '), p.to),
      el('p', { class: 'lede' }, p.lead),
    );
  }
  // "Try it" and the way out to the full product, right under the lead
  // (the new head has none: the demo follows right under it).
  const row = p.parts ? null : actions(p, null);
  if (row) text.append(row);
  // The new head (details in place of the lead) has no list of later sections.
  if (liveBeat && rest.length && !p.parts) {
    text.append(
      el(
        'ul',
        { class: 'highlights' },
        ...rest.slice(0, HIGHLIGHTS).map((b) => el('li', {}, el('a', { href: `#${beatId(b)}` }, b.title))),
      ),
    );
  }
  if (!p.parts) {
    const where = whereRows(p, 'labelled big');
    if (where) text.append(where);
    else if (p.worksWith) text.append(badges(p.worksWith, 'badges big'));
  }

  // The project's lamp card (src/lamp/), on its own, wide, between the head and
  // the rest: only where there is no live demo, since a demo shows the tool
  // itself, and no flow of steps to merge it with (see flowWithCard).
  const def = liveBeat || flowCard(p) ? undefined : LAMP_CARDS[p.id];
  const lamp = def ? el('section', { class: 'lamp-wide' }) : null;
  if (lamp && def) mountCard(lamp, def, { label: `${p.name}: ${p.summary ?? p.lead}. Click or press Enter to play it.` });

  if (liveBeat && p.live && 'url' in p.live && p.parts) {
    // The new layout: the description on its own, the card, then the demo
    // full width below it, at its own full height.
    main.append(el('section', { class: 'project-hero single' }, text));
    if (lamp) main.append(lamp);
    const demo = liveDemo(p.live.url, p.name, liveBeat.title);
    const wide = el('section', { class: 'demo-wide' }, demo.node);
    main.append(wide);
    demo.fit(wide, wide);
  } else if (liveBeat && p.live && 'url' in p.live) {
    const demo = liveDemo(p.live.url, p.name, liveBeat.title);
    const hero = el('section', { class: 'project-hero' }, text, demo.node);
    main.append(hero);
    demo.fit(hero, text);
    if (lamp) main.append(lamp);
  } else {
    main.append(el('section', { class: 'project-hero single' }, text));
    if (lamp) main.append(lamp);
  }

  let side = 0; // alternates beside-visuals left and right
  for (const beat of rest) {
    const visual = beat.show ? visualFor(beat, p) : null;
    // The new layout gives each section one line, set as its heading; the
    // older pages keep a title and a sentence or two.
    const text = p.parts
      ? el('div', { class: 'beat-text' }, el('h2', { class: 'beat-line' }, ...inlineCode(beat.text ?? beat.title)))
      : el(
          'div',
          { class: 'beat-text' },
          el('h2', { class: 'section-title' }, beat.title),
          ...(beat.text ? [el('p', { class: 'prose' }, ...inlineCode(beat.text))] : []),
        );
    let layout = 'beat';
    if (visual && beat.show && WIDE.has(beat.show)) layout += ' wide';
    else if (visual) {
      const flip = beat.side ? beat.side === 'left' : side % 2 === 1;
      side++;
      layout += flip ? ' beside flip' : ' beside';
    }
    const attrs: Record<string, string> = { class: layout, id: beatId(beat) };
    if (beat.show) attrs['data-show'] = beat.show;
    main.append(el('section', attrs, text, ...(visual ? [visual] : [])));
  }

  if (p.parts) return; // the new head already carries the facts
  const facts = el('dl', { class: 'facts' });
  if (p.builtWith) facts.append(el('dt', {}, 'Built with'), el('dd', {}, badges(p.builtWith)));
  if (p.code) facts.append(el('dt', {}, 'Code'), el('dd', {}, slotLink(p.code, 'GitHub')));
  if (p.credit) facts.append(el('dt', {}, 'Thanks'), el('dd', {}, p.credit));
  if (facts.childElementCount) main.append(el('section', { class: 'block' }, eyebrow('Details'), facts));
}

/** The page title. A short name with a long one (YSAD) shows the long one in
    its place on hover or keyboard focus, as the welcome page's tag does; the
    heading's accessible name carries both. */
function titleEl(p: ProjectEntry): HTMLElement {
  if (!p.fullName) return el('h1', { class: 'head', style: `--chars: ${p.name.length}` }, p.name);
  return el(
    'h1',
    { class: 'head has-full', tabindex: '0', 'aria-label': `${p.name} (${p.fullName})`, style: `--chars: ${p.name.length}` },
    el('span', { class: 'short', 'aria-hidden': 'true' }, p.name),
    el('span', { class: 'long', 'aria-hidden': 'true' }, p.fullName),
  );
}

function visualFor(beat: Beat, p: ProjectEntry): HTMLElement | null {
  switch (beat.show) {
    case 'live':
      return p.live ? liveSlot(p.live) : null;
    case 'video': {
      // A recording encoded by `npm run visuals` wins over the data's slot.
      const vis = VISUALS[p.id];
      const videos = vis?.videos ?? [];
      const rec = beat.video ? videos.find((v) => v === beat.video) : videos[0];
      if (rec) {
        const base = href(`visuals/${p.id}/${rec}`);
        return player({ src: `${base}.mp4`, poster: `${base}.jpg`, title: `${p.name}: ${beat.title}`, silent: !!vis?.silent?.includes(rec) });
      }
      return p.video ? videoSlot(p.video, p.name) : null;
    }
    case 'image':
      return p.image ? picture(p.image) : null;
    case 'flow':
      if (!p.flow) return null;
      return flowCard(p) ? flowWithCard(p, flowCard(p)!, beat.text ?? beat.title) : flow(p.flow);
    case 'shots':
      return p.shots ? shots(p.shots) : null;
    case 'keys':
      return p.keys ? keys(p.keys) : null;
    default:
      return null;
  }
}

/* Every framed demo takes ?embed=1 (no page intro, fills the frame) and
   ?theme=paper|night, so it matches the site's mode. System mode sends no
   theme and the demo follows the system scheme like the site does. */
function frameUrl(url: string): string {
  const u = new URL(url);
  u.searchParams.set('embed', '1');
  const theme = document.documentElement.dataset['theme'];
  if (theme === 'paper' || theme === 'night') u.searchParams.set('theme', theme);
  return u.toString();
}

/* A live slot still waiting for its demo. A filled one is the page's hero
   (liveDemo), never a beat. */
function liveSlot(slot: Slot): HTMLElement | null {
  return 'placeholder' in slot ? el('div', { class: 'slot tall' }, slot.placeholder) : null;
}

/* Before the demo reports its height, and if it never does. */
const DEFAULT_DEMO_HEIGHT = 460;
const MIN_CAP = 420;

/* The framed demo, on the page's own background with no outline. No "open it
   on its own" link under it: the demo's own note already links straight to the
   full product (in a new tab when framed), so welcome page, demo, product is
   the whole path. The demo shell (design system) is transparent in ?embed=1 and posts
   { type: 'demo-height', height } whenever its size changes. The frame takes
   that height, capped so the demo and the text beside it fit on the first
   screen; only a demo that truly can't fit scrolls inside. */
function liveDemo(url: string, name: string, title: string): { node: HTMLElement; fit: (hero: HTMLElement, text: HTMLElement) => void } {
  const frame = el('iframe', {
    src: frameUrl(url),
    title: `${name}, running live: ${title}`,
    allow: 'microphone; autoplay',
  });
  frame.style.height = `${DEFAULT_DEMO_HEIGHT}px`;
  const node = el(
    'div',
    // #demo: the welcome page's visuals link here ("Try demo").
    { class: 'live', id: 'demo' },
    frame,
  );
  window.addEventListener(THEME_EVENT, () => {
    frame.src = frameUrl(url);
  });
  // A demo can point at a beat on this page by what it shows, e.g.
  // { type: 'demo-goto', show: 'video' } from "Also on Ableton Push 3".
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== frame.contentWindow) return;
    const d = e.data as { type?: string; show?: string } | null;
    if (!d || d.type !== 'demo-goto' || typeof d.show !== 'string') return;
    const target = document.querySelector<HTMLElement>(`section[data-show="${CSS.escape(d.show)}"]`);
    target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  let wanted = DEFAULT_DEMO_HEIGHT;
  const fit = (hero: HTMLElement, text: HTMLElement): void => {
    const apply = (): void => {
      const stacked = getComputedStyle(hero).gridTemplateColumns.split(' ').length < 2;
      let cap: number;
      if (stacked) {
        // Phones and narrow windows: the demo follows the text and the page
        // scrolls anyway, so the frame takes its full height (a scroll area
        // inside a scrolling page is hard to use on a phone).
        cap = Infinity;
      } else {
        // Desktop: whatever is left of the first screen under the hero's top
        // line, but never less than the text beside it.
        const top = hero.getBoundingClientRect().top + window.scrollY;
        const room = window.innerHeight - top - 56;
        cap = Math.max(MIN_CAP, text.offsetHeight, room);
      }
      frame.style.height = `${Math.min(wanted, cap)}px`;
    };
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const d = e.data as { type?: string; height?: number } | null;
      if (!d || d.type !== 'demo-height' || typeof d.height !== 'number' || !(d.height > 0)) return;
      wanted = Math.ceil(d.height);
      apply();
    });
    window.addEventListener('resize', apply);
    apply();
  };
  return { node, fit };
}

function beatId(b: Beat): string {
  return b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function videoSlot(slot: Slot, name: string): HTMLElement {
  // A short strip until the video exists: a full 16:9 frame of nothing reads as broken.
  if ('placeholder' in slot) return el('div', { class: 'slot slim' }, slot.placeholder);
  return player({ src: slot.url, title: `${name} demo`, silent: false });
}

function icon(node: IconNode): HTMLElement {
  const span = el('span', { class: 'player-icon', 'aria-hidden': 'true' });
  span.innerHTML = lucideSymbolSvg(node);
  return span;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* The site's own video player, in place of the browser's controls: a play
   button over the poster, then one slim bar of play/pause, a seekable line in
   the page's accent, the time, and full screen. A silent video (no audio
   track) says "no sound" where a volume control would be; one with sound gets
   a mute button. */
function player(o: { src: string; poster?: string; title: string; silent: boolean }): HTMLElement {
  const video = el('video', { src: o.src, preload: 'metadata', playsinline: '', title: o.title, ...(o.poster ? { poster: o.poster } : {}) });
  video.muted = o.silent;
  const big = el('button', { class: 'player-big', type: 'button', 'aria-label': 'Play' }, icon(Play));
  const frame = el('div', { class: 'player-frame' }, video, big);
  const toggle = el('button', { class: 'player-btn', type: 'button', 'aria-label': 'Play' }, icon(Play));
  const fill = el('span', { class: 'player-fill' });
  const track = el('div', { class: 'player-track', role: 'slider', tabindex: '0', 'aria-label': 'Seek', 'aria-valuemin': '0' }, fill);
  const time = el('span', { class: 'player-time' }, '0:00');
  const bar = el('div', { class: 'player-bar' }, toggle, track, time);
  if (o.silent) {
    bar.append(el('span', { class: 'player-silent', title: 'This video has no sound' }, icon(VolumeX), 'no sound'));
  } else {
    const mute = el('button', { class: 'player-btn', type: 'button', 'aria-label': 'Mute' }, icon(Volume2));
    mute.addEventListener('click', () => {
      video.muted = !video.muted;
      mute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      mute.replaceChildren(icon(video.muted ? VolumeX : Volume2));
    });
    bar.append(mute);
  }
  const full = el('button', { class: 'player-btn', type: 'button', 'aria-label': 'Full screen' }, icon(Maximize));
  bar.append(full);
  const fig = el('figure', { class: 'player' }, frame, bar);

  const sync = () => {
    const playing = !video.paused && !video.ended;
    fig.classList.toggle('playing', playing);
    toggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    toggle.replaceChildren(icon(playing ? Pause : Play));
  };
  const progress = () => {
    const d = video.duration || 0;
    const t = video.currentTime;
    fill.style.width = d ? `${(t / d) * 100}%` : '0';
    time.textContent = d ? `${clock(t)} / ${clock(d)}` : clock(t);
    track.setAttribute('aria-valuenow', String(Math.round(t)));
    track.setAttribute('aria-valuemax', String(Math.round(d)));
    track.setAttribute('aria-valuetext', `${clock(t)} of ${clock(d)}`);
  };
  const flip = () => (video.paused || video.ended ? void video.play() : video.pause());
  for (const b of [big, toggle, video]) b.addEventListener('click', flip);
  for (const e of ['play', 'pause', 'ended']) video.addEventListener(e, sync);
  for (const e of ['timeupdate', 'loadedmetadata', 'seeked']) video.addEventListener(e, progress);
  // timeupdate fires a few times a second; follow the frames while playing so the line glides
  let raf = 0;
  video.addEventListener('play', () => {
    const tick = () => {
      progress();
      if (!video.paused) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  video.addEventListener('pause', () => cancelAnimationFrame(raf));

  const seekTo = (x: number) => {
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (x - r.left) / r.width));
    if (video.duration) video.currentTime = f * video.duration;
    progress();
  };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
    const move = (m: PointerEvent) => seekTo(m.clientX);
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', () => track.removeEventListener('pointermove', move), { once: true });
  });
  track.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 2 : e.key === 'ArrowLeft' ? -2 : 0;
    if (!step) return;
    e.preventDefault();
    video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
  });

  full.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (fig.requestFullscreen) void fig.requestFullscreen();
    else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.(); // iPhone
  });
  document.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === fig;
    full.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    full.replaceChildren(icon(on ? Minimize : Maximize));
  });
  return fig;
}

function slotLink(slot: Slot, label: string): Node {
  if ('placeholder' in slot) return el('span', { class: 'mut' }, slot.placeholder);
  return el('a', { href: slot.url }, label);
}

/* Paper and Night each get their own screenshot; CSS shows the one that
   matches the current mode, including an explicit toggle choice. */
function picture(img: NonNullable<ProjectEntry['image']>): HTMLElement {
  const wrap = el('div', { class: 'shot' });
  wrap.append(el('img', { src: img.src, alt: img.alt, class: img.srcDark ? 'for-paper' : '', loading: 'lazy' }));
  if (img.srcDark) wrap.append(el('img', { src: img.srcDark, alt: img.alt, class: 'for-night', loading: 'lazy' }));
  return wrap;
}

/** A page's lamp card that merges with its flow of steps, when it has no live demo. */
function flowCard(p: ProjectEntry): CardDef | undefined {
  return p.live && 'url' in p.live ? undefined : LAMP_FLOW_CARDS[p.id];
}

/* The flow of steps with its lamp card on top, in one frame: the card's width
   is the steps' columns, so each column of strings sits above its step. While
   the card plays, the step under the playhead lights up. */
function flowWithCard(p: ProjectEntry, def: CardDef, says: string): HTMLElement {
  const steps = flow(p.flow!);
  const host = el('div', { class: 'lamp-flow' });
  mountCard(host, def, { label: `${p.name}: ${says} Click or press Enter to play it.` });
  new MutationObserver(() => {
    const lit = host.dataset['step'];
    [...steps.children].forEach((li, i) => li.classList.toggle('lit', String(i) === lit));
  }).observe(host, { attributes: true, attributeFilter: ['data-step'] });
  return el('div', { class: 'flow-lamp' }, host, steps);
}

function flow(steps: NonNullable<ProjectEntry['flow']>): HTMLElement {
  return el(
    'ol',
    { class: 'flow' },
    ...steps.map((s, i) =>
      el(
        'li',
        {},
        el('span', { class: 'step-n' }, String(i + 1).padStart(2, '0')),
        el('strong', {}, s.step),
        el('span', { class: 'mut' }, ...inlineCode(s.detail)),
      ),
    ),
  );
}

function shots(list: NonNullable<ProjectEntry['shots']>): HTMLElement {
  return el(
    'div',
    { class: 'shots' },
    ...list.map((s) =>
      el(
        'figure',
        {},
        s.src ? el('img', { src: s.src, alt: s.caption, loading: 'lazy' }) : el('div', { class: 'slot' }, 'screenshot: coming'),
        el('figcaption', {}, s.caption),
      ),
    ),
  );
}

/* A legend: each code in the accent, its meaning beside it. */
function keys(list: NonNullable<ProjectEntry['keys']>): HTMLElement {
  return el(
    'dl',
    { class: 'keys' },
    ...list.flatMap((k) => [el('dt', {}, el('code', {}, k.code)), el('dd', {}, k.meaning)]),
  );
}

/* Backtick spans in the data become <code>. */
function inlineCode(text: string): (Node | string)[] {
  return text.split('`').map((part, i) => (i % 2 ? el('code', {}, part) : part));
}
