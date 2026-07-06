import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyUrlState, buildViewerUrl } from '../src/ui/url-state.js';
import { createDefaultState } from '../src/ui/controls.js';

describe('url-state', () => {
  it('applies species and seed from query string', () => {
    const state = createDefaultState();
    applyUrlState(state, new URLSearchParams('species=basalt&seed=99'));
    assert.equal(state.speciesKey, 'basalt');
    assert.equal(state.seed, 99);
  });

  it('applies overlay and scene params', () => {
    const state = createDefaultState();
    applyUrlState(state, new URLSearchParams('scene=living&moss=0.5&snow=0.8&scatter=12'));
    assert.equal(state.sceneMode, 'living');
    assert.equal(state.overlay.moss, 0.5);
    assert.equal(state.overlay.snow, 0.8);
    assert.equal(state.scene.scatterCount, 12);
  });

  it('ignores unknown species', () => {
    const state = createDefaultState();
    const before = state.speciesKey;
    applyUrlState(state, new URLSearchParams('species=notARock'));
    assert.equal(state.speciesKey, before);
  });

  it('builds viewer deep links', () => {
    const url = buildViewerUrl({
      speciesKey: 'granite',
      seed: 42,
      overlay: { moss: 0.6 },
    }, '/SeedRock/');
    assert.ok(url.includes('/SeedRock/index.html?'));
    assert.ok(url.includes('species=granite'));
    assert.ok(url.includes('seed=42'));
    assert.ok(url.includes('moss=0.6'));
  });
});
