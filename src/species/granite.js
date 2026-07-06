// Granite — coarse-grained igneous rock with blocky fractures and rounded edges.

/** @typedef {typeof granite} RockPreset */

export const granite = {
  id: 'granite',
  name: 'Granite',
  latin: 'Granitum',
  biome: 'temperate',
  color: 0x9a9590,
  roughness: 0.92,
  metalness: 0.02,
  textures: {
    albedo: 'granite_albedo.png',
    normal: 'granite_normal.png',
    roughness: 'granite_roughness.png',
    triplanarScale: 0.45,
  },
  shape: {
    radius: 1,
    detail: 4,
    squash: 0.88,
    stretch: [1.0, 1.05, 0.95],
    offset: [0, 0.15, 0],
  },
  noise: {
    scale: 1.8,
    offset: [0.4, 1.2, 0.7],
    octaves: 5,
    lacunarity: 2.1,
    gain: 0.48,
    amplitude: 0.28,
    microAmplitude: 0.035,
    ridged: true,
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
