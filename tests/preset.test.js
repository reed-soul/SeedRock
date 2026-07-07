import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES } from '../src/species/index.js';
import { toPreset, fromPreset, buildPreset, PRESET_FORMAT } from '../src/species/preset.js';
import { controlsFromSpecies, applySpeciesControls } from '../src/species/controls.js';

describe('toPreset / fromPreset round-trip', () => {
  it('round-trips a granite design through JSON without loss', () => {
    const base = controlsFromSpecies(SPECIES.granite);
    base.seed = 42;
    base.params.blockiness = 0.3; // override one knob
    const json = toPreset({ ...base, speciesKey: 'granite' });

    assert.equal(json.format, PRESET_FORMAT);
    assert.equal(json.species, 'granite');
    assert.equal(json.seed, 42);
    assert.equal(json.params.blockiness, 0.3);

    const restored = fromPreset(json);
    assert.equal(restored.speciesKey, 'granite');
    assert.equal(restored.seed, 42);
    assert.equal(restored.params.blockiness, 0.3);
  });

  it('fromPreset rejects wrong format', () => {
    assert.throws(() => fromPreset({ format: 'bogus/0' }), /seedrock-preset\/1/);
    assert.throws(() => fromPreset(null), /seedrock-preset\/1/);
  });

  it('fromPreset rejects unknown species', () => {
    assert.throws(
      () => fromPreset({ format: PRESET_FORMAT, species: 'notARock', seed: 1 }),
      /unknown species/,
    );
  });

  it('toPreset rejects unknown species', () => {
    assert.throws(
      () => toPreset({ seed: 1, shape: {}, erosion: {}, overlay: {}, params: {} }, 'notARock'),
      /unknown species/,
    );
  });

  it('fromPreset fills gaps from species defaults (old-preset compat)', () => {
    // A minimal preset missing shape/erosion/overlay/params still loads.
    const restored = fromPreset({ format: PRESET_FORMAT, species: 'basalt', seed: 7 });
    assert.equal(restored.speciesKey, 'basalt');
    assert.equal(restored.seed, 7);
    // params fall back to basalt's defaults.
    assert.ok('columnDensity' in restored.params);
  });
});

describe('buildPreset (Headless API convenience)', () => {
  it('builds a preset directly from (species, seed, override)', () => {
    const preset = buildPreset('granite', 42, { params: { blockiness: 0.2 } });
    assert.equal(preset.format, PRESET_FORMAT);
    assert.equal(preset.species, 'granite');
    assert.equal(preset.seed, 42);
    assert.equal(preset.params.blockiness, 0.2);
    // sibling param kept from defaults
    assert.ok('grainRoughness' in preset.params);
  });

  it('a built preset, applied, reproduces the override in the shaped preset', () => {
    const preset = buildPreset('granite', 1, { params: { blockiness: 0.2 } });
    // Reconstruct a controls object from the preset and apply it.
    const restored = fromPreset(preset);
    const shaped = applySpeciesControls(SPECIES.granite, restored);
    // blockiness 0.2 < 0.5 → ridged false
    assert.equal(shaped.noise.ridged, false);
  });
});

describe('preset ⇄ URL consistency (the deep-link contract)', () => {
  it('a preset saved then loaded produces the same species + seed + override', () => {
    // This is what the Save/Load UI relies on.
    const original = controlsFromSpecies(SPECIES.crystal);
    original.seed = 1234;
    original.params.tipChipping = 0.9;
    const json = toPreset({ ...original, speciesKey: 'crystal' });
    const restored = fromPreset(json);
    assert.equal(restored.speciesKey, 'crystal');
    assert.equal(restored.seed, 1234);
    assert.equal(restored.params.tipChipping, 0.9);
  });
});
