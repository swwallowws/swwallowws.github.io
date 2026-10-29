/* The links to a tool, on the welcome page (under its summary) and in its
   project page's head, said the same way in both.

   A tool's ways in are said once: each format it ships as, named as itself
   and linking to where it lives ("browser studio ↗", "ableton live extension
   ↗"), then, on the tool's own page, GitHub where the code is open. "Command line" isn't named: the
   tools that have one are open source, so GitHub stands for it. Formats with
   nowhere to go yet are plain text, ending ", coming soon".

   On the welcome page the row starts with the demo, a filled chip in the
   tool's colour ("How it works" where there is no demo), and a tool whose
   formats are one flow says so in one line instead (`ways`, home.ts). */

import type { ProjectEntry } from '../data/projects.js';
import { el } from './shared.js';

const MAX_GET = 4;
const isGitHub = (href: string): boolean => href.startsWith('https://github.com/');
/** Formats left unnamed (see above). */
const UNNAMED = new Set(['Command line']);

/** Where a tool's way in leads from the welcome page: its demo, where it has one, else its page. */
export function wayIn(p: ProjectEntry, page: string): { href: string; live: boolean } {
  const live = !!p.live && 'url' in p.live;
  return { href: live ? `${page}#demo` : page, live };
}

function out(label: string, href: string, spoken: string, className: string): HTMLElement {
  return el(
    'a',
    { class: className, href, target: '_blank', rel: 'noopener', 'aria-label': `${spoken} (opens in a new tab)` },
    label,
    el('span', { class: 'ext', 'aria-hidden': 'true' }, '↗'),
  );
}

/** The tool's formats as links (`format` class), then its other links such as
    GitHub (`other`), then any formats with nowhere to go yet as one plain line (`plain`). */
export function formatLinks(p: ProjectEntry, cls: { format: string; other: string; plain: string }, github = true): HTMLElement[] {
  const live = !!p.live && 'url' in p.live;
  const get = (p.get ?? []).slice(0, MAX_GET);
  const nodes: HTMLElement[] = [];
  const unlinked: string[] = [];
  for (const f of (p.availableAs ?? []).filter((f) => !UNNAMED.has(f))) {
    const g = get.find((g) => g.as === f);
    if (g) nodes.push(out(f, g.href, g.name ?? `${p.name}: ${f}`, cls.format));
    else unlinked.push(f);
  }
  for (const g of get.filter((g) => !g.as && (github || !isGitHub(g.href)))) nodes.push(out(g.label, g.href, g.name ?? `${g.label}: ${p.name}`, cls.other));
  if (unlinked.length && (live || p.comingTo)) {
    const soon = p.comingTo ? `, coming soon to ${p.comingTo}` : ', coming soon';
    nodes.push(el('span', { class: cls.plain }, unlinked.join(' · ') + soon));
  }
  return nodes;
}

/** The welcome page's row under a tool's summary; `page` is the tool's page URL. */
export function actions(p: ProjectEntry, page: string): HTMLElement {
  const to = wayIn(p, page);
  const row = el('div', { class: 'actions' });
  row.append(
    el(
      'a',
      { class: `btn btn-try${to.live ? ' btn-demo' : ''}`, href: to.href },
      to.live ? 'Demo' : 'How it works',
      el('span', { class: 'ext', 'aria-hidden': 'true' }, '→'),
    ),
  );
  // GitHub is said on the tool's own page, not here
  if (!p.ways) row.append(...formatLinks(p, { format: 'btn btn-quiet', other: 'btn btn-quiet', plain: 'format' }, false));
  return row;
}
