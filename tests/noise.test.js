import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeNoise3D } from '../src/core/noise.js';

describe('makeNoise3D', () => {
  it('is deterministic for the same seed', () => {
    const a = makeNoise3D(12345);
    const b = makeNoise3D(12345);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const x = i * 0.3, y = i * 0.7, z = i * 0.1;
      samples.push([a.fbm(x, y, z, 4, 2, 0.5), b.fbm(x, y, z, 4, 2, 0.5)]);
    }
    for (const [va, vb] of samples) {
      assert.equal(va, vb);
    }
  });

  it('fbm output is roughly bounded', () => {
    const n = makeNoise3D(1);
    for (let i = 0; i < 50; i++) {
      const v = n.fbm(Math.random() * 5, Math.random() * 5, Math.random() * 5, 4, 2, 0.5);
      assert.ok(v >= -1.5 && v <= 1.5);
    }
  });
});
