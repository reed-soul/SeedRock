import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_LIST } from '../src/species/index.js';
import { controlsFromSpecies, applySpeciesControls, mergeControls } from '../src/species/controls.js';

// All 15 species now have a per-species controls[] vocabulary.
const SPECIES_WITH_CONTROLS = Object.keys(SPECIES);

describe('controlsFromSpecies', () => {
  it('returns shared defaults + params for every species', () => {
    for (const preset of SPECIES_LIST) {
      const c = controlsFromSpecies(preset);
      assert.equal(c.seed, 1, `${preset.id} seed default`);
      assert.deepEqual(Object.keys(c).sort(), ['erosion', 'overlay', 'params', 'seed', 'shape', 'style']);
      assert.ok(Object.keys(c.params).length > 0, `${preset.id} has at least one param knob`);
    }
  });

  it('populates params from each controls[] entry', () => {
    const c = controlsFromSpecies(SPECIES.granite);
    assert.ok('blockiness' in c.params, 'granite blockiness knob present');
    assert.ok('grainRoughness' in c.params);
    assert.ok('fractureWeathering' in c.params);
    assert.ok('rainwear' in c.params);
  });

  it('reads preset defaults through get()', () => {
    const c = controlsFromSpecies(SPECIES.granite);
    // granite defaults to ridged noise → blockiness 0.8
    assert.equal(c.params.blockiness, 0.8);
    // granite.microAmplitude 0.035
    assert.equal(c.params.grainRoughness, 0.035);
  });

  it('seed defaults reflect preset erosion toggles', () => {
    const c = controlsFromSpecies(SPECIES.crystal);
    // crystal disables thermal + hydraulic
    assert.equal(c.erosion.thermal, false);
    assert.equal(c.erosion.hydraulic, false);
    assert.equal(c.erosion.edgeWear, true);
  });
});

describe('applySpeciesControls', () => {
  it('clones the preset (does not mutate the original)', () => {
    const before = JSON.stringify(SPECIES.granite);
    const c = controlsFromSpecies(SPECIES.granite);
    applySpeciesControls(SPECIES.granite, c);
    assert.equal(JSON.stringify(SPECIES.granite), before, 'preset not mutated');
  });

  it('round-trips: get → set restores the preset field', () => {
    for (const key of SPECIES_WITH_CONTROLS) {
      const preset = SPECIES[key];
      const c = controlsFromSpecies(preset);
      const shaped = applySpeciesControls(preset, c);
      // Re-read the shaped preset through get(); values must match.
      for (const d of preset.controls) {
        const original = d.get(preset);
        const after = d.get(shaped);
        assert.equal(after, original, `${key}.${d.key} round-trip`);
      }
    }
  });

  it('writes a param override through set()', () => {
    const base = controlsFromSpecies(SPECIES.granite);
    const override = mergeControls(base, { params: { blockiness: 0.2 } });
    const shaped = applySpeciesControls(SPECIES.granite, override);
    // blockiness 0.2 < 0.5 → ridged false
    assert.equal(shaped.noise.ridged, false, 'blockiness 0.2 disables ridged noise');
  });

  it('writes legacy shape.radius override', () => {
    const base = controlsFromSpecies(SPECIES.granite);
    const override = mergeControls(base, { shape: { radius: 1.7 } });
    const shaped = applySpeciesControls(SPECIES.granite, override);
    assert.equal(shaped.shape.radius, 1.7);
  });

  it('writes legacy erosion toggle override', () => {
    const base = controlsFromSpecies(SPECIES.granite);
    const override = mergeControls(base, { erosion: { hydraulic: false } });
    const shaped = applySpeciesControls(SPECIES.granite, override);
    assert.equal(shaped.erosion.hydraulic.enabled, false);
  });

  it('ignores unknown params keys (no silent field clobbering)', () => {
    const base = controlsFromSpecies(SPECIES.granite);
    const override = mergeControls(base, { params: { bogusKey: 999 } });
    const shaped = applySpeciesControls(SPECIES.granite, override);
    // bogusKey is not in granite.controls[], so nothing it touches changes.
    assert.equal(shaped.noise.ridged, SPECIES.granite.noise.ridged);
  });

  it('is a superset of the legacy applyOverrides (shape + erosion fields)', () => {
    const state = controlsFromSpecies(SPECIES.basalt);
    const shaped = applySpeciesControls(SPECIES.basalt, state);
    assert.equal(shaped.shape.radius, state.shape.radius);
    assert.equal(shaped.shape.detail, state.shape.detail);
    assert.equal(shaped.shape.squash, state.shape.squash);
    assert.equal(shaped.noise.amplitude, state.shape.amplitude);
    assert.equal(shaped.erosion.thermal.enabled, state.erosion.thermal);
  });
});

describe('mergeControls', () => {
  it('deep-merges params without wiping siblings', () => {
    const base = { params: { a: 1, b: 2 } };
    const merged = mergeControls(base, { params: { b: 99 } });
    assert.equal(merged.params.a, 1, 'untouched sibling kept');
    assert.equal(merged.params.b, 99, 'overridden value written');
  });

  it('deep-merges shape sub-object', () => {
    const base = { shape: { radius: 1, detail: 4 } };
    const merged = mergeControls(base, { shape: { radius: 1.5 } });
    assert.equal(merged.shape.radius, 1.5);
    assert.equal(merged.shape.detail, 4, 'untouched shape field kept');
  });
});

describe('every declared control is well-formed', () => {
  for (const key of SPECIES_WITH_CONTROLS) {
    const preset = SPECIES[key];
    for (const d of preset.controls) {
      it(`${key}.${d.key} has required fields`, () => {
        assert.ok(d.key, 'key');
        assert.ok(d.name, 'name');
        assert.equal(typeof d.get, 'function', 'get fn');
        assert.equal(typeof d.set, 'function', 'set fn');
        if (!d.dropdown) {
          assert.equal(typeof d.min, 'number', 'min');
          assert.equal(typeof d.max, 'number', 'max');
          assert.ok(d.max > d.min, 'max > min');
        }
      });
    }
  }
});
