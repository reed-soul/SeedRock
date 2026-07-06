import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_LIST } from '../src/species/index.js';
import { validateAllSpecies } from '../src/species/validate.js';

describe('species registry', () => {
  it('has at least 8 rock types', () => {
    assert.ok(SPECIES_LIST.length >= 8);
  });

  it('validates all presets', () => {
    const count = validateAllSpecies(SPECIES);
    assert.equal(count, SPECIES_LIST.length);
  });

  it('includes glacial from roadmap', () => {
    assert.ok(SPECIES.glacial);
    assert.equal(SPECIES.glacial.biome, 'alpine');
  });

  it('every species has texture bindings', () => {
    for (const preset of SPECIES_LIST) {
      assert.ok(preset.textures?.albedo, `${preset.id} missing albedo`);
    }
  });
});
