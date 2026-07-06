// Boulder form — the original SeedRock rock: an icosahedron with radial
// noise displacement. This is the default when a preset specifies no form.
//
// The displacer perturbs each vertex ALONG its radial direction (out from
// the shape origin), so the silhouette stays convex-ish. Boulder is the
// only form that uses this radial scheme — columnar/slate/crystal override
// displacement because their base geometry isn't a sphere.

import { IcosahedronGeometry, Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new Vector3();

/**
 * @param {object} shape
 * @param {object} noiseParams
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {import('../../core/rng.js').Rng} rng
 */
export function buildBoulder(shape, noiseParams, noise, rng) {
  const geo = mergeVertices(new IcosahedronGeometry(shape.radius, shape.detail));
  const origin = new Vector3(
    rng.vary(shape.offset?.[0] ?? 0, 0.08),
    rng.vary(shape.offset?.[1] ?? 0, 0.05),
    rng.vary(shape.offset?.[2] ?? 0, 0.08),
  );
  return { geo, origin };
}

/**
 * Radial displacement — perturbs along the vertex normal from the origin.
 * Shared by boulder; other forms may call it for secondary surface detail
 * but supply their own primary shape.
 *
 * @param {import('three').BufferGeometry} geo
 * @param {import('three').Vector3} origin
 * @param {object} p       noise params (scale, offset, octaves, lacunarity, gain, amplitude, ridged, microAmplitude)
 * @param {import('../../core/noise.js').Noise3D} noise
 * @param {object} stretch  [x,y,z] stretch factors
 * @param {number} squash   y squash (optional)
 */
export function displaceRadial(geo, origin, p, noise, stretch = [1, 1, 1], squash) {
  const pos = geo.attributes.position;
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
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
}
