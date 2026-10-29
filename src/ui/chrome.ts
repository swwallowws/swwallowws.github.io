/* Top bar and footer shared by every page. The site is Night only (every
   video and the stage are dark, so a light page framed them as boxes): each
   page entry sets data-theme="night", and there is no colour mode switch. */

import { homeMarkSvg } from './glyphs.js';
import { el, href } from './shared.js';

/** Fired on window after the mode changes, so framed demos can follow it
    (kept for project.ts; with Night only it no longer fires). */
export const THEME_EVENT = 'showcase-theme';

export function renderBar(): HTMLElement {
  document.documentElement.dataset['theme'] = 'night';

  // The swwallowws mark (the same one as the welcome page's tab icon) sits
  // before the name; it's decorative, the link's name is the text.
  const mark = el('span', { class: 'wordmark-mark', 'aria-hidden': 'true' });
  mark.innerHTML = homeMarkSvg(); // static markup from glyphs.ts, no user input
  return el(
    'header',
    { class: 'bar' },
    el(
      'div',
      { class: 'bar-inner' },
      el('a', { class: 'wordmark', href: href('') }, mark, 'swwallowws'),
      // the one link out of the site as a whole; there is no footer
      el('a', { class: 'bar-link', href: 'https://github.com/swwallowws' }, 'GitHub', el('span', { class: 'ext', 'aria-hidden': 'true' }, '↗')),
    ),
  );
}
