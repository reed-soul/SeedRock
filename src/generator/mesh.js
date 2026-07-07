import { makeNoise3D } from '../core/noise.js';
import { Rng } from '../core/rng.js';
import { applyErosion } from './erosion.js';
import { buildStructureGraph, meshStructureGraph } from './structure/graph.js';

/**
 * @typedef {import('../species/granite.js').RockPreset} RockPreset
 */

/**
 * Generate a procedural rock mesh from a species preset and seed.
 *
 * Internally routes through the StructureGraph layer (buildStructureGraph →
 * meshStructureGraph). The graph captures the rock's topology as pure data;
 * the mesher turns it into geometry. Each form's graph builder uses the same
 * rng draw order and noise seeding the legacy form factories did, so
 * (species, seed) output is byte-identical to the pre-refactor implementation.
 *
 * @param {RockPreset} preset
 * @param {string|number} seed
 * @param {{ style?: 'pbr'|'lowpoly'|'toon' }} [opts]
 * @returns {import('three').BufferGeometry}
 */
export function generateRockGeometry(preset, seed, opts = {}) {
  const rng = new Rng(`${preset.id}:${seed}`);
  const { erosion } = preset;
  const noise = makeNoise3D(rng.int(1, 1_000_000));
  const isLowpoly = opts.style === 'lowpoly';

  // Build the structure graph (pure topology) then mesh it. `noise` is consumed
  // only by the boulder path; structural forms ignore it. The graph builder
  // draws from `rng` in the same order as the legacy factories.
  const graph = buildStructureGraph(preset, rng, noise);
  const geo = meshStructureGraph(graph, { detail: preset.shape.detail, style: opts.style });

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
