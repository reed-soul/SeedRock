// Columnar form — basalt columnar jointing: a cluster of hexagonal prisms
// packed vertically, with irregular fractured tops. This is the real
// geometry behind "basalt columns" (Giant's Causeway, Devils Tower) — the
// preset's previous "columnar" claim was documentation-only.
//
// Each column is a low-segment CylinderGeometry (6 radial = hexagonal),
// jittered in height/tilt/radius, merged into one geometry. Surface detail
// rides on top via the shared radial displacer tuned low (columns already
// have their character; we only add grain).

import { CylinderGeometry, Vector3, Matrix4, Quaternion, Euler } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _pos = new Vector3();
const _quat = new Quaternion();
const _eul = new Euler();
const _mat = new Matrix4();

/**
 * @param {object} shape
 * @param {object} noiseParams  (unused for primary form — columnar is structural)
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {import('../../core/rng.js').Rng} rng
 */
export function buildColumnar(shape, noise, rng) {
  const radius = shape.radius ?? 1;
  // Column count scales with the rock's overall radius; tighter packing for
  // bigger clusters. 5–9 is the range that reads as a real outcrop.
  const count = Math.max(4, Math.round(4 + radius * 3) + rng.int(0, 2));
  const colRadius = radius * rng.range(0.18, 0.26);
  const heightBase = radius * rng.range(1.4, 2.2);

  const geos = [];
  // Hexagonal close-pack centres: ring + centre, then jittered.
  const centres = [[0, 0]];
  const ringN = 6;
  for (let i = 0; i < ringN; i++) {
    const a = (i / ringN) * Math.PI * 2;
    centres.push([Math.cos(a) * colRadius * 1.7, Math.sin(a) * colRadius * 1.7]);
  }
  // Outer ring for bigger clusters
  if (count > 7) {
    const ringN2 = 6;
    for (let i = 0; i < ringN2; i++) {
      const a = (i / ringN2) * Math.PI * 2 + Math.PI / 6;
      centres.push([Math.cos(a) * colRadius * 3.3, Math.sin(a) * colRadius * 3.3]);
    }
  }

  for (let c = 0; c < Math.min(count, centres.length); c++) {
    const [cx, cz] = centres[c];
    const jitter = rng.range(0, colRadius * 0.3);
    const ja = rng.range(0, Math.PI * 2);
    const x = cx + Math.cos(ja) * jitter;
    const z = cz + Math.sin(ja) * jitter;

    // Each column: own height (fractured tops), slight tilt, own radius.
    const h = heightBase * rng.range(0.65, 1.15);
    const r = colRadius * rng.range(0.85, 1.1);
    const colGeo = new CylinderGeometry(r * 0.85, r, h, 6, 1);
    // Origin at base; recenter so the cylinder sits with base at y=0.
    colGeo.translate(0, h / 2, 0);

    // Slight tilt — real colonnades lean.
    _eul.set(rng.vary(0, 0.12), rng.range(0, Math.PI * 2), rng.vary(0, 0.12));
    _quat.setFromEuler(_eul);
    _pos.set(x, 0, z);
    _mat.compose(_pos, _quat, new Vector3(1, 1, 1));
    colGeo.applyMatrix4(_mat);
    geos.push(colGeo);
  }

  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  // Origin near base centre — downstream seating uses bounding box min.y.
  return { geo, origin: new Vector3(0, 0, 0) };
}
