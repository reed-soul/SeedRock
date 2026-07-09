// Compatibility shim — delegates to the StructureGraph implementation in
// structure/boulder.js. Kept so tests/forms.test.js (and any external callers)
// keep working with the original buildBoulder/displaceRadial API. mesh.js now
// routes through structure/graph.js directly and does NOT import this file.

import { IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildBoulderGraph, displaceVertex } from '../structure/boulder.js';

const _v = new Vector3();
const _fieldOrigin = new Vector3();

/**
 * Build the boulder base icosahedron + capture the displacement field.
 * Returns { geo, origin } where geo's positions are NOT yet displaced —
 * call displaceRadial() (below) to apply them, exactly as mesh.js used to.
 */
export function buildBoulder(shape, noiseParams, noise, rng) {
  const graph = buildBoulderGraph(shape, noiseParams, noise, rng);
  const base = mergeVertices(new IcosahedronGeometry(shape.radius, shape.detail));
  base.userData = base.userData || {};
  base.userData.__boulderGraph = graph;
  return {
    geo: base,
    origin: new Vector3(graph.origin[0], graph.origin[1], graph.origin[2]),
  };
}

/**
 * Apply the displacement field to the geometry's positions.
 * Mirrors the legacy displaceRadial noise sampling via the shared field formula.
 */
export function displaceRadial(geo, _origin, _p, _noise, _stretch, _squash) {
  const graph = geo.userData?.__boulderGraph;
  if (!graph) return;
  const pos = geo.attributes.position;
  const { field, noise, stretch, squash } = graph;
  _fieldOrigin.set(graph.origin[0], graph.origin[1], graph.origin[2]);
  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    displaceVertex(_v, field, noise, stretch, squash, _fieldOrigin);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  pos.needsUpdate = true;
}
