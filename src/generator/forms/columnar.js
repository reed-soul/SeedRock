// Compatibility shim — delegates to the StructureGraph implementation in
// structure/columnar.js. Kept so tests/forms.test.js keeps working with the
// original buildColumnar API. mesh.js routes through structure/graph.js directly.

import { Vector3 } from 'three/webgpu';
import { buildColumnarGraph, meshColumnar } from '../structure/columnar.js';

export function buildColumnar(shape, noise, rng) {
  const graph = buildColumnarGraph(shape, noise, rng);
  return { geo: meshColumnar(graph), origin: new Vector3(0, 0, 0) };
}
