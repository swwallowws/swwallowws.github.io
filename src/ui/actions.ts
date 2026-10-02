/* The ways out to the full product, under a tool's summary (welcome page) and
   in an older project page's head. The picture already leads to the demo, so
   there is no "Try it": only up to two quiet outlined buttons out to the full
   product, each opening in a new tab. The first is always called "Full
   version", the same words as the project page's button and the end of every
   demo's tour; a second keeps its own label (GitHub, say). A tool with a demo
   but no product yet says "Full version coming soon" in the same slot. */

import type { ProjectEntry } from '../data/projects.js';
import { el } from './shared.js';

const MAX_GET = 2;

/** The one name for the way to the full product, wherever it appears. */
export const FULL_VERSION = 'Full version';

/** `page` is the tool's page URL on the welcome page, or null on the page itself. */
export function actions(p: ProjectEntry, _page: string | null): HTMLElement | null {
  const live = !!p.live && 'url' in p.live;
  const row = el('div', { class: 'actions' });

  const get = (p.get ?? []).slice(0, MAX_GET);
  get.forEach((g, i) => {
    const label = i === 0 ? FULL_VERSION : g.label;
    row.append(
      el(
        'a',
        {
          class: 'btn btn-quiet',
          href: g.href,
          target: '_blank',
          rel: 'noopener',
          'aria-label': `${i === 0 ? `The full version of ${p.name}: ${g.label}` : (g.name ?? `${g.label}: ${p.name}`)} (opens in a new tab)`,
        },
        label,
        el('span', { class: 'ext', 'aria-hidden': 'true' }, '↗'),
      ),
    );
  });
  if (!get.length && (live || p.comingTo)) {
    row.append(el('span', { class: 'full-coming' }, p.comingTo ? `Coming soon to ${p.comingTo}` : 'Full version coming soon'));
  }

  return row.childElementCount ? row : null;
}
