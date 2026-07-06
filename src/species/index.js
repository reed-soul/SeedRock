import { granite } from './granite.js';
import { sandstone } from './sandstone.js';
import { basalt } from './basalt.js';
import { limestone } from './limestone.js';
import { volcanic } from './volcanic.js';

export const SPECIES = {
  granite,
  sandstone,
  basalt,
  limestone,
  volcanic,
};

export const DEFAULT_SPECIES = 'granite';

export const SPECIES_LIST = Object.values(SPECIES);
