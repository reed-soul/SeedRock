// Crystal form — radiating cluster of prism shards: a central shard with
// 5–9 satellite cones pointing outward at varied angles. This is the
// silhouette of quartz/amethyst/geode crystal clusters. The form pairs
// naturally with the toon style for a stylized look, or PBR with high
// metalness for a realistic gem cluster.

import { ConeGeometry, Vector3, Matrix4, Quaternion, Euler } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _dir = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();
const _eul = new Euler();
const _mat = new Matrix4();
const _up = new Vector3(0, 1, 0);

/**
 * @param {object} shape
 * @param {object} noiseParams
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {import('../../core/rng.js').Rng} rng
 */
export function buildCrystal(shape, rng) {
  const radius = shape.radius ?? 1;
  // 6-sided cones read as hexagonal prisms (quartz habit). 4-sided gives a
  // sharper "shard" — pick per-cluster for variety.
  const sides = rng.next() < 0.5 ? 6 : 4;
  const count = rng.int(5, 9);

  const geos = [];
  // Central tallest shard straight up.
  const centerH = radius * rng.range(1.6, 2.1);
  const centerR = radius * rng.range(0.22, 0.3);
  const centerGeo = new ConeGeometry(centerR, centerH, sides, 1);
  centerGeo.translate(0, centerH / 2, 0);
  geos.push(centerGeo);

  // Satellites: shorter, leaning outward in a roughly uniform fan + jitter.
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.vary(0, 0.4);
    const h = radius * rng.range(0.8, 1.5);
    const r = radius * rng.range(0.16, 0.24);
    const cone = new ConeGeometry(r, h, sides, 1);
    cone.translate(0, h / 2, 0);

    // Tilt outward (away from centre) and place at the cluster's mid-radius.
    const tilt = rng.range(0.4, 1.0); // radians from vertical
    _dir.set(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)).normalize();
    // Quaternion rotating +Y to _dir.
    _quat.setFromUnitVectors(_up, _dir);
    const placeR = radius * rng.range(0.15, 0.35);
    _pos.set(Math.cos(a) * placeR, 0, Math.sin(a) * placeR);
    _mat.compose(_pos, _quat, new Vector3(1, 1, 1));
    cone.applyMatrix4(_mat);
    geos.push(cone);
  }

  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return { geo, origin: new Vector3(0, 0, 0) };
}
