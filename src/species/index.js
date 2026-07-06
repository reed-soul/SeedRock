import { granite } from './granite.js';
import { sandstone } from './sandstone.js';
import { basalt } from './basalt.js';
import { limestone } from './limestone.js';
import { volcanic } from './volcanic.js';
import { glacial } from './glacial.js';
import { riverCobble } from './river-cobble.js';
import { karst } from './karst.js';
import { schist } from './schist.js';

export const SPECIES = {
  granite,
  sandstone,
  basalt,
  limestone,
  volcanic,
  glacial,
  riverCobble,
  karst,
  schist,
};

export const DEFAULT_SPECIES = 'karst';

export const SPECIES_LIST = Object.values(SPECIES);
