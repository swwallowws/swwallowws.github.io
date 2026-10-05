/* Every project's lamp card, by project id (the ids in src/data/projects.ts). */

import type { CardDef } from '../engine.js';
import { comingUndone } from './coming-undone.js';
import { readySet } from './ready-set.js';
import { rearranged } from './rearranged.js';
import { sessionNotes } from './session-notes.js';
import { starling } from './starling.js';
import { tagline } from './tagline.js';
import { taglineFlow } from './tagline-flow.js';
import { ysad } from './ysad.js';

export const LAMP_CARDS: Record<string, CardDef> = {
  voxmpe: starling,
  stemscribe: comingUndone,
  rearranged,
  tabridge: readySet,
  ysad,
  'session-notes': sessionNotes,
  intentional: tagline,
};

/* Cards merged with a project page's flow of steps (the card's width is the
   steps' columns), for pages without a live demo. */
export const LAMP_FLOW_CARDS: Record<string, CardDef> = {
  intentional: taglineFlow,
};
