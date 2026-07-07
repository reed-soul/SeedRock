// STUB — temporary passthrough to the legacy columnar factory. Replaced with a
// real joint-set graph in Step 4 of the StructureGraph refactor.

import { buildColumnar as legacyBuildColumnar } from '../forms/columnar.js';

export function buildColumnarGraph(shape, noise, rng) {
  // noise is part of the columnar signature (carried for parity with the legacy
  // factory even though the current columnar implementation ignores it).
  const { geo } = legacyBuildColumnar(shape, noise, rng);
  return { _legacyGeo: geo };
}

export function meshColumnar(graph, _opts) {
  return graph._legacyGeo;
}
