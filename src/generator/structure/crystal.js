// STUB — temporary passthrough to the legacy crystal factory. Replaced with a
// real nucleation-pattern graph in Step 3 of the StructureGraph refactor.

import { buildCrystal as legacyBuildCrystal } from '../forms/crystal.js';

export function buildCrystalGraph(shape, rng) {
  const { geo } = legacyBuildCrystal(shape, rng);
  return { _legacyGeo: geo };
}

export function meshCrystal(graph, _opts) {
  return graph._legacyGeo;
}
