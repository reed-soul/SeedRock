// Crystal — radiating prism cluster (quartz/amethyst habit). High metalness
// reads as faceted gem; pairs well with the toon style for stylized ore.

export const crystal = {
  id: 'crystal',
  name: 'Crystal Cluster',
  latin: 'Crystallus',
  biome: 'underground',
  color: 0xb8d4e8,
  roughness: 0.18,
  metalness: 0.6,
  textures: {
    albedo: 'crystal_albedo.png',
    normal: 'crystal_normal.png',
    roughness: 'crystal_roughness.png',
    triplanarScale: 0.6,
  },
  shape: {
    form: 'crystal',
    radius: 1,
    detail: 4,
    squash: 1,
    stretch: [1, 1, 1],
    offset: [0, 0, 0],
  },
  noise: {
    scale: 1.5,
    offset: [0.3, 0.7, 0.5],
    octaves: 3,
    lacunarity: 2,
    gain: 0.45,
    amplitude: 0.06,
    microAmplitude: 0.02,
    ridged: false,
  },
  erosion: {
    thermal: { enabled: false },
    hydraulic: { enabled: false },
    edgeWear: { enabled: true, strength: 0.03 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
