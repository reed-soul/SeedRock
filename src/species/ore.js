// Ore — mineral vein outcrop: a crystal-cluster form with metallic/
// emissive-leaning material so it reads as a glowing precious-metal deposit.
// Pairs naturally with the toon style for stylized mining-game assets.

export const ore = {
  id: 'ore',
  name: 'Ore Deposit',
  latin: 'Minera',
  biome: 'underground',
  color: 0x5a6b78,
  roughness: 0.4,
  metalness: 0.75,
  textures: {
    albedo: 'ore_albedo.png',
    normal: 'ore_normal.png',
    roughness: 'ore_roughness.png',
    triplanarScale: 0.55,
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
    scale: 1.4,
    offset: [0.4, 0.9, 0.6],
    octaves: 3,
    lacunarity: 2,
    gain: 0.45,
    amplitude: 0.05,
    microAmplitude: 0.02,
    ridged: false,
  },
  erosion: {
    thermal: { enabled: false },
    hydraulic: { enabled: false },
    edgeWear: { enabled: true, strength: 0.04 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
