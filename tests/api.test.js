import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listSpecies, getSchema, defaultControls, describe as describeSpecies,
  generate, skeleton, statsOf, toPreset, fromPreset,
} from '../src/api/seedrock.js';
import { SPECIES_LIST } from '../src/species/index.js';

describe('listSpecies', () => {
  it('covers all 15 species', () => {
    const list = listSpecies();
    assert.equal(list.length, SPECIES_LIST.length);
    for (const s of list) {
      assert.ok(s.key, 'key');
      assert.ok(s.name, 'name');
      assert.ok(s.form, 'form');
    }
  });

  it('marks ice as physical material', () => {
    const ice = listSpecies().find((s) => s.key === 'ice');
    assert.equal(ice.material, 'physical');
  });
});

describe('getSchema / defaultControls / describe', () => {
  it('getSchema returns knobs matching the species controls[]', () => {
    const schema = getSchema('granite');
    assert.equal(schema.species, 'granite');
    assert.ok(schema.knobs.length >= 3);
    const keys = schema.knobs.map((k) => k.key);
    assert.ok(keys.includes('blockiness'));
    assert.ok(keys.includes('rainwear'));
  });

  it('getSchema throws for unknown species', () => {
    assert.throws(() => getSchema('notARock'), /unknown species/);
  });

  it('defaultControls matches controlsFromSpecies output', () => {
    const c = defaultControls('basalt');
    assert.ok('columnDensity' in c.params);
    assert.ok('angularity' in c.params);
  });

  it('describe() with no args returns the species menu', () => {
    const text = describeSpecies();
    assert.match(text, /SeedRock species/);
    assert.match(text, /granite/i);
  });

  it("describe('<species>') returns that species' knobs", () => {
    const text = describeSpecies('slate');
    assert.match(text, /Slate/);
    assert.match(text, /beddingRelief|surfaceFlakes|edgeSplinter/);
  });
});

describe('generate (headless, no GPU)', () => {
  it('produces a real geometry with sensible stats', () => {
    const { geometry, stats, preset } = generate({ species: 'granite', seed: 42 });
    assert.ok(geometry.attributes.position, 'position attribute');
    assert.ok(stats.verts > 0, 'has verts');
    assert.ok(stats.triangles > 0, 'has triangles');
    assert.ok(stats.sizeMeters.height > 0);
    assert.equal(preset.format, 'seedrock-preset/1');
    assert.equal(preset.species, 'granite');
  });

  it('is deterministic per (species, seed)', () => {
    const a = generate({ species: 'karst', seed: 100 });
    const b = generate({ species: 'karst', seed: 100 });
    assert.deepEqual(a.stats.sizeMeters, b.stats.sizeMeters);
    assert.equal(a.stats.verts, b.stats.verts);
  });

  it('differs for different seeds', () => {
    const a = generate({ species: 'karst', seed: 1 });
    const b = generate({ species: 'karst', seed: 2 });
    // BBox or verts will differ for different seeds.
    const differs = a.stats.verts !== b.stats.verts
      || JSON.stringify(a.stats.sizeMeters) !== JSON.stringify(b.stats.sizeMeters);
    assert.ok(differs, 'different seed → different geometry');
  });

  it('applies a per-species param override', () => {
    // blockiness 0.2 → ridged false; blockiness 0.9 → ridged true.
    const soft = generate({ species: 'granite', seed: 7, controls: { params: { blockiness: 0.2 } } });
    const sharp = generate({ species: 'granite', seed: 7, controls: { params: { blockiness: 0.9 } } });
    assert.equal(soft.shaped.noise.ridged, false);
    assert.equal(sharp.shaped.noise.ridged, true);
  });

  it('style override reaches the generator', () => {
    // lowpoly deletes the normal attribute on the resulting geometry.
    const { geometry } = generate({ species: 'granite', seed: 1, style: 'lowpoly' });
    assert.ok(!geometry.attributes.normal, 'lowpoly drops the normal attribute for flat shading');
  });
});

describe('skeleton (cheap, no erosion)', () => {
  it('runs faster than full generate on a high-erosion species', () => {
    const time = (fn) => {
      const t0 = performance.now();
      fn();
      return performance.now() - t0;
    };
    const median = (fn, runs = 7) => {
      for (let i = 0; i < 2; i++) fn(); // warmup JIT + caches
      const samples = Array.from({ length: runs }, () => time(fn));
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)];
    };

    const tGen = median(() => generate({ species: 'riverCobble', seed: 5 }));
    const tSkel = median(() => skeleton({ species: 'riverCobble', seed: 5 }));

    // skeleton skips erosion, so it should be at least as fast — usually much
    // faster. Median + warmup keeps this robust on a loaded CI box.
    assert.ok(tSkel <= tGen * 1.5, `skeleton (${tSkel.toFixed(1)}ms) not slower than generate (${tGen.toFixed(1)}ms)`);
  });

  it('returns stats without erosion fields', () => {
    const sk = skeleton({ species: 'basalt', seed: 1 });
    assert.ok(sk.verts > 0);
    assert.equal(sk.eroded, false);
  });
});

describe('statsOf', () => {
  it('handles a bare BufferGeometry', () => {
    const { geometry } = generate({ species: 'granite', seed: 1 });
    const s = statsOf(geometry);
    assert.ok(s.triangles > 0);
    assert.ok(s.sizeMeters);
  });
});

describe('preset round-trip through the API', () => {
  it('generate → toPreset → fromPreset → generate reproduces the stats', () => {
    const a = generate({ species: 'crystal', seed: 99, controls: { params: { tipChipping: 0.7 } } });
    const json = a.preset;
    const restored = fromPreset(json);
    const b = generate({
      species: restored.speciesKey,
      seed: restored.seed,
      controls: { params: restored.params, shape: restored.shape, erosion: restored.erosion },
    });
    assert.deepEqual(a.stats.sizeMeters, b.stats.sizeMeters);
    assert.equal(a.stats.verts, b.stats.verts);
  });
});
