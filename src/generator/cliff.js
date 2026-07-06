import { PlaneGeometry, Mesh, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise3D } from '../core/noise.js';
import { Rng } from '../core/rng.js';
import { applyErosion } from './erosion.js';

const _v = new Vector3();

/**
 * Procedural cliff face — vertical displaced plane with talus bias at the base.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {{ width?: number, height?: number, segmentsW?: number, segmentsH?: number }} opts
 */
export function generateCliffGeometry(preset, seed, opts = {}) {
  const rng = new Rng(`cliff:${preset.id}:${seed}`);
  const noise = makeNoise3D(rng.int(1, 999_999));
  const width = opts.width ?? 14;
  const height = opts.height ?? 7;
  const segW = opts.segmentsW ?? 48;
  const segH = opts.segmentsH ?? 24;

  const geo = mergeVertices(new PlaneGeometry(width, height, segW, segH));
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const u = (_v.x / width + 0.5);
    const v = (_v.y / height + 0.5);

    const nx = u * preset.noise.scale * 2.2 + preset.noise.offset[0];
    const ny = v * preset.noise.scale * 1.4 + preset.noise.offset[1];
    const nz = preset.noise.offset[2];

    let disp = noise.fbm(nx, ny, nz, preset.noise.octaves, preset.noise.lacunarity, preset.noise.gain);
    if (preset.noise.ridged) {
      disp = 1 - Math.abs(noise.noise(nx * 2, ny * 2, nz));
    }
    disp *= preset.noise.amplitude * 2.2;

    const overhang = noise.ridged(nx * 1.5, ny * 0.8, nz, 3, 2, 0.5) * 0.35;
    const talus = Math.pow(v, 2.5) * 0.6;
    const depth = disp + overhang * (1 - v) - talus * v;

    _v.z += depth;
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }

  geo.computeVertexNormals();
  applyErosion(geo, {
    thermal: { ...preset.erosion.thermal, iterations: 6 },
    hydraulic: { ...preset.erosion.hydraulic, droplets: 50, steps: 16 },
    edgeWear: preset.erosion.edgeWear,
  }, rng);

  geo.translate(0, height / 2, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 */
export function buildCliff(preset, seed, material, opts = {}) {
  const quality = opts.quality ?? 'high';
  const segments = quality === 'low'
    ? { segmentsW: 24, segmentsH: 12 }
    : quality === 'medium'
      ? { segmentsW: 36, segmentsH: 18 }
      : { segmentsW: 48, segmentsH: 24 };

  const geometry = generateCliffGeometry(preset, seed, segments);
  const mesh = new Mesh(geometry, material);
  mesh.name = `cliff_${preset.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, 0, -5.5);
  return mesh;
}
