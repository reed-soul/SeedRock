// Slate StructureGraph — foliated plate as a layer-stack topology.
// Migrated byte-for-byte from forms/slate.js: buildSlateGraph captures the per-
// layer parameters (the rng draw sequence), meshSlate recreates the BoxGeometry
// stack from them. Same rng order, same merge order → identical vertex output.

import { BoxGeometry, Vector3, Matrix4 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Build the slate graph: a stack of foliated slabs. Pure data — no geometry.
 * rng draw order is identical to the legacy buildSlate() so output matches.
 *
 * @param {object} shape
 * @param {import('../../core/rng.js').Rng} rng
 * @returns {{ slabs: Array<{ w: number, d: number, thick: number, segW: number, segD: number, ox: number, oz: number, oy: number }>, baseRadius: number }}
 */
export function buildSlateGraph(shape, rng) {
  const radius = shape.radius ?? 1;
  // Slate is flat and wide: thickness ≈ 30% of footprint.
  const width = radius * rng.range(1.8, 2.4);
  const depth = radius * rng.range(1.6, 2.2);
  const slabThick = radius * rng.range(0.12, 0.18);
  const layers = rng.int(3, 5);

  const slabs = [];
  for (let i = 0; i < layers; i++) {
    // Each layer slightly smaller and offset — reads as weathered sheet edges.
    // The rng draw order here MUST match legacy buildSlate exactly: shrink is
    // deterministic (no rng), then w/d each draw once, then ox/oz each vary once.
    const shrink = 1 - i * 0.08;
    const w = width * shrink * rng.range(0.92, 1.04);
    const d = depth * shrink * rng.range(0.92, 1.04);
    const segW = Math.max(2, Math.round(6 * shrink));
    const segD = Math.max(2, Math.round(6 * shrink));
    const ox = rng.vary(0, radius * 0.08);
    const oz = rng.vary(0, radius * 0.08);
    const oy = i * slabThick * 0.95;
    slabs.push({ w, d, thick: slabThick, segW, segD, ox, oz, oy });
  }
  return { slabs, baseRadius: radius };
}

const _pos = new Vector3();
const _mat = new Matrix4();

/**
 * Mesh a slate graph into a BufferGeometry. Recreates the legacy stack exactly:
 * BoxGeometry per slab → translate → mergeGeometries → re-center on XZ.
 *
 * @param {object} graph  from buildSlateGraph
 * @returns {import('three').BufferGeometry}
 */
export function meshSlate(graph) {
  const geos = [];
  for (const s of graph.slabs) {
    const slab = new BoxGeometry(s.w, s.thick, s.d, s.segW, 1, s.segD);
    _pos.set(s.ox, s.oy, s.oz);
    _mat.makeTranslation(_pos.x, _pos.y, _pos.z);
    slab.applyMatrix4(_mat);
    geos.push(slab);
  }
  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  // Re-centre on XZ; keep base at y=0 for downstream seating.
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, 0, -cz);
  return geo;
}
