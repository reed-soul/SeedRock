import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  thermalErode, hydraulicErode, edgeWear, pebbleAbrade, radialStats, applyErosion,
} from '../src/generator/erosion.js';
import { Rng } from '../src/core/rng.js';
import { SPECIES } from '../src/species/index.js';
import { generateRockGeometry } from '../src/generator/mesh.js';
import { applySpeciesControls, controlsFromSpecies } from '../src/species/controls.js';
import { IcosahedronGeometry } from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Synthetic mesh: a single peak vertex surrounded by lower neighbours.
// neighbours indexed by vertex id; positions flat Float32Array [x,y,z,...].
function peakGrid() {
  // 3×3 grid on the XY plane (z=0), centre vertex raised on Y.
  //   6 7 8
  //   3 4 5     (vertex 4 = peak, y=1; others y=0)
  //   0 1 2
  const positions = new Float32Array(9 * 3);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const i = (y * 3 + x) * 3;
      positions[i] = x;            // X
      positions[i + 1] = (x === 1 && y === 1) ? 1 : 0;  // Y
      positions[i + 2] = 0;        // Z (erosion operates on Y as "up")
    }
  }
  const neighbors = [
    [1, 3], [0, 2, 4], [1, 5],
    [0, 4, 6], [1, 3, 5, 7], [2, 4, 8],
    [3, 7], [4, 6, 8], [5, 7],
  ];
  return { positions, neighbors, count: 9 };
}

test('thermalErode: peak height decreases, neighbours gain', () => {
  const { positions, neighbors, count } = peakGrid();
  const peakYBefore = positions[4 * 3 + 1]; // vertex 4 Y
  let sumBefore = 0;
  for (let i = 0; i < count; i++) sumBefore += positions[i * 3 + 1];

  thermalErode(positions, neighbors, count, { iterations: 5, talus: 0.05, rate: 0.5 });

  const peakYAfter = positions[4 * 3 + 1];
  assert.ok(peakYAfter < peakYBefore, `peak should erode (got ${peakYAfter} < ${peakYBefore})`);
  // mass conservation: sum of Y across all vertices stays ~constant
  let sumAfter = 0;
  for (let i = 0; i < count; i++) sumAfter += positions[i * 3 + 1];
  assert.ok(Math.abs(sumAfter - sumBefore) < 1e-4, 'thermal erosion should conserve mass');
});

test('hydraulicErode: a droplet run lowers the peak', () => {
  const { positions, neighbors, count } = peakGrid();
  const peakYBefore = positions[4 * 3 + 1];
  // Force the droplet to start at the peak.
  const rng = { int: () => 4, next: () => 0.99, vary: () => 0, range: () => 0 };
  hydraulicErode(positions, neighbors, count, rng, { droplets: 20, steps: 30, erosion: 0.5, deposit: 0.1 });
  const peakYAfter = positions[4 * 3 + 1];
  assert.ok(peakYAfter < peakYBefore, `hydraulic should erode peak (got ${peakYAfter} < ${peakYBefore})`);
});

test('edgeWear: pushes high-curvature vertices inward more than low-curvature', () => {
  // Two peaks of different sharpness: vertex 0 sits next to two vertices on the
  // SAME radial (high curvature → wears more), vertex 3 next to collinear ones
  // (low curvature → wears less). edgeWear scales displacement by neighbour
  // curvature, so the sharper peak should be pushed in further.
  const positions = new Float32Array([
    1, 1, 0,    // 0: sharp peak
    0.9, 0, 0,  // 1: neighbour of 0 (different direction → curvature)
    0, 1, 0,    // 2: neighbour of 0 (different direction → curvature)
    1, 0.5, 0,  // 3: gentle bump
    0.99, 0.5, 0, // 4: neighbour of 3 (nearly collinear → low curvature)
    1.01, 0.5, 0, // 5: neighbour of 3 (nearly collinear → low curvature)
  ]);
  const neighbors = [[1, 2], [0], [0], [4, 5], [3], [3]];
  const peak0Before = positions[0];
  const peak3Before = positions[3 * 3];
  edgeWear(positions, neighbors, 6, 0.5);
  const peak0After = positions[0];
  const peak3After = positions[3 * 3];
  // Both move inward (magnitude shrinks)…
  assert.ok(peak0After < peak0Before, 'sharp peak should wear inward');
  // …and the sharper peak wears at least as much as the gentle one.
  const wear0 = peak0Before - peak0After;
  const wear3 = peak3Before - peak3After;
  assert.ok(wear0 >= wear3, `sharper peak should wear more (got ${wear0} vs ${wear3})`);
});

test('thermalErode (3D): transports material along a lateral slope, not just Y', () => {
  // Two vertices at the SAME height (y=1) but offset in X — a lateral slope like
  // the underside of an overhang. The legacy Y-only thermalErode would do
  // nothing here (yDiff = 0). The 3D version transports material along the
  // i→j direction, so vertex 0 should move toward vertex 1 in X.
  //
  //   vertex 0 at (0, 1, 0), vertex 1 at (1, 1, 0) — same Y, lateral offset.
  //   To create a Y gradient that drives flow, vertex 1 sits at y=0.7 (slightly
  //   lower). Flow should be along (1,1,0)-(0,1,0) = +X direction (downhill),
  //   so vertex 0's X increases — proving lateral (non-Y) transport.
  const positions = new Float32Array([
    0.0, 1.0, 0.0,  // 0: higher
    1.0, 0.7, 0.0,  // 1: lower, offset in +X
  ]);
  const neighbors = [[1], [0]];
  thermalErode(positions, neighbors, 2, { iterations: 1, talus: 0.1, rate: 1.0 });
  // Vertex 0 should have moved in +X (toward vertex 1) — lateral transport.
  assert.ok(positions[0] > 0.0, `vertex 0 X should increase laterally (got ${positions[0]})`);
});

test('thermalErode: mass conserved on a 3D slope (centroid stable)', () => {
  // Symmetric transport conserves the centroid (sum of positions) — true on a
  // 3D slope, not just a height-field.
  const positions = new Float32Array([
    0, 1.0, 0,  // 0
    1, 0.5, 0,  // 1 (lower, +X offset)
  ]);
  const neighbors = [[1], [0]];
  const cxBefore = positions[0] + positions[3];
  const cyBefore = positions[1] + positions[4];
  thermalErode(positions, neighbors, 2, { iterations: 3, talus: 0.1, rate: 0.8 });
  const cxAfter = positions[0] + positions[3];
  const cyAfter = positions[1] + positions[4];
  assert.ok(Math.abs(cxAfter - cxBefore) < 1e-4, 'X centroid conserved');
  assert.ok(Math.abs(cyAfter - cyBefore) < 1e-4, 'Y centroid conserved');
});

/**
 * Build a stretched icosahedron (anisotropic pebble) with adjacency, so
 * Domokos Phase II has a clear sphere attractor to pull toward.
 */
function stretchedPebble(detail = 2) {
  const geo = mergeVertices(new IcosahedronGeometry(1, detail));
  const pos = geo.attributes.position;
  // Stretch into an elongated ellipsoid — high radial variance.
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * 1.6, pos.getY(i) * 0.55, pos.getZ(i) * 1.1);
  }
  // Build adjacency from the index.
  const neighbors = Array.from({ length: pos.count }, () => []);
  const index = geo.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    neighbors[a].push(b, c);
    neighbors[b].push(a, c);
    neighbors[c].push(a, b);
  }
  for (let i = 0; i < pos.count; i++) {
    neighbors[i] = [...new Set(neighbors[i])];
  }
  return { positions: pos.array, neighbors, count: pos.count, geo };
}

describe('pebbleAbrade (Domokos–Firey)', () => {
  it('reduces radial variance (pebble rounds toward a sphere)', () => {
    const { positions, neighbors, count } = stretchedPebble(2);
    const before = radialStats(positions, count);
    pebbleAbrade(positions, neighbors, count, {
      iterations: 12, rate: 0.2, sphericity: 0.7,
    });
    const after = radialStats(positions, count);
    assert.ok(
      after.variance < before.variance,
      `radial variance should fall (got ${after.variance.toFixed(4)} < ${before.variance.toFixed(4)})`,
    );
    // Axis span (max−min radius) also shrinks — Phase II signature.
    const spanBefore = before.max - before.min;
    const spanAfter = after.max - after.min;
    assert.ok(
      spanAfter < spanBefore,
      `radius span should shrink (got ${spanAfter.toFixed(4)} < ${spanBefore.toFixed(4)})`,
    );
  });

  it('Phase I (sphericity=0) still abrades high-curvature protrusions', () => {
    // A cube-like cross: centre + six axis tips. Tips have higher curvature
    // relative to the flat "faces" and should move inward under Phase I alone.
    const positions = new Float32Array([
      0, 0, 0,     // 0 centre
      1, 0, 0,     // 1 +X tip
      -1, 0, 0,    // 2 −X tip
      0, 1, 0,     // 3 +Y tip
      0, -1, 0,    // 4 −Y tip
      0, 0, 1,     // 5 +Z tip
      0, 0, -1,    // 6 −Z tip
      0.5, 0.5, 0, // 7 face-ish (lower curvature than a tip)
    ]);
    const neighbors = [
      [1, 2, 3, 4, 5, 6, 7],
      [0, 7], [0], [0], [0], [0], [0], [0, 1],
    ];
    const tipRBefore = Math.hypot(positions[3], positions[4], positions[5]); // vertex 1
    pebbleAbrade(positions, neighbors, 8, { iterations: 6, rate: 0.25, sphericity: 0 });
    const tipRAfter = Math.hypot(positions[3], positions[4], positions[5]);
    assert.ok(tipRAfter < tipRBefore, `Phase I should shrink tips (got ${tipRAfter} < ${tipRBefore})`);
  });

  it('is a no-op when rate and sphericity are zero', () => {
    const { positions, neighbors, count } = stretchedPebble(1);
    const snapshot = Float32Array.from(positions);
    pebbleAbrade(positions, neighbors, count, { iterations: 5, rate: 0, sphericity: 0 });
    for (let i = 0; i < positions.length; i++) {
      assert.equal(positions[i], snapshot[i]);
    }
  });

  it('applyErosion skips pebbleAbrade unless enabled', () => {
    const geo = mergeVertices(new IcosahedronGeometry(1, 1));
    const before = Float32Array.from(geo.attributes.position.array);
    applyErosion(geo, {
      thermal: { enabled: false },
      hydraulic: { enabled: false },
      edgeWear: { enabled: false },
      // enabled omitted → must NOT run
      pebbleAbrade: { iterations: 20, rate: 1, sphericity: 1 },
    }, new Rng('skip'));
    const after = geo.attributes.position.array;
    for (let i = 0; i < before.length; i++) {
      assert.equal(after[i], before[i], 'disabled pebbleAbrade must not mutate');
    }
    geo.dispose();
  });

  it('riverCobble enables pebbleAbrade; granite does not', () => {
    assert.equal(SPECIES.riverCobble.erosion.pebbleAbrade?.enabled, true);
    assert.equal(SPECIES.granite.erosion.pebbleAbrade?.enabled, undefined);
  });

  it('riverCobble generateRockGeometry is deterministic and more spherical than abrasion-off', () => {
    const on = generateRockGeometry(SPECIES.riverCobble, 77);
    const on2 = generateRockGeometry(SPECIES.riverCobble, 77);
    assert.equal(on.attributes.position.count, on2.attributes.position.count);
    for (let i = 0; i < on.attributes.position.array.length; i++) {
      assert.ok(
        Math.abs(on.attributes.position.array[i] - on2.attributes.position.array[i]) < 1e-8,
        'same seed must be byte-stable',
      );
    }

    const offPreset = {
      ...SPECIES.riverCobble,
      erosion: {
        ...SPECIES.riverCobble.erosion,
        pebbleAbrade: { ...SPECIES.riverCobble.erosion.pebbleAbrade, enabled: false },
        edgeWear: { enabled: true, strength: 0.03 },
      },
    };
    const off = generateRockGeometry(offPreset, 77);

    const statsOn = radialStats(on.attributes.position.array, on.attributes.position.count);
    const statsOff = radialStats(off.attributes.position.array, off.attributes.position.count);
    assert.ok(
      statsOn.variance < statsOff.variance,
      `Domokos-on should be rounder (var ${statsOn.variance.toFixed(5)} < ${statsOff.variance.toFixed(5)})`,
    );

    on.dispose();
    on2.dispose();
    off.dispose();
  });

  it('roundness / abrasion controls write pebbleAbrade fields', () => {
    const c = controlsFromSpecies(SPECIES.riverCobble);
    assert.ok('roundness' in c.params);
    assert.ok('abrasion' in c.params);
    c.params.roundness = 0.9;
    c.params.abrasion = 0.5;
    const shaped = applySpeciesControls(SPECIES.riverCobble, c);
    assert.equal(shaped.erosion.pebbleAbrade.sphericity, 0.9);
    assert.ok(Math.abs(shaped.erosion.pebbleAbrade.rate - 0.15) < 1e-9);
    // Registry entry must stay untouched.
    assert.equal(SPECIES.riverCobble.erosion.pebbleAbrade.sphericity, 0.45);
  });
});
