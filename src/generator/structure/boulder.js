// STUB — temporary passthrough to the legacy boulder factory. Replaced with a
// real displacement-node graph in Step 5 of the StructureGraph refactor. Exists
// so graph.js can import all four dispatchers from day one.

import { buildBoulder as legacyBuildBoulder, displaceRadial } from '../forms/boulder.js';

export function buildBoulderGraph(shape, noiseParams, noise, rng) {
  // Wraps the legacy output as a graph for now. Real node graph comes later.
  const { geo, origin } = legacyBuildBoulder(shape, noiseParams, noise, rng);
  displaceRadial(
    geo, origin, noiseParams, noise,
    shape.stretch ?? [1, 1, 1], shape.squash,
  );
  return { _legacyGeo: geo, _legacyOrigin: origin };
}

export function meshBoulder(graph, _opts) {
  // Returns the legacy pre-built geometry; the real mesher will rebuild from
  // nodes when Step 5 lands.
  return graph._legacyGeo;
}
