/* The dev-only gallery (lamp-gallery.html): every lamp card, or one with
   ?card=<project id>; &still=1 fills the window with a still for the share
   cards; &theme=paper|night forces a mode. Used by scripts/lamp-check.mjs and
   the share-card captures in visuals/manifest.json. */

import '../../vendor/design/tokens.css';
import { mountCard } from './engine.js';
import { LAMP_CARDS } from './cards/index.js';

const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme === 'paper' || theme === 'night') document.documentElement.dataset['theme'] = theme;
const only = q.get('card');
const still = q.has('still');
if (still) document.body.classList.add('still');

const grid = document.getElementById('grid');
if (!grid) throw new Error('#grid is missing');
for (const [id, def] of Object.entries(LAMP_CARDS)) {
  if (only && id !== only) continue;
  const host = document.createElement('div');
  host.id = id;
  grid.append(host);
  mountCard(host, def, { label: id, still });
}
