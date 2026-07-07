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

  it('applies per-species param overrides via p.<key>', () => {
    const state = createDefaultState();
    // switch to granite first so its controls[] is the active vocabulary
    applyUrlState(state, new URLSearchParams('species=granite&p.blockiness=0.2'));
    assert.equal(state.params.blockiness, 0.2);
  });

  it('ignores p.<key> for keys the species does not declare', () => {
    const state = createDefaultState();
    applyUrlState(state, new URLSearchParams('species=granite&p.bogusKnob=9'));
    assert.ok(!('bogusKnob' in (state.params ?? {})));
  });

  it('builds a URL with per-species params', () => {
    const url = buildViewerUrl({
      speciesKey: 'granite',
      seed: 1,
      params: { blockiness: 0.3 },
    });
    assert.ok(url.includes('p.blockiness=0.3'), 'param emitted as p.<key>');
  });

  it('does NOT emit undeclared params in the URL', () => {
    const url = buildViewerUrl({
      speciesKey: 'granite',
      seed: 1,
      params: { blockiness: 0.3, bogusKnob: 9 },
    });
    assert.ok(!url.includes('bogusKnob'));
  });

  it('legacy URL without p.* still works (back-compat)', () => {
    const state = createDefaultState();
    applyUrlState(state, new URLSearchParams('species=granite&seed=5&scene=living'));
    assert.equal(state.speciesKey, 'granite');
    assert.equal(state.seed, 5);
    assert.equal(state.sceneMode, 'living');
  });
});
