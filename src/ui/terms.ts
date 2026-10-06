/* Terms that explain themselves (glossary in src/data/terms.ts). After a page is
   drawn, the first use of each term in its text gets a quiet dotted underline;
   hover, focus or a tap opens its note, with a "Got it" that retires that term for
   this visitor everywhere. The "Explain terms" switch in the top bar turns every
   note off. Both choices live in the visitor's browser only. */

import { marksIn, type Term } from '../data/terms.js';
import { el } from './shared.js';

const OFF_KEY = 'swwallowws:terms-off';
const SEEN_KEY = 'swwallowws:terms-seen';

/* Text in these stays as it is: links and controls (a note inside them would
   fight the click), code, the page title, labels, badges, decorative text. */
const SKIP = 'a, button, code, h1, dt, svg, iframe, script, style, .term, .badges, .sr-only, [aria-hidden="true"], .name-tag, .lamp-wide, .lamp-thumb';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode: this visit only */ }
}
function seenIds(): Set<string> {
  try { return new Set(JSON.parse(read(SEEN_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}

function applyOff(off: boolean): void {
  if (off) document.documentElement.dataset['terms'] = 'off';
  else delete document.documentElement.dataset['terms'];
}

let count = 0;
function termEl(term: Term, word: string, seen: boolean): HTMLElement {
  const id = `term-note-${count++}`;
  const got = el('button', { type: 'button', class: 'term-got' }, 'Got it');
  const note = el(
    'span',
    { class: 'term-note', id, role: 'tooltip' },
    ...(term.image ? [el('img', { src: term.image.src, alt: term.image.alt, loading: 'lazy' })] : []),
    el('span', { class: 'term-text' }, term.text),
    got,
  );
  const node = el('span', { class: seen ? 'term seen' : 'term', 'data-term': term.id, tabindex: seen ? '-1' : '0', 'aria-describedby': id }, word, note);
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
  got.addEventListener('click', (e) => {
    e.preventDefault();
    const all = seenIds();
    all.add(term.id);
    write(SEEN_KEY, JSON.stringify([...all]));
    for (const t of document.querySelectorAll<HTMLElement>(`.term[data-term="${CSS.escape(term.id)}"]`)) {
      t.classList.add('seen');
      t.tabIndex = -1;
    }
    (document.activeElement as HTMLElement | null)?.blur();
  });
  return node;
}

/** Marks the first use of each glossary term in `root`'s text, in page order. */
export function markTerms(root: HTMLElement, page: string): void {
  applyOff(read(OFF_KEY) === '1');
  const seenOnPage = new Set<string>();
  const retired = seenIds();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const t of texts) {
    const pieces = marksIn(t.data, page, seenOnPage);
    if (pieces.length === 1 && typeof pieces[0] === 'string') continue;
    t.replaceWith(...pieces.map((p) => (typeof p === 'string' ? p : termEl(p.term, p.word, retired.has(p.term.id)))));
  }
}

/** The top bar's "Explain terms" switch. */
export function termsSwitch(): HTMLElement {
  const off = read(OFF_KEY) === '1';
  applyOff(off);
  const b = el(
    'button',
    { type: 'button', class: 'terms-switch', 'aria-pressed': off ? 'false' : 'true', 'aria-label': 'Explain terms', title: 'Show or hide the notes on technical terms' },
    el('span', { class: 'long' }, 'Explain '),
    'terms',
  );
  b.addEventListener('click', () => {
    const nowOff = b.getAttribute('aria-pressed') === 'true';
    b.setAttribute('aria-pressed', nowOff ? 'false' : 'true');
    write(OFF_KEY, nowOff ? '1' : null);
    applyOff(nowOff);
  });
  return b;
}
