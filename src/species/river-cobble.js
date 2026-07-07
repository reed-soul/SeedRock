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

  controls: [
    {
      key: 'roundness', name: 'Roundness', group: 'shape',
      min: 0, max: 1, step: 0.05,
      // the Domokos–Gibbons target: how spherical the cobble has become. Low
      // amplitude + low micro = well-rounded (see docs/generation-design.md §4).
      get: (s) => 1 - Math.min(1, (s.noise.amplitude ?? 0.16) / 0.3),
      set: (s, v) => { s.noise.amplitude = (1 - v) * 0.3; },
    },
    {
      key: 'surfacePolish', name: 'Surface polish', group: 'surface',
      min: 0, max: 1, step: 0.01,
      // river-worn smoothness — inversely maps to micro amplitude.
      get: (s) => 1 - (s.noise.microAmplitude ?? 0.02) / 0.05,
      set: (s, v) => { s.noise.microAmplitude = (1 - v) * 0.05; },
    },
    {
      key: 'fluvialWear', name: 'Fluvial wear', group: 'erosion',
      min: 0, max: 1, step: 0.01,
      // strongest hydraulic erosion in the set — cobbles live in water.
      get: (s) => Math.min(1, (s.erosion.hydraulic?.erosion ?? 0.35) / 0.5),
      set: (s, v) => { s.erosion.hydraulic.erosion = v * 0.5; },
    },
  ],
};
