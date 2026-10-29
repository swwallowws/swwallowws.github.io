/* Terms that explain themselves (glossary in src/data/terms.ts). After a page is
   drawn, the first use of each term in its text gets a quiet dotted underline;
   hover, focus or a tap opens its note. */

import { marksIn, type Term } from '../data/terms.js';
import { el } from './shared.js';

/* Text in these stays as it is: links and controls (a note inside them would
   fight the click), code, the page title, labels, badges, decorative text. */
const SKIP = 'a, button, code, h1, dt, svg, iframe, script, style, .term, .badges, .sr-only, [aria-hidden="true"], .name-tag, .lamp-wide, .lamp-thumb, .full-versions';

let count = 0;
function termEl(term: Term, word: string): HTMLElement {
  const id = `term-note-${count++}`;
  const note = el(
    'span',
    { class: 'term-note', id, role: 'tooltip' },
    ...(term.image ? [el('img', { src: term.image.src, alt: term.image.alt, loading: 'lazy' })] : []),
    el('span', { class: 'term-text' }, term.text),
  );
  const node = el('span', { class: 'term', 'data-term': term.id, tabindex: '0', 'aria-describedby': id }, word, note);
  // An open note near the edge of the window slides back inside it.
  const fit = (): void => void requestAnimationFrame(() => {
    note.style.removeProperty('--shift');
    const r = note.getBoundingClientRect();
    if (!r.width) return;
    const room = document.documentElement.clientWidth - 8;
    const shift = r.right > room ? room - r.right : r.left < 8 ? 8 - r.left : 0;
    if (shift) note.style.setProperty('--shift', `${Math.round(shift)}px`);
  });
  node.addEventListener('mouseenter', fit);
  node.addEventListener('focusin', fit);
  return node;
}

/** Marks the first use of each glossary term in `root`'s text, in page order. */
export function markTerms(root: HTMLElement, page: string): void {
  const seenOnPage = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const t of texts) {
    const pieces = marksIn(t.data, page, seenOnPage);
    if (pieces.length === 1 && typeof pieces[0] === 'string') continue;
    t.replaceWith(...pieces.map((p) => (typeof p === 'string' ? p : termEl(p.term, p.word))));
  }
}
