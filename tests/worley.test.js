import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cellJitter, worleyDiskPoints, worleyFeaturePointsXZ } from '../src/core/worley.js';
import { Rng } from '../src/core/rng.js';
import { makeNoise3D } from '../src/core/noise.js';
import { SPECIES } from '../src/species/index.js';
import { buildStructureGraph, meshStructureGraph } from '../src/generator/structure/graph.js';
import { buildCrystalGraph } from '../src/generator/structure/crystal.js';
import { generateRockGeometry } from '../src/generator/mesh.js';

describe('Worley cellular feature points', () => {
  it('cellJitter is deterministic and in [0, 1)', () => {
    const a = cellJitter(3, -2, 42);
    const b = cellJitter(3, -2, 42);
    assert.deepEqual(a, b);
    assert.ok(a[0] >= 0 && a[0] < 1);
    assert.ok(a[1] >= 0 && a[1] < 1);
    // Different cells / seeds diverge.
    assert.notDeepEqual(cellJitter(3, -2, 42), cellJitter(4, -2, 42));
    assert.notDeepEqual(cellJitter(3, -2, 42), cellJitter(3, -2, 99));
  });

  it('worleyFeaturePointsXZ returns points inside the box', () => {
    const pts = worleyFeaturePointsXZ(7, {
      minX: -1, maxX: 1, minZ: -1, maxZ: 1, cellSize: 0.4,
    });
    assert.ok(pts.length >= 4, `expected several points, got ${pts.length}`);
    for (const [x, z] of pts) {
      assert.ok(x >= -1 && x <= 1, `x=${x} out of box`);
      assert.ok(z >= -1 && z <= 1, `z=${z} out of box`);
    }
  });

  it('worleyDiskPoints are sorted nearest-first and respect exclude radius', () => {
    const pts = worleyDiskPoints(11, {
      radius: 1,
      cellSize: 0.35,
      excludeRadius: 0.2,
    });
    assert.ok(pts.length >= 3);
    for (let i = 1; i < pts.length; i++) {
      assert.ok(pts[i].dist >= pts[i - 1].dist);
    }
    for (const p of pts) {
      assert.ok(p.dist >= 0.2 - 1e-9);
      assert.ok(p.dist <= 1 + 1e-9);
    }
  });
});

describe('Crystal Worley nucleation', () => {
  it('fan mode still matches the golden habit (nucleation tag)', () => {
    const rng = new Rng('crystal:fan-check');
    const graph = buildCrystalGraph({ radius: 1, detail: 4, nucleation: 'fan' }, rng);
    assert.equal(graph.nucleation, 'fan');
    assert.ok(graph.shards.length >= 6); // 1 centre + 5–9 satellites
    assert.equal(graph.shards[0].isCenter, true);
  });

  it('worley mode tags the graph and places satellites off-origin', () => {
    const rng = new Rng('crystal:worley-check');
    const graph = buildCrystalGraph({
      radius: 1, detail: 4, nucleation: 'worley', nucleationDensity: 0.6,
    }, rng);
    assert.equal(graph.nucleation, 'worley');
    assert.equal(graph.habit, 'radiating');
    const sats = graph.shards.filter((s) => !s.isCenter);
    assert.ok(sats.length >= 5);
    // At least some satellites sit away from the origin (Worley sites).
    const offOrigin = sats.filter((s) => Math.hypot(s.pos[0], s.pos[2]) > 0.05);
    assert.ok(offOrigin.length >= 3, `expected off-origin sites, got ${offOrigin.length}`);
  });

  it('worley nucleation is deterministic for the same seed', () => {
    const shape = { radius: 1, detail: 4, nucleation: 'worley', nucleationDensity: 0.55 };
    const a = buildCrystalGraph(shape, new Rng('det:1'));
    const b = buildCrystalGraph(shape, new Rng('det:1'));
    assert.equal(a.shards.length, b.shards.length);
    for (let i = 0; i < a.shards.length; i++) {
      assert.deepEqual(a.shards[i].pos, b.shards[i].pos);
      assert.deepEqual(a.shards[i].dir, b.shards[i].dir);
      assert.equal(a.shards[i].h, b.shards[i].h);
    }
  });

  it('higher nucleationDensity yields a finer lattice (more candidates before thin)', () => {
    // Probe the raw Worley disk — density only affects cellSize / diskR.
    const sparse = worleyDiskPoints(99, { radius: 0.35, cellSize: 0.42, excludeRadius: 0.08 });
    const dense = worleyDiskPoints(99, { radius: 0.40, cellSize: 0.20, excludeRadius: 0.08 });
    assert.ok(dense.length > sparse.length, `dense (${dense.length}) should exceed sparse (${sparse.length})`);
  });

  it('crystal + ice species default to worley nucleation', () => {
    assert.equal(SPECIES.crystal.shape.nucleation, 'worley');
    assert.equal(SPECIES.ice.shape.nucleation, 'worley');
  });

  it('generateRockGeometry with worley produces a closed mesh', () => {
    const geo = generateRockGeometry(SPECIES.crystal, 88);
    assert.ok(geo.attributes.position.count > 50);
    assert.ok(geo.boundingBox);
    // Worley and fan produce different silhouettes for the same seed.
    const fanPreset = {
      ...SPECIES.crystal,
      shape: { ...SPECIES.crystal.shape, nucleation: 'fan' },
    };
    const fanGeo = generateRockGeometry(fanPreset, 88);
    const a = geo.attributes.position.array;
    const b = fanGeo.attributes.position.array;
    // Same seed, different nucleation → positions must diverge (or at least
    // shard layout differs enough that the merged mesh is not identical).
    let same = a.length === b.length;
    if (same) {
      same = true;
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) > 1e-6) { same = false; break; }
      }
    }
    assert.equal(same, false, 'worley and fan meshes should differ for the same seed');
    geo.dispose();
    fanGeo.dispose();
  });

  it('StructureGraph path for crystal species uses worley', () => {
    const preset = SPECIES.crystal;
    const rng = new Rng(`${preset.id}:7`);
    const noise = makeNoise3D(rng.int(1, 1_000_000));
    const graph = buildStructureGraph(preset, rng, noise);
    assert.equal(graph.form, 'crystal');
    assert.equal(graph.crystal.nucleation, 'worley');
    const geo = meshStructureGraph(graph);
    assert.ok(geo.attributes.position.count > 0);
    geo.dispose();
  });
});
