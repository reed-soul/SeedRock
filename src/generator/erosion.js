import { Vector3 } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new Vector3();
const _n = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

/**
 * Build vertex adjacency from indexed geometry.
 * @param {import('three').BufferGeometry} geo
 * @returns {{ neighbors: number[][], positions: Float32Array, count: number }}
 */
function buildAdjacency(geo) {
  const pos = geo.attributes.position;
  const count = pos.count;
  const neighbors = Array.from({ length: count }, () => []);

  const index = geo.index;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      neighbors[a].push(b, c);
      neighbors[b].push(a, c);
      neighbors[c].push(a, b);
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      neighbors[i].push(i + 1, i + 2);
      neighbors[i + 1].push(i, i + 2);
      neighbors[i + 2].push(i, i + 1);
    }
  }

  for (let i = 0; i < count; i++) {
    neighbors[i] = [...new Set(neighbors[i])];
  }

  return { neighbors, positions: pos.array, count };
}

/**
 * Thermal erosion: steep vertices shed material downhill along the true 3D
 * steepest-descent direction, not just the world-Y axis.
 *
 * Each vertex i with a higher Y (gravitational height) than neighbor j by more
 * than `talus` transfers material SYMMETRICALLY along the i→j direction:
 *   delta_i += dir * transfer     (i slides toward j — downhill)
 *   delta_j -= dir * transfer     (j is pushed back toward i — mass conserved)
 * where dir = (j - i).normalize() and transfer = (yDiff - talus) * rate * 0.5.
 *
 * On a height-field mesh (vertices differ only in Y) this degenerates to the
 * classic Y-only transport: i.y decreases, j.y increases. On a fully 3D rock
 * with overhangs or horizontal slopes, material now flows along the surface
 * gradient — fixing the Y-axis-only limitation noted in
 * docs/generation-design.md §3.1.
 *
 * @param {Float32Array} positions
 * @param {number[][]} neighbors
 * @param {number} count
 * @param {{ iterations?: number, talus?: number, rate?: number }} params
 */
export function thermalErode(positions, neighbors, count, params = {}) {
  const iterations = params.iterations ?? 12;
  const talus = params.talus ?? 0.04;
  const rate = params.rate ?? 0.35;
  const deltas = new Float32Array(count * 3);

  for (let iter = 0; iter < iterations; iter++) {
    deltas.fill(0);

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      _a.set(positions[ix], positions[ix + 1], positions[ix + 2]);
      const nbrs = neighbors[i];
      if (!nbrs.length) continue;

      for (const j of nbrs) {
        const jx = j * 3;
        _b.set(positions[jx], positions[jx + 1], positions[jx + 2]);
        const yDiff = _a.y - _b.y;
        if (yDiff <= talus) continue;
        // 3D direction from i (high) toward j (low); material flows downhill.
        _n.copy(_b).sub(_a); // j - i
        const segLen = _n.length();
        if (segLen < 1e-9) continue;
        _n.multiplyScalar(1 / segLen);
        const transfer = (yDiff - talus) * rate * 0.5;
        // i slides toward j; j is displaced opposite (mass/centroid conserved).
        deltas[ix]     += _n.x * transfer;
        deltas[ix + 1] += _n.y * transfer;
        deltas[ix + 2] += _n.z * transfer;
        deltas[jx]     -= _n.x * transfer;
        deltas[jx + 1] -= _n.y * transfer;
        deltas[jx + 2] -= _n.z * transfer;
      }
    }

    for (let i = 0; i < count * 3; i++) positions[i] += deltas[i];
  }
}

/**
 * Hydraulic erosion: droplets carve channels on the mesh surface.
 * @param {Float32Array} positions
 * @param {number[][]} neighbors
 * @param {number} count
 * @param {import('../core/rng.js').Rng} rng
 * @param {{ droplets?: number, steps?: number, erosion?: number, deposit?: number, inertia?: number }} params
 */
export function hydraulicErode(positions, neighbors, count, rng, params = {}) {
  const droplets = params.droplets ?? 80;
  const steps = params.steps ?? 24;
  const erosion = params.erosion ?? 0.22;
  const deposit = params.deposit ?? 0.12;
  const inertia = params.inertia ?? 0.35;

  const sediment = new Float32Array(count);

  for (let d = 0; d < droplets; d++) {
    let idx = rng.int(0, count - 1);
    let water = 1;
    let s = 0;
    let vx = 0, vy = 0, vz = 0;

    for (let step = 0; step < steps; step++) {
      const ix = idx * 3;
      _v.set(positions[ix], positions[ix + 1], positions[ix + 2]);

      const nbrs = neighbors[idx];
      if (!nbrs.length) break;

      let lowest = idx;
      let lowestY = _v.y;
      for (const j of nbrs) {
        const jx = j * 3;
        if (positions[jx + 1] < lowestY) {
          lowestY = positions[jx + 1];
          lowest = j;
        }
      }

      if (lowest === idx) {
        const carry = s * deposit;
        sediment[idx] += carry;
        s -= carry;
        break;
      }

      const jx = lowest * 3;
      const heightDiff = _v.y - positions[jx + 1];
      const cap = Math.max(heightDiff, 0.001) * water;
      const erodeAmt = Math.min((cap - s) * erosion, heightDiff * 0.5);

      if (erodeAmt > 0) {
        positions[ix + 1] -= erodeAmt;
        s += erodeAmt;
      } else {
        const dep = (s - cap) * deposit;
        if (dep > 0) {
          positions[ix + 1] += dep;
          s -= dep;
        }
      }

      const dx = positions[jx] - positions[ix];
      const dy = positions[jx + 1] - positions[ix + 1];
      const dz = positions[jx + 2] - positions[ix + 2];
      const invLen = 1 / Math.hypot(dx, dy, dz);
      vx = vx * inertia + dx * invLen * (1 - inertia);
      vy = vy * inertia + dy * invLen * (1 - inertia);
      vz = vz * inertia + dz * invLen * (1 - inertia);

      idx = lowest;
      water *= 0.96;
      if (water < 0.05) break;
    }
  }

  for (let i = 0; i < count; i++) {
    if (sediment[i] > 0) positions[i * 3 + 1] += sediment[i] * 0.15;
  }
}

/**
 * Edge wear: push high-curvature vertices slightly inward.
 */
export function edgeWear(positions, neighbors, count, strength = 0.08) {
  const deltas = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    _v.set(positions[ix], positions[ix + 1], positions[ix + 2]);
    _n.copy(_v).normalize();

    const nbrs = neighbors[i];
    if (nbrs.length < 2) continue;

    let curvature = 0;
    for (const j of nbrs) {
      const jx = j * 3;
      _a.set(positions[jx], positions[jx + 1], positions[jx + 2]).normalize();
      curvature += 1 - _n.dot(_a);
    }
    curvature /= nbrs.length;

    const wear = curvature * strength;
    deltas[ix] -= _n.x * wear;
    deltas[ix + 1] -= _n.y * wear;
    deltas[ix + 2] -= _n.z * wear;
  }

  for (let i = 0; i < count * 3; i++) positions[i] += deltas[i];
}

/**
 * Run the full erosion pipeline on a BufferGeometry (mutates in place).
 * @param {import('three').BufferGeometry} geo
 * @param {object} erosionParams
 * @param {import('../core/rng.js').Rng} rng
 */
export function applyErosion(geo, erosionParams, rng) {
  const welded = mergeVertices(geo);
  if (welded !== geo) geo.copy(welded);

  const { neighbors, positions, count } = buildAdjacency(geo);
  const pos = geo.attributes.position.array;

  if (erosionParams.thermal?.enabled !== false) {
    thermalErode(pos, neighbors, count, erosionParams.thermal);
  }
  if (erosionParams.hydraulic?.enabled !== false) {
    hydraulicErode(pos, neighbors, count, rng, erosionParams.hydraulic);
  }
  if (erosionParams.edgeWear?.enabled !== false) {
    edgeWear(pos, neighbors, count, erosionParams.edgeWear?.strength ?? 0.06);
  }

  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
