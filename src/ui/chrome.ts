/* Top bar and footer shared by every page. The colour mode switch is the
   design system's (System, Paper, Night as symbols). */

import { themeSwitch } from '../../vendor/design/themeswitch.js';
import { homeMarkSvg } from './glyphs.js';
import { el, href } from './shared.js';
import { termsSwitch } from './terms.js';

/** Fired on window after the mode changes, so framed demos can follow it. */
export const THEME_EVENT = 'showcase-theme';

export function renderBar(): HTMLElement {
  const modes = el('div', { class: 'modes' });
  // saved under the key every product shares (THEME_KEY), so the studios open in the same mode
  themeSwitch(modes, { onChange: () => window.dispatchEvent(new Event(THEME_EVENT)) });

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
      el('div', { class: 'bar-end' }, termsSwitch(), modes),
    ),
  );
}

export function renderFooter(): HTMLElement {
  return el(
    'footer',
    { class: 'foot' },
    el(
      'div',
      { class: 'foot-inner' },
      el('span', {}, 'swwallowws'),
      el('a', { href: 'https://github.com/swwallowws' }, 'GitHub'),
    ),
  );
}
