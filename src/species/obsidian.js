// Obsidian — volcanic glass, near-black with conchoidal (shell-like) fractures.
// High metalness + very low roughness reads as glassy; ridged noise + strong
// edge wear give the sharp broken-glass silhouette.

export const obsidian = {
  id: 'obsidian',
  name: 'Obsidian',
  latin: 'Lapis obsidianus',
  biome: 'volcanic',
  color: 0x14161a,
  roughness: 0.14,
  metalness: 0.55,
  textures: {
    albedo: 'obsidian_albedo.png',
    normal: 'obsidian_normal.png',
    roughness: 'obsidian_roughness.png',
    triplanarScale: 0.4,
  },
  shape: {
    radius: 1,
    detail: 4,
    squash: 0.95,
    stretch: [1.05, 1.1, 0.95],
    offset: [0, 0.12, 0],
  },
  noise: {
    scale: 2.8,
    offset: [1.5, 0.6, 1.2],
    octaves: 5,
    lacunarity: 2.4,
    gain: 0.5,
    amplitude: 0.26,
    microAmplitude: 0.02,
    ridged: true,
  },
  erosion: {
    thermal: { enabled: true, iterations: 6, talus: 0.04, rate: 0.2 },
    hydraulic: { enabled: false },
    edgeWear: { enabled: true, strength: 0.11 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
