/**
 * Curated demo presets for the examples gallery.
 * Each entry deep-links into the main viewer via URL query params.
 *
 * @typedef {object} RockExample
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} speciesKey
 * @property {number} seed
 * @property {'single'|'living'} [sceneMode]
 * @property {{ moss?: number, snow?: number }} [overlay]
 * @property {{ scatterCount?: number }} [scene]
 * @property {string[]} [tags]
 */

/** @type {RockExample[]} */
export const EXAMPLES = [
  {
    id: 'karst-living',
    title: 'Karst Canyon',
    description: 'Dissolution-sculpted cliff with scattered boulders — the default showcase.',
    speciesKey: 'karst',
    seed: 3310,
    sceneMode: 'living',
    scene: { scatterCount: 20 },
    overlay: { moss: 0.18 },
    tags: ['showcase', 'scene', 'karst'],
  },
  {
    id: 'glacial-snow',
    title: 'Glacial Erratic',
    description: 'Alpine frost-scoured granite with triplanar snow on flat faces.',
    speciesKey: 'glacial',
    seed: 7007,
    overlay: { snow: 0.85 },
    tags: ['alpine', 'snow', 'hero'],
  },
  {
    id: 'sandstone-moss',
    title: 'Mossy Sandstone',
    description: 'Temperate cliff face with slope-driven moss texture overlay.',
    speciesKey: 'sandstone',
    seed: 5566,
    overlay: { moss: 0.72 },
    tags: ['temperate', 'moss'],
  },
  {
    id: 'living-cliff',
    title: 'Living Cliff',
    description: 'Cliff wall with scattered boulders — full scene composition.',
    speciesKey: 'granite',
    seed: 2048,
    sceneMode: 'living',
    scene: { scatterCount: 18 },
    tags: ['scene', 'living'],
  },
  {
    id: 'river-scatter',
    title: 'River Cobble Field',
    description: 'Water-worn pebbles in a living scatter layout.',
    speciesKey: 'riverCobble',
    seed: 9090,
    sceneMode: 'living',
    scene: { scatterCount: 22 },
    tags: ['scene', 'river'],
  },
  {
    id: 'schist-community',
    title: 'Schist (Community)',
    description: 'Foliated metamorphic layers — example species from PR #14.',
    speciesKey: 'schist',
    seed: 4242,
    tags: ['metamorphic', 'community'],
  },
];
