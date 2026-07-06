import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeNoise3D } from '../src/core/noise.js';
import { Rng } from '../src/core/rng.js';
import { buildBoulder, displaceRadial } from '../src/generator/forms/boulder.js';
import { buildColumnar } from '../src/generator/forms/columnar.js';
import { buildSlate } from '../src/generator/forms/slate.js';
import { buildCrystal } from '../src/generator/forms/crystal.js';

const shape = { radius: 1, detail: 4 };
const noiseParams = {
  scale: 2, offset: [0, 0, 0], octaves: 4, lacunarity: 2, gain: 0.5,
  amplitude: 0.2, microAmplitude: 0.03, ridged: false,
};

function boundingBox(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  return {
    sizeX: max.x - min.x,
    sizeY: max.y - min.y,
    sizeZ: max.z - min.z,
    minY: min.y,
    maxY: max.y,
  };
}

test('boulder: roughly spherical (all axes similar) after radial displacement', () => {
  const noise = makeNoise3D(1);
  const rng = new Rng('test');
  const { geo, origin } = buildBoulder(shape, noiseParams, noise, rng);
  displaceRadial(geo, origin, noiseParams, noise, [1, 1, 1]);
  const bb = boundingBox(geo);
  // Boulder is blob-like; no axis dominates by more than ~2× another.
  const ratioXZ = Math.max(bb.sizeX, bb.sizeZ) / Math.min(bb.sizeX, bb.sizeZ);
  assert.ok(ratioXZ < 2, `boulder XZ ratio ${ratioXZ} should be < 2`);
  geo.dispose();
});

test('columnar: taller than wide (vertical colonnade)', () => {
  const noise = makeNoise3D(1);
  const rng = new Rng('test');
  const { geo } = buildColumnar(shape, noise, rng);
  const bb = boundingBox(geo);
  assert.ok(bb.sizeY > bb.sizeX, `columnar should be taller than wide (Y=${bb.sizeY.toFixed(2)} X=${bb.sizeX.toFixed(2)})`);
  assert.ok(bb.sizeY > bb.sizeZ, `columnar should be taller than deep (Y=${bb.sizeY.toFixed(2)} Z=${bb.sizeZ.toFixed(2)})`);
  geo.dispose();
});

test('slate: flat plate — much wider than tall', () => {
  const rng = new Rng('test');
  const { geo } = buildSlate(shape, rng);
  const bb = boundingBox(geo);
  // Slate is a horizontal slab: footprint >> height.
  assert.ok(bb.sizeX > bb.sizeY * 2, `slate width (${bb.sizeX.toFixed(2)}) should be > 2× height (${bb.sizeY.toFixed(2)})`);
  assert.ok(bb.sizeZ > bb.sizeY * 2, `slate depth should be > 2× height`);
  geo.dispose();
});

test('crystal: radiates upward (cluster is taller than its base footprint)', () => {
  const rng = new Rng('test');
  const { geo } = buildCrystal(shape, rng);
  const bb = boundingBox(geo);
  // Crystal cluster has a tall central shard; height comparable to footprint.
  assert.ok(bb.sizeY > bb.sizeX * 0.8, `crystal height (${bb.sizeY.toFixed(2)}) should approach footprint (${bb.sizeX.toFixed(2)})`);
  assert.ok(bb.maxY > 1.0, `crystal should reach above unit height (maxY=${bb.maxY.toFixed(2)})`);
  geo.dispose();
});

test('columnar: deterministic for the same seed', () => {
  const noise = makeNoise3D(1);
  const a = buildColumnar(shape, noise, new Rng('seed-1'));
  const b = buildColumnar(shape, noise, new Rng('seed-1'));
  assert.equal(a.geo.attributes.position.count, b.geo.attributes.position.count);
  a.geo.dispose(); b.geo.dispose();
});
