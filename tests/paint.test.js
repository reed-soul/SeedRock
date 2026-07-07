import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDrop, nextSlot, pickVariantIndex, MAX_PAINT } from '../src/generator/paint.js';
import { Rng } from '../src/core/rng.js';

test('shouldDrop: first drop always allowed (no previous point)', () => {
  assert.equal(shouldDrop(null, { x: 0, y: 0, z: 0 }, 0.3), true);
});

test('shouldDrop: cursor within spacing is suppressed', () => {
  const prev = { x: 0, y: 5, z: 0 };
  // Horizontal distance 0.2 < spacing 0.3 → no drop (Y must not factor in).
  assert.equal(shouldDrop(prev, { x: 0.2, y: 99, z: 0 }, 0.3), false);
});

test('shouldDrop: cursor past spacing drops', () => {
  const prev = { x: 0, y: 0, z: 0 };
  assert.equal(shouldDrop(prev, { x: 0.3, y: 0, z: 0 }, 0.3), true);   // exactly spacing
  assert.equal(shouldDrop(prev, { x: 0.4, y: 0, z: 0 }, 0.3), true);
  assert.equal(shouldDrop(prev, { x: 0, y: 0, z: 0.5 }, 0.3), true);   // diagonal Z
});

test('shouldDrop: uses horizontal distance only (ignores Y)', () => {
  const prev = { x: 0, y: 0, z: 0 };
  // Big Y jump but no horizontal move → still suppressed.
  assert.equal(shouldDrop(prev, { x: 0, y: 10, z: 0 }, 0.3), false);
});

test('nextSlot: fills sequentially up to MAX_PAINT', () => {
  assert.equal(nextSlot(0, 0), 0);
  assert.equal(nextSlot(5, 5), 5);
  assert.equal(nextSlot(MAX_PAINT - 1, MAX_PAINT - 1), MAX_PAINT - 1);
});

test('nextSlot: wraps around once MAX_PAINT is reached (ring buffer)', () => {
  // Once count has hit the cap, the slot pointer wraps modulo MAX_PAINT so the
  // oldest painted instance is the one overwritten next.
  assert.equal(nextSlot(0, MAX_PAINT), 1);
  assert.equal(nextSlot(MAX_PAINT - 1, MAX_PAINT), 0);
  assert.equal(nextSlot(500, MAX_PAINT), 501);
});

test('pickVariantIndex: returns in-range variant for rng', () => {
  const rng = new Rng('paint-variant-test');
  for (let i = 0; i < 20; i++) {
    const vi = pickVariantIndex(rng, 3);
    assert.ok(vi >= 0 && vi < 3, `variant ${vi} out of range`);
  }
});

test('nextSlot: wrap is stable across many overwrites', () => {
  let slot = 0, count = 0;
  // Simulate dropping 3 × MAX_PAINT instances — slot must stay in [0, MAX_PAINT).
  for (let i = 0; i < MAX_PAINT * 3; i++) {
    slot = nextSlot(slot, count);
    count = Math.min(count + 1, MAX_PAINT);
    assert.ok(slot >= 0 && slot < MAX_PAINT, `slot ${slot} out of range at i=${i}`);
  }
});
