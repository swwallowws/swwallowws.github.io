/* Small DOM-builder helper, matching soundesign's src/ui/shared.ts. */

import { BADGE_LINKS, type ProjectEntry } from '../data/projects.js';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

/** A site-internal link that still works if the site moves under a sub-path. */
export function href(path: string): string {
  return import.meta.env.BASE_URL + path;
}

/** A row of text badges for recognisable formats, apps and hardware. A badge
    listed in BADGE_LINKS links to its official page wherever it appears. */
export function badges(names: string[], className = 'badges'): HTMLElement {
  return el(
    'ul',
    { class: className },
    ...names.map((n) => {
      const url = BADGE_LINKS[n];
      return el('li', { class: 'badge' }, url ? el('a', { href: url }, n) : n);
    }),
  );
}

/** Labelled rows (design's .labelled): a small label, then its content. */
export function labelled(rows: [string, Node | string][], className = 'labelled'): HTMLElement {
  return el('dl', { class: className }, ...rows.flatMap(([dt, dd]) => [el('dt', {}, dt), el('dd', {}, dd)]));
}

/** "Available as" and "Works in" as labelled badge rows, or null when a
    project has neither. */
export function whereRows(p: ProjectEntry, className = 'labelled'): HTMLElement | null {
  const rows: [string, Node][] = [];
  if (p.availableAs?.length) rows.push(['Available as', badges(p.availableAs)]);
  if (p.worksIn?.length) rows.push(['Works in', badges(p.worksIn)]);
  return rows.length ? labelled(rows, className) : null;
}

/** A small uppercase mono label, as used for section headings across the projects. */
export function eyebrow(text: string): HTMLElement {
  return el('p', { class: 'eyebrow' }, text);
}
