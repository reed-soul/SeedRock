import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thermalErode, hydraulicErode, edgeWear } from '../src/generator/erosion.js';

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
