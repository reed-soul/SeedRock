import { Vector3 } from 'three/webgpu';
import { makeNoise3D } from '../core/noise.js';
import { Rng } from '../core/rng.js';
import { applyErosion } from './erosion.js';
import { buildBoulder, displaceRadial } from './forms/boulder.js';
import { buildColumnar } from './forms/columnar.js';
import { buildSlate } from './forms/slate.js';
import { buildCrystal } from './forms/crystal.js';

/**
 * @typedef {import('../species/granite.js').RockPreset} RockPreset
 */

// Structural forms (columnar/slate/crystal) get their character from the
// base geometry itself, so the primary radial displacer would only smear
// their silhouette. Boulder is the only form that uses radial displacement
// as its primary shape driver.
const STRUCTURAL_FORMS = new Set(['columnar', 'slate', 'crystal']);

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
  const form = shape.form ?? 'boulder';

  // Dispatch to the form factory — each returns { geo, origin }.
  let geo, origin;
  if (form === 'columnar') {
    ({ geo, origin } = buildColumnar(shape, noise, rng));
  } else if (form === 'slate') {
    ({ geo, origin } = buildSlate(shape, rng));
  } else if (form === 'crystal') {
    ({ geo, origin } = buildCrystal(shape, rng));
  } else {
    ({ geo, origin } = buildBoulder(shape, noiseParams, noise, rng));
    // Boulder only: radial displacement IS the primary shape.
    displaceRadial(
      geo, origin, noiseParams, noise,
      shape.stretch ?? [1, 1, 1], shape.squash,
    );
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
 * @param {{ style?: 'pbr'|'lowpoly'|'toon' }} [opts]
 * @returns {{ geometry: import('three').BufferGeometry, seed: string|number, preset: RockPreset }}
 */
export function buildRock(preset, seed, opts = {}) {
  return {
    geometry: generateRockGeometry(preset, seed, opts),
    seed,
    preset,
  };
}
