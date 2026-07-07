import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Group, IcosahedronGeometry, MeshStandardMaterial } from 'three/webgpu';
import { buildColliderMesh } from '../src/export/glb.js';

test('buildColliderMesh: produces a position-only mesh named _collider', () => {
  const geo = new IcosahedronGeometry(1, 2);
  geo.computeVertexNormals();
  const level = new Group();
  level.add(new Mesh(geo, new MeshStandardMaterial()));
  const col = buildColliderMesh(level, 'granite');
  assert.ok(col, 'should return a mesh');
  assert.equal(col.name, 'granite_collider');
  assert.equal(col.visible, false);
  geo.dispose();
});

test('buildColliderMesh: strips non-position attributes', () => {
  const geo = new IcosahedronGeometry(1, 2);
  geo.computeVertexNormals();
  const level = new Group();
  level.add(new Mesh(geo, new MeshStandardMaterial()));
  const col = buildColliderMesh(level, 'basalt');
  assert.ok(col.geometry.attributes.position, 'position must remain');
  assert.equal(col.geometry.attributes.normal, undefined, 'normal should be stripped');
  assert.equal(col.geometry.attributes.uv, undefined, 'uv should be stripped');
  geo.dispose();
});

test('buildColliderMesh: returns null for an empty level', () => {
  const level = new Group(); // no mesh
  const col = buildColliderMesh(level, 'marble');
  assert.equal(col, null);
});

test('buildColliderMesh: vertex count matches source (no extra simplification)', () => {
  // Collider reuses the source LOD geometry positions — it does not run its
  // own decimation. The contract is "position-only copy of the reduced LOD".
  const geo = new IcosahedronGeometry(1, 2);
  const level = new Group();
  level.add(new Mesh(geo, new MeshStandardMaterial()));
  const col = buildColliderMesh(level, 'slate');
  assert.equal(col.geometry.attributes.position.count, geo.attributes.position.count);
  geo.dispose();
});

test('buildColliderMesh: collider has fewer verts than a full-detail LOD0', () => {
  // The intent: collider (from reduced LOD1) is cheaper than LOD0. Simulate
  // by building from detail=1 vs detail=4 source geometries.
  const lod0Geo = new IcosahedronGeometry(1, 4);
  const lod1Geo = new IcosahedronGeometry(1, 1);
  const lod1Level = new Group();
  lod1Level.add(new Mesh(lod1Geo, new MeshStandardMaterial()));
  const col = buildColliderMesh(lod1Level, 'ore');
  assert.ok(col.geometry.attributes.position.count < lod0Geo.attributes.position.count,
    `collider (${col.geometry.attributes.position.count}) should be cheaper than LOD0 (${lod0Geo.attributes.position.count})`);
  lod0Geo.dispose(); lod1Geo.dispose();
});
