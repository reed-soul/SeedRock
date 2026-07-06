import { IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise3D } from '../core/noise.js';
import { Rng } from '../core/rng.js';
import { applyErosion } from './erosion.js';

const _v = new Vector3();

/**
 * @typedef {import('../species/granite.js').RockPreset} RockPreset
 */

/**
 * Generate a procedural rock mesh from a species preset and seed.
 * @param {RockPreset} preset
 * @param {string|number} seed
 * @param {{ style?: 'pbr'|'lowpoly'|'toon' }} [opts]
 * @returns {import('three').BufferGeometry}
 */
export function generateRockGeometry(preset, seed, opts = {}) {
  const rng = new Rng(`${preset.id}:${seed}`);
  const { shape, noise: noiseParams, erosion } = preset;
  const noise = makeNoise3D(rng.int(1, 1_000_000));
  const isLowpoly = opts.style === 'lowpoly';

  const geo = mergeVertices(new IcosahedronGeometry(shape.radius, shape.detail));
  const pos = geo.attributes.position;
  const origin = new Vector3(
    rng.vary(shape.offset?.[0] ?? 0, 0.08),
    rng.vary(shape.offset?.[1] ?? 0, 0.05),
    rng.vary(shape.offset?.[2] ?? 0, 0.08),
  );

  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(origin);

    const dir = _v.clone().normalize();
    const len = _v.length();

    const nx = dir.x * noiseParams.scale + noiseParams.offset[0];
    const ny = dir.y * noiseParams.scale + noiseParams.offset[1];
    const nz = dir.z * noiseParams.scale + noiseParams.offset[2];

    let displacement = 0;
    if (noiseParams.ridged) {
      displacement = noise.ridged(nx, ny, nz, noiseParams.octaves, noiseParams.lacunarity, noiseParams.gain);
      displacement = displacement * 2 - 1;
    } else {
      displacement = noise.fbm(nx, ny, nz, noiseParams.octaves, noiseParams.lacunarity, noiseParams.gain);
    }

    displacement *= noiseParams.amplitude;
    displacement += noise.noise(nx * 2.7, ny * 2.7, nz * 2.7) * (noiseParams.microAmplitude ?? 0.04);

    const stretch = shape.stretch ?? [1, 1, 1];
    const r = len + displacement;
    _v.copy(dir).multiplyScalar(r);
    _v.x *= stretch[0];
    _v.y *= stretch[1];
    _v.z *= stretch[2];

    if (shape.squash) {
      _v.y *= shape.squash;
    }

    _v.add(origin);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }

  geo.computeVertexNormals();
  applyErosion(geo, erosion, rng);

  if (isLowpoly) {
    // flatShading derives face normals per triangle in the material; a vertex
    // normal attribute would override that, so drop it and let the renderer
    // compute flat per-face normals from positions.
    geo.deleteAttribute('normal');
  }

  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/**
 * @param {RockPreset} preset
 * @param {string|number} seed
 * @returns {{ geometry: import('three').BufferGeometry, seed: string|number, preset: RockPreset }}
 */
export function buildRock(preset, seed, opts = {}) {
  return {
    geometry: generateRockGeometry(preset, seed, opts),
    seed,
    preset,
  };
}
