// Slate form — foliated plate: a stack of thin slabs expressing the
// metamorphic foliation that gives slate/shale its layered, splittable
// character. Each slab is a flat box offset slightly in Y and XY, so the
// silhouette reads as "strata" rather than a single block.

import { BoxGeometry, Vector3, Matrix4 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _pos = new Vector3();
const _mat = new Matrix4();

/**
 * @param {object} shape
 * @param {object} noiseParams
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {import('../../core/rng.js').Rng} rng
 */
export function buildSlate(shape, rng) {
  const radius = shape.radius ?? 1;
  // Slate is flat and wide: thickness ≈ 30% of footprint.
  const width = radius * rng.range(1.8, 2.4);
  const depth = radius * rng.range(1.6, 2.2);
  const slabThick = radius * rng.range(0.12, 0.18);
  const layers = rng.int(3, 5);

  const geos = [];
  for (let i = 0; i < layers; i++) {
    // Each layer slightly smaller and offset — reads as weathered sheet edges.
    const shrink = 1 - i * 0.08;
    const w = width * shrink * rng.range(0.92, 1.04);
    const d = depth * shrink * rng.range(0.92, 1.04);
    const segW = Math.max(2, Math.round(6 * shrink));
    const segD = Math.max(2, Math.round(6 * shrink));
    const slab = new BoxGeometry(w, slabThick, d, segW, 1, segD);
    const ox = rng.vary(0, radius * 0.08);
    const oz = rng.vary(0, radius * 0.08);
    const oy = i * slabThick * 0.95;
    _pos.set(ox, oy, oz);
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
  return { geo, origin: new Vector3(0, 0, 0) };
}
