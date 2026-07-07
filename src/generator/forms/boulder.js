// Compatibility shim — delegates to the StructureGraph implementation in
// structure/boulder.js. Kept so tests/forms.test.js (and any external callers)
// keep working with the original buildBoulder/displaceRadial API. mesh.js now
// routes through structure/graph.js directly and does NOT import this file.

import { IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildBoulderGraph, meshBoulder } from '../structure/boulder.js';

const _v = new Vector3();

/**
 * Build the boulder base icosahedron + capture displacement nodes.
 * Returns { geo, origin } where geo's positions are NOT yet displaced —
 * call displaceRadial() (below) to apply them, exactly as mesh.js used to.
 */
export function buildBoulder(shape, noiseParams, noise, rng) {
  // The graph builder computes origin AND the displaced positions together.
  // To preserve the old two-step contract (buildBoulder then displaceRadial),
  // build the graph but return the BASE icosahedron geometry here; the displaced
  // nodes are stashed on the geometry so displaceRadial can apply them without
  // re-sampling noise.
  const graph = buildBoulderGraph(shape, noiseParams, noise, rng);
  // Reconstruct origin from the graph: the legacy origin was used inside the
  // builder. We don't expose it from the graph, but displaceRadial only needs
  // the displaced positions, which are already in graph.nodes. Stash them.
  const base = graph.baseGeo;
  base.userData = base.userData || {};
  base.userData.__displacedNodes = graph.nodes;
  // origin is no longer needed downstream (displaceRadial writes the precomputed
  // positions), but the API contract returns one — pass a zero vector.
  return { geo: base, origin: new Vector3(0, 0, 0) };
}

/**
 * Apply the precomputed displacement nodes to the geometry's positions.
 * In the legacy implementation this re-sampled noise; now it writes the values
 * the graph builder already computed (identical result, no duplicate work).
 */
export function displaceRadial(geo, _origin, _p, _noise, _stretch, _squash) {
  const nodes = geo.userData?.__displacedNodes;
  if (!nodes) return; // no graph built — nothing to apply
  geo.attributes.position.array.set(nodes);
  geo.attributes.position.needsUpdate = true;
}
