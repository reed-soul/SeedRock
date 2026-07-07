// Compatibility shim — delegates to the StructureGraph implementation in
// structure/crystal.js. Kept so tests/forms.test.js keeps working with the
// original buildCrystal API. mesh.js routes through structure/graph.js directly.

import { Vector3 } from 'three/webgpu';
import { buildCrystalGraph, meshCrystal } from '../structure/crystal.js';

export function buildCrystal(shape, rng) {
  const graph = buildCrystalGraph(shape, rng);
  return { geo: meshCrystal(graph), origin: new Vector3(0, 0, 0) };
}
