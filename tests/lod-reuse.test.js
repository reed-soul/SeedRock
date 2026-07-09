import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MeshBasicMaterial } from 'three/webgpu';
import { SPECIES } from '../src/species/index.js';
import {
  buildRockStructure,
  meshRockFromStructure,
  generateRockGeometry,
} from '../src/generator/mesh.js';
import { buildRockLOD } from '../src/generator/lod.js';
import { meshStructureGraph } from '../src/generator/structure/graph.js';
import { columnarRadialSegments } from '../src/generator/structure/columnar.js';
import { crystalRadialSides } from '../src/generator/structure/crystal.js';
import { slateSegmentsForDetail } from '../src/generator/structure/slate.js';

function positionsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.round(a[i] * 1e8) / 1e8 !== Math.round(b[i] * 1e8) / 1e8) return false;
  }
  return true;
}

describe('StructureGraph LOD reuse', () => {
  it('full-detail remesh from shared graph matches generateRockGeometry', () => {
    const cases = [
      ['granite', 42],
      ['basalt', 7],
      ['slate', 11],
      ['crystal', 3],
    ];
    for (const [key, seed] of cases) {
      const preset = SPECIES[key];
      const direct = generateRockGeometry(preset, seed);
      const { graph, erosionRng } = buildRockStructure(preset, seed);
      const reused = meshRockFromStructure(graph, preset, erosionRng, {
        detail: preset.shape.detail,
      });
      assert.ok(
        positionsEqual(direct.attributes.position.array, reused.attributes.position.array),
        `${key} shared-graph mesh diverges from generateRockGeometry`,
      );
      assert.equal(direct.attributes.position.count, reused.attributes.position.count);
      direct.dispose();
      reused.dispose();
    }
  });

  it('one graph meshes to fewer verts at lower detail (all four forms)', () => {
    const cases = [
      ['granite', 1],   // boulder — icosahedron detail
      ['basalt', 1],    // columnar — radial segments
      ['slate', 1],     // slate — box segments
      ['crystal', 1],   // crystal — radial sides
    ];
    for (const [key, seed] of cases) {
      const preset = SPECIES[key];
      const { graph } = buildRockStructure(preset, seed);
      const full = meshStructureGraph(graph, { detail: preset.lod.full.detail });
      const reduced = meshStructureGraph(graph, { detail: preset.lod.reduced.detail });
      const impostor = meshStructureGraph(graph, { detail: preset.lod.impostor.detail });

      assert.ok(
        full.attributes.position.count > reduced.attributes.position.count,
        `${key}: full (${full.attributes.position.count}) should exceed reduced (${reduced.attributes.position.count})`,
      );
      assert.ok(
        reduced.attributes.position.count >= impostor.attributes.position.count,
        `${key}: reduced (${reduced.attributes.position.count}) should be ≥ impostor (${impostor.attributes.position.count})`,
      );
      full.dispose();
      reduced.dispose();
      impostor.dispose();
    }
  });

  it('buildRockLOD builds one StructureGraph and three mesh levels', () => {
    const preset = SPECIES.granite;
    const material = new MeshBasicMaterial();
    const lod = buildRockLOD(preset, 99, material, { bakeBillboard: false });

    assert.ok(lod.userData.structureGraph, 'LOD should stash the shared StructureGraph');
    assert.equal(lod.userData.structureGraph.form, 'boulder');
    assert.equal(lod.levels.length, 3, 'full + reduced + impostor mesh levels');

    const counts = lod.levels.map(({ object }) => object.geometry.attributes.position.count);
    assert.ok(counts[0] > counts[1], `LOD0 (${counts[0]}) > LOD1 (${counts[1]})`);
    assert.ok(counts[1] >= counts[2], `LOD1 (${counts[1]}) ≥ LOD2 (${counts[2]})`);

    // Structural forms also share one graph across levels.
    const basaltLod = buildRockLOD(SPECIES.basalt, 5, material, { bakeBillboard: false });
    assert.equal(basaltLod.userData.structureGraph.form, 'columnar');
    assert.equal(basaltLod.userData.structureGraph.columnar.columns.length > 0, true);

    material.dispose();
  });

  it('detail helpers map full detail to legacy resolution', () => {
    assert.equal(columnarRadialSegments(4), 6);
    assert.equal(columnarRadialSegments(3), 6);
    assert.equal(columnarRadialSegments(2), 5);
    assert.equal(columnarRadialSegments(1), 4);

    assert.equal(crystalRadialSides(6, 4), 6);
    assert.equal(crystalRadialSides(4, 4), 4);
    assert.equal(crystalRadialSides(6, 2), 4);
    assert.equal(crystalRadialSides(6, 1), 3);

    assert.equal(slateSegmentsForDetail(6, 4, 4), 6);
    assert.equal(slateSegmentsForDetail(6, 2, 4), 3);
    assert.equal(slateSegmentsForDetail(6, 1, 4), 2);
  });
});
