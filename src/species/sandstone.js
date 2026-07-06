// Sandstone — sedimentary layers, softer edges, horizontal stratification bias.

export const sandstone = {
  id: 'sandstone',
  name: 'Sandstone',
  latin: 'Arenarium',
  biome: 'desert',
  color: 0xc4a574,
  roughness: 0.96,
  metalness: 0,
  textures: {
    albedo: 'sandstone_albedo.png',
    normal: 'sandstone_normal.png',
    roughness: 'sandstone_roughness.png',
    triplanarScale: 0.48,
  },
  shape: {
    radius: 1,
    detail: 4,
    squash: 0.72,
    stretch: [1.15, 0.75, 1.1],
    offset: [0, 0.1, 0],
  },
  noise: {
    scale: 2.2,
    offset: [0.2, 0.5, 1.1],
    octaves: 4,
    lacunarity: 2.0,
    gain: 0.42,
    amplitude: 0.22,
    microAmplitude: 0.025,
    ridged: false,
  },
  erosion: {
    thermal: { enabled: true, iterations: 14, talus: 0.03, rate: 0.38 },
    hydraulic: { enabled: true, droplets: 120, steps: 28, erosion: 0.28, deposit: 0.14 },
    edgeWear: { enabled: true, strength: 0.04 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
