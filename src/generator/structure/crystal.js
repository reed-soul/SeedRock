// Crystal StructureGraph — radiating prism cluster as a nucleation pattern.
// Migrated byte-for-byte from forms/crystal.js: buildCrystalGraph captures the
// shard parameters (the rng draw sequence), meshCrystal recreates the ConeGeometry
// cluster from them. Same rng order, same merge order → identical vertex output.

import { ConeGeometry, Vector3, Matrix4, Quaternion } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _up = new Vector3(0, 1, 0);

/**
 * Build the crystal graph: a central tall shard + radiating satellite shards.
 * Pure data — no geometry. rng draw order matches legacy buildCrystal() exactly.
 *
 * @param {object} shape
 * @param {import('../../core/rng.js').Rng} rng
 * @returns {{ shards: Array<{ h: number, r: number, sides: number, dir: [number,number,number], pos: [number,number,number] }>, baseRadius: number }}
 */
export function buildCrystalGraph(shape, rng) {
  const radius = shape.radius ?? 1;
  // 6-sided cones read as hexagonal prisms (quartz habit). 4-sided gives a
  // sharper "shard" — pick per-cluster for variety.
  const sides = rng.next() < 0.5 ? 6 : 4;
  const count = rng.int(5, 9);

  const shards = [];

  // Central tallest shard straight up.
  const centerH = radius * rng.range(1.6, 2.1);
  const centerR = radius * rng.range(0.22, 0.3);
  shards.push({
    h: centerH, r: centerR, sides,
    dir: [_up.x, _up.y, _up.z],
    pos: [0, 0, 0],
    isCenter: true,
  });

  // Satellites: shorter, leaning outward in a roughly uniform fan + jitter.
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.vary(0, 0.4);
    const h = radius * rng.range(0.8, 1.5);
    const r = radius * rng.range(0.16, 0.24);
    const tilt = rng.range(0.4, 1.0); // radians from vertical
    const dir = [
      Math.sin(tilt) * Math.cos(a),
      Math.cos(tilt),
      Math.sin(tilt) * Math.sin(a),
    ];
    const placeR = radius * rng.range(0.15, 0.35);
    const pos = [Math.cos(a) * placeR, 0, Math.sin(a) * placeR];
    shards.push({ h, r, sides, dir, pos, isCenter: false });
  }
  return { shards, baseRadius: radius };
}

const _dir = new Vector3();
const _pos = new Vector3();
const _quat = new Quaternion();
const _mat = new Matrix4();

/**
 * Mesh a crystal graph into a BufferGeometry. Recreates the legacy cluster
 * exactly: ConeGeometry per shard → translate → (rotate for satellites) →
 * compose → mergeGeometries.
 *
 * @param {object} graph  from buildCrystalGraph
 * @returns {import('three').BufferGeometry}
 */
export function meshCrystal(graph) {
  const geos = [];
  for (const s of graph.shards) {
    const cone = new ConeGeometry(s.r, s.h, s.sides, 1);
    cone.translate(0, s.h / 2, 0);

    if (s.isCenter) {
      // Central shard stands straight up at origin — no rotation.
      geos.push(cone);
    } else {
      // Satellites: tilt outward (away from centre) via quaternion +Y → dir,
      // then place at the cluster's mid-radius.
      _dir.set(s.dir[0], s.dir[1], s.dir[2]).normalize();
      _quat.setFromUnitVectors(_up, _dir);
      _pos.set(s.pos[0], s.pos[1], s.pos[2]);
      _mat.compose(_pos, _quat, new Vector3(1, 1, 1));
      cone.applyMatrix4(_mat);
      geos.push(cone);
    }
  }

  const geo = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return geo;
}
