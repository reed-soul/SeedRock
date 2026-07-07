// Boulder StructureGraph — displacement-node graph.
//
// This is the dominant form (10 of 15 species). Unlike the structural forms,
// boulder gets its silhouette from radial noise displacement. The graph captures
// the DISPLACED vertex positions as nodes — the noise sampling happens in the
// builder, the mesher just writes the precomputed positions back. This means:
//   • the same graph can be meshed at a different icosahedron `detail` WITHOUT
//     re-sampling noise (LOD benefit), as long as the mesher re-derives each
//     vertex's radial direction from origin and looks up the field — for now,
//     since baseline parity requires exact reproduction, we precompute the full
//     final position per node and the mesher applies them 1:1.
//   • rng draw order is preserved: buildBoulderGraph does exactly what the legacy
//     buildBoulder + displaceRadial pair did, in the same order.
//
// Migrated byte-for-byte from forms/boulder.js.

import { IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new Vector3();

/**
 * Build the boulder graph: an icosahedron base + a displacement node per vertex.
 *
 * Each node records the vertex's FINAL displaced position (post-noise, post-
 * stretch/squash), so the mesher can reproduce the legacy output exactly by
 * writing positions back in vertex order.
 *
 * @param {object} shape
 * @param {object} p  noise params
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {import('../../core/rng.js').Rng} rng
 */
export function buildBoulderGraph(shape, p, noise, rng) {
  const base = mergeVertices(new IcosahedronGeometry(shape.radius, shape.detail));
  const origin = new Vector3(
    rng.vary(shape.offset?.[0] ?? 0, 0.08),
    rng.vary(shape.offset?.[1] ?? 0, 0.05),
    rng.vary(shape.offset?.[2] ?? 0, 0.08),
  );
  const stretch = shape.stretch ?? [1, 1, 1];
  const squash = shape.squash;

  // Compute the displaced position for every vertex, mirroring displaceRadial()
  // exactly. Store as flat Float32Array for the mesher to write back.
  const pos = base.attributes.position;
  const nodes = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    _v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(origin);
    const dir = _v.clone().normalize();
    const len = _v.length();

    const nx = dir.x * p.scale + p.offset[0];
    const ny = dir.y * p.scale + p.offset[1];
    const nz = dir.z * p.scale + p.offset[2];

    let displacement = p.ridged
      ? noise.ridged(nx, ny, nz, p.octaves, p.lacunarity, p.gain) * 2 - 1
      : noise.fbm(nx, ny, nz, p.octaves, p.lacunarity, p.gain);
    displacement *= p.amplitude;
    displacement += noise.noise(nx * 2.7, ny * 2.7, nz * 2.7) * (p.microAmplitude ?? 0.04);

    const r = len + displacement;
    _v.copy(dir).multiplyScalar(r);
    _v.x *= stretch[0];
    _v.y *= stretch[1];
    _v.z *= stretch[2];
    if (squash) _v.y *= squash;

    _v.add(origin);
    nodes[i * 3] = _v.x;
    nodes[i * 3 + 1] = _v.y;
    nodes[i * 3 + 2] = _v.z;
  }

  // Keep the base geometry's non-position attributes (normal, uv) intact so the
  // mesher can return a geometry indistinguishable from the legacy output. The
  // base is disposed by the mesher after copying.
  return {
    nodes,
    baseGeo: base,
    baseRadius: shape.radius,
    detail: shape.detail,
  };
}

/**
 * Mesh a boulder graph: clone the base icosahedron geometry (which carries
 * correct normals/uvs/index) and overwrite the position attribute with the
 * precomputed displaced node positions. Output is byte-identical to the legacy
 * buildBoulder + displaceRadial pair.
 *
 * @param {object} graph  from buildBoulderGraph
 * @returns {import('three').BufferGeometry}
 */
export function meshBoulder(graph) {
  // Clone the base so we inherit its index/normal/uv attributes verbatim; only
  // position is overwritten with the displaced node values.
  const geo = graph.baseGeo.clone();
  geo.attributes.position.array.set(graph.nodes);
  geo.attributes.position.needsUpdate = true;
  // The legacy path did NOT recompute normals after displacement (mesh.js calls
  // computeVertexNormals after the form returns); keep that contract by leaving
  // normals as the base icosahedron's here.
  return geo;
}
