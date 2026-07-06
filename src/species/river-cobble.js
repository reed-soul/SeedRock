// River cobble — water-worn rounded stones, smooth low-profile silhouette.

export const riverCobble = {
  id: 'riverCobble',
  name: 'River Cobble',
  latin: 'Glarea fluvialis',
  biome: 'temperate',
  color: 0x7a756e,
  roughness: 0.78,
  metalness: 0.01,
  textures: {
    albedo: 'river_cobble_albedo.png',
    normal: 'river_cobble_normal.png',
    roughness: 'river_cobble_roughness.png',
    triplanarScale: 0.52,
  },
  shape: {
    radius: 0.85,
    detail: 4,
    squash: 0.62,
    stretch: [1.12, 0.68, 1.08],
    offset: [0, 0.05, 0],
  },
  noise: {
    scale: 1.4,
    offset: [0.8, 0.6, 1.4],
    octaves: 4,
    lacunarity: 2.0,
    gain: 0.38,
    amplitude: 0.16,
    microAmplitude: 0.02,
    ridged: false,
  },
  erosion: {
    thermal: { enabled: true, iterations: 18, talus: 0.025, rate: 0.45 },
    hydraulic: { enabled: true, droplets: 160, steps: 32, erosion: 0.35, deposit: 0.18 },
    edgeWear: { enabled: true, strength: 0.03 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
