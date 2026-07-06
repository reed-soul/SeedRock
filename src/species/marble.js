// Marble — metamorphic carbonate, polished white with dark veining. Low
// roughness reads as a honed/tumbled surface; the triplanar scale is fine to
// bring out the vein detail in the albedo.

export const marble = {
  id: 'marble',
  name: 'Marble',
  latin: 'Marmor',
  biome: 'underground',
  color: 0xe8e4dc,
  roughness: 0.28,
  metalness: 0.05,
  textures: {
    albedo: 'marble_albedo.png',
    normal: 'marble_normal.png',
    roughness: 'marble_roughness.png',
    triplanarScale: 0.5,
  },
  shape: {
    radius: 1,
    detail: 5,
    squash: 0.92,
    stretch: [1.0, 1.02, 0.98],
    offset: [0, 0.1, 0],
  },
  noise: {
    scale: 1.6,
    offset: [0.8, 1.4, 0.5],
    octaves: 4,
    lacunarity: 2.2,
    gain: 0.45,
    amplitude: 0.14,
    microAmplitude: 0.02,
    ridged: false,
  },
  erosion: {
    thermal: { enabled: true, iterations: 5, talus: 0.03, rate: 0.18 },
    hydraulic: { enabled: true, droplets: 40, steps: 14, erosion: 0.1, deposit: 0.05 },
    edgeWear: { enabled: true, strength: 0.04 },
  },
  lod: {
    full: { detail: 5 },
    reduced: { detail: 3 },
    impostor: { detail: 1 },
  },
};
