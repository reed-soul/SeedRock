// Glacial erratic — frost-fractured boulder, blue-gray ice-scoured surfaces.

export const glacial = {
  id: 'glacial',
  name: 'Glacial Erratic',
  latin: 'Erraticum glacialem',
  biome: 'alpine',
  color: 0x8a939c,
  roughness: 0.86,
  metalness: 0.03,
  textures: {
    albedo: 'glacial_albedo.png',
    normal: 'glacial_normal.png',
    roughness: 'glacial_roughness.png',
    triplanarScale: 0.46,
  },
  shape: {
    radius: 1.05,
    detail: 4,
    squash: 0.85,
    stretch: [1.02, 0.92, 1.08],
    offset: [0, 0.1, 0],
  },
  noise: {
    scale: 2.0,
    offset: [0.9, 1.8, 0.5],
    octaves: 5,
    lacunarity: 2.2,
    gain: 0.5,
    amplitude: 0.26,
    microAmplitude: 0.04,
    ridged: true,
  },
  erosion: {
    thermal: { enabled: true, iterations: 12, talus: 0.038, rate: 0.34 },
    hydraulic: { enabled: true, droplets: 100, steps: 24, erosion: 0.22, deposit: 0.11 },
    edgeWear: { enabled: true, strength: 0.06 },
  },
  lod: {
    full: { detail: 4 },
    reduced: { detail: 2 },
    impostor: { detail: 1 },
  },
};
