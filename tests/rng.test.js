import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/core/rng.js';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng('granite:42');
    const b = new Rng('granite:42');
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    assert.deepEqual(seqA, seqB);
  });

  it('differs for different seeds', () => {
    const a = new Rng('seed-a');
    const b = new Rng('seed-b');
    assert.notEqual(a.next(), b.next());
  });

  it('range stays within bounds', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 100; i++) {
      const v = rng.range(2, 5);
      assert.ok(v >= 2 && v < 5);
    }
  });

  it('int is inclusive', () => {
    const rng = new Rng('int-test');
    for (let i = 0; i < 50; i++) {
      const v = rng.int(3, 7);
      assert.ok(v >= 3 && v <= 7);
    }
  });
});
