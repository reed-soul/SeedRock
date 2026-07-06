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
    id: 'granite-classic',
    title: 'Granite Boulder',
    description: 'Coarse igneous rock with blocky thermal erosion and hydraulic wear.',
    speciesKey: 'granite',
    seed: 42,
    tags: ['igneous', 'hero'],
  },
  {
    id: 'sandstone-desert',
    title: 'Desert Sandstone',
    description: 'Warm sedimentary layers with soft stratification and edge wear.',
    speciesKey: 'sandstone',
    seed: 1204,
    tags: ['sedimentary', 'desert'],
  },
  {
    id: 'basalt-columns',
    title: 'Basalt Outcrop',
    description: 'Dark volcanic stone with angular fractures and fine grain.',
    speciesKey: 'basalt',
    seed: 8801,
    tags: ['igneous', 'volcanic'],
  },
  {
    id: 'karst-cavern',
    title: 'Karst Limestone',
    description: 'Dissolution pits and sharp eroded ridges from cave weathering.',
    speciesKey: 'karst',
    seed: 3310,
    tags: ['sedimentary', 'porous'],
  },
  {
    id: 'glacial-snow',
    title: 'Glacial Erratic',
    description: 'Alpine frost-scoured granite with triplanar snow on flat faces.',
    speciesKey: 'glacial',
    seed: 7007,
    overlay: { snow: 0.85 },
    tags: ['alpine', 'snow'],
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
