// Compatibility shim — delegates to the StructureGraph implementation in
// structure/slate.js. Kept so tests/forms.test.js keeps working with the
// original buildSlate API. mesh.js routes through structure/graph.js directly.

import { Vector3 } from 'three/webgpu';
import { buildSlateGraph, meshSlate } from '../structure/slate.js';

export function buildSlate(shape, rng) {
  const graph = buildSlateGraph(shape, rng);
  return { geo: meshSlate(graph), origin: new Vector3(0, 0, 0) };
}
