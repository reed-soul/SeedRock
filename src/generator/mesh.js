import { makeNoise3D } from '../core/noise.js';
import { Rng } from '../core/rng.js';
import { applyErosion } from './erosion.js';
import { buildStructureGraph, meshStructureGraph, graphDetail } from './structure/graph.js';

/**
 * @typedef {import('../species/granite.js').RockPreset} RockPreset
 */

/**
 * Build the StructureGraph + a post-graph RNG fork for a (preset, seed).
 * Callers that need multiple meshes (LOD) build once, then mesh/erode per level.
 *
 * @param {RockPreset} preset
 * @param {string|number} seed
 * @returns {{ graph: object, erosionRng: import('../core/rng.js').Rng, preset: RockPreset, seed: string|number }}
 */
export function buildRockStructure(preset, seed) {
  const rng = new Rng(`${preset.id}:${seed}`);
  const noise = makeNoise3D(rng.int(1, 1_000_000));
  const graph = buildStructureGraph(preset, rng, noise);
  // Fork AFTER the graph draws so each LOD level can run hydraulic erosion from
  // the same stream position without advancing a shared parent.
  return { graph, erosionRng: rng.clone(), preset, seed };
}

/**
 * Mesh + erode a StructureGraph at one detail level.
 *
 * @param {object} graph
 * @param {RockPreset} preset
 * @param {import('../core/rng.js').Rng} erosionRng  post-graph fork (cloned per call)
 * @param {{ detail?: number, style?: 'pbr'|'lowpoly'|'toon' }} [opts]
 * @returns {import('three').BufferGeometry}
 */
export function meshRockFromStructure(graph, preset, erosionRng, opts = {}) {
  const detail = opts.detail ?? graphDetail(graph);
  const isLowpoly = opts.style === 'lowpoly';
  const geo = meshStructureGraph(graph, { detail, style: opts.style });

  geo.computeVertexNormals();
  applyErosion(geo, preset.erosion, erosionRng.clone());

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
 * Generate a procedural rock mesh from a species preset and seed.
 *
 * Internally routes through the StructureGraph layer (buildStructureGraph →
 * meshStructureGraph). The graph captures the rock's topology as pure data;
 * the mesher turns it into geometry. Each form's graph builder uses the same
 * rng draw order and noise seeding the legacy form factories did, so
 * (species, seed) output is byte-identical to the pre-refactor implementation
 * at the preset's build-time detail.
 *
 * @param {RockPreset} preset
 * @param {string|number} seed
 * @param {{ style?: 'pbr'|'lowpoly'|'toon' }} [opts]
 * @returns {import('three').BufferGeometry}
 */
export function generateRockGeometry(preset, seed, opts = {}) {
  const { graph, erosionRng } = buildRockStructure(preset, seed);
  return meshRockFromStructure(graph, preset, erosionRng, {
    detail: preset.shape.detail,
    style: opts.style,
  });
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
