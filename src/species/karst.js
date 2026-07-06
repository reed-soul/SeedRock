// Karst — limestone dissolution: pitted surface, sharp ridges, cave-weathered forms.

export const karst = {
  id: 'karst',
  name: 'Karst',
  latin: 'Karsticus',
  biome: 'temperate',
  color: 0xc8c0b0,
  roughness: 0.9,
  metalness: 0,
  textures: {
    albedo: 'karst_albedo.png',
    normal: 'karst_normal.png',
    roughness: 'karst_roughness.png',
    triplanarScale: 0.44,
  },
  shape: {
    radius: 1,
    detail: 4,
    squash: 0.92,
    stretch: [0.95, 1.1, 1.0],
    offset: [0, 0.18, 0],
  },
  noise: {
    scale: 2.8,
    offset: [1.6, 0.5, 2.1],
    octaves: 6,
    lacunarity: 2.5,
    gain: 0.58,
    amplitude: 0.34,
    microAmplitude: 0.055,
    ridged: true,
  },
  erosion: {
    thermal: { enabled: true, iterations: 11, talus: 0.032, rate: 0.32 },
    hydraulic: { enabled: true, droplets: 110, steps: 26, erosion: 0.26, deposit: 0.12 },
    edgeWear: { enabled: true, strength: 0.09 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
