import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRockMaterial } from '../src/materials/rock-material.js';

const granitePreset = {
  id: 'granite', color: 0x9a9590, roughness: 0.92, metalness: 0.02,
  textures: { triplanarScale: 0.45 },
};

test('style=pbr → MeshStandardNodeMaterial, normalDetail active', () => {
  const mat = makeRockMaterial(granitePreset, {}, {}, {}, { style: 'pbr' });
  assert.equal(mat.isMeshStandardNodeMaterial, true);
  assert.ok(!mat.isMeshToonNodeMaterial, 'pbr is not a toon material');
  assert.ok(!mat.flatShading, 'pbr should not flat-shade');
  mat.dispose?.();
});

test('style=lowpoly → flatShading enabled, standard material kept', () => {
  const mat = makeRockMaterial(granitePreset, {}, {}, {}, { style: 'lowpoly' });
  // lowpoly still uses standard material (for PBR base) but with flat face normals
  assert.equal(mat.flatShading, true);
  assert.equal(mat.isMeshStandardNodeMaterial, true);
  mat.dispose?.();
});

test('style=toon → MeshToonNodeMaterial with gradient ramp', () => {
  const mat = makeRockMaterial(granitePreset, {}, {}, {}, { style: 'toon' });
  assert.equal(mat.isMeshToonNodeMaterial, true);
  // toon material carries a gradient ramp texture (DataTexture) for the cel bands
  assert.ok(mat.gradientMap, 'toon material should carry a gradientMap');
  mat.dispose?.();
});

test('default style (no opts) → pbr, backward compatible', () => {
  const mat = makeRockMaterial(granitePreset, {});
  assert.equal(mat.isMeshStandardNodeMaterial, true);
  assert.ok(!mat.flatShading, 'default should not flat-shade');
  mat.dispose?.();
});
