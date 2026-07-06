// Basalt — dark volcanic igneous rock, columnar fractures, angular silhouette.

export const basalt = {
  id: 'basalt',
  name: 'Basalt',
  latin: 'Basaltum',
  biome: 'volcanic',
  color: 0x3a3a42,
  roughness: 0.88,
  metalness: 0.04,
  textures: {
    albedo: 'basalt_albedo.png',
    normal: 'basalt_normal.png',
    roughness: 'basalt_roughness.png',
    triplanarScale: 0.38,
  },
  shape: {
    radius: 1,
    detail: 4,
    squash: 1.05,
    stretch: [0.92, 1.18, 0.92],
    offset: [0, 0.08, 0],
  },
  noise: {
    scale: 2.4,
    offset: [1.1, 0.3, 0.8],
    octaves: 5,
    lacunarity: 2.3,
    gain: 0.52,
    amplitude: 0.24,
    microAmplitude: 0.03,
    ridged: true,
  },
  erosion: {
    thermal: { enabled: true, iterations: 8, talus: 0.045, rate: 0.25 },
    hydraulic: { enabled: true, droplets: 60, steps: 18, erosion: 0.15, deposit: 0.08 },
    edgeWear: { enabled: true, strength: 0.07 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
