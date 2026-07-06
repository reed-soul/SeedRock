/**
 * Starter template for new rock species. Copy to `src/species/<your-rock>.js`,
 * fill in values, register in `index.js`, and add textures.
 *
 * @typedef {typeof template} RockPreset
 */

export const template = {
  id: 'myRock',           // camelCase key used in SPECIES registry
  name: 'My Rock',        // display name in GUI
  latin: 'Lapis exempli', // optional scientific label
  biome: 'temperate',     // temperate | desert | volcanic | alpine

  color: 0x9a9590,        // fallback when textures missing
  roughness: 0.9,
  metalness: 0,

  textures: {
    albedo: 'my_rock_albedo.png',
    normal: 'my_rock_normal.png',
    roughness: 'my_rock_roughness.png',
  // ao: 'my_rock_ao.png',   // optional — auto-loaded from <prefix>_ao.png when present
    triplanarScale: 0.45,
  },

  shape: {
    radius: 1,
    detail: 4,            // icosahedron subdivision (1–5)
    squash: 0.88,         // Y scale < 1 = wider than tall
    stretch: [1, 1, 1],
    offset: [0, 0.1, 0],
  },

  noise: {
    scale: 1.8,
    offset: [0.4, 1.2, 0.7],
    octaves: 5,
    lacunarity: 2.1,
    gain: 0.48,
    amplitude: 0.28,
    microAmplitude: 0.035,
    ridged: true,         // true = sharp ridges; false = smooth FBM
  },

  erosion: {
    thermal: { enabled: true, iterations: 10, talus: 0.035, rate: 0.3 },
    hydraulic: { enabled: true, droplets: 90, steps: 22, erosion: 0.2, deposit: 0.1 },
    edgeWear: { enabled: true, strength: 0.05 },
  },

  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
