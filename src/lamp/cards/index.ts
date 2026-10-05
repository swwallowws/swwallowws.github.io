/* Every project's lamp card, by project id (the ids in src/data/projects.ts). */

import type { CardDef } from '../engine.js';
import { comingUndone } from './coming-undone.js';
import { readySet } from './ready-set.js';
import { rearranged } from './rearranged.js';
import { starling } from './starling.js';
import { ysad } from './ysad.js';

export const LAMP_CARDS: Record<string, CardDef> = {
  voxmpe: starling,
  stemscribe: comingUndone,
  rearranged,
  tabridge: readySet,
  ysad,
};
