/* The dev-only gallery (lamp-gallery.html): every lamp card, or one with
   ?card=<project id> (a project page's flow card is <project id>-flow); &still=1 fills the window with a still for the share
   cards; &silent=1 mounts them silent, as the welcome page does;
   &theme=paper|night forces a mode. Used by scripts/lamp-check.mjs and the
   share-card captures in visuals/manifest.json. */

import '../../vendor/design/tokens.css';
import { mountCard } from './engine.js';
import { LAMP_CARDS, LAMP_FLOW_CARDS } from './cards/index.js';

const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme === 'paper' || theme === 'night') document.documentElement.dataset['theme'] = theme;
const only = q.get('card');
const still = q.has('still');
const silent = q.has('silent');
if (still) document.body.classList.add('still');

const grid = document.getElementById('grid');
if (!grid) throw new Error('#grid is missing');
const all = [
  ...Object.entries(LAMP_CARDS),
  ...Object.entries(LAMP_FLOW_CARDS).map(([id, def]) => [`${id}-flow`, def] as const),
];
for (const [id, def] of all) {
  if (only && id !== only) continue;
  const host = document.createElement('div');
  host.id = id;
  grid.append(host);
  mountCard(host, def, { label: `${id}. Click or press Enter to play.`, still, silent });
}
