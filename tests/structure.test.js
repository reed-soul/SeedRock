import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeNoise3D } from '../src/core/noise.js';
import { Rng } from '../src/core/rng.js';
import { SPECIES } from '../src/species/index.js';
import { buildStructureGraph, meshStructureGraph } from '../src/generator/structure/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(__dirname, 'golden');

// Load a pre-refactor baseline (captured by scripts/capture-baseline.mjs).
function loadBaseline(form) {
  return JSON.parse(readFileSync(join(goldenDir, `${form}.baseline.json`), 'utf8'));
}

// Build the meshed geometry via the NEW graph path, mirroring mesh.js's call
// order exactly: rng from (species:seed), then noise seeded from rng.int().
function buildViaGraph(speciesKey, seed) {
  const preset = SPECIES[speciesKey];
  const rng = new Rng(`${preset.id}:${seed}`);
  const noise = makeNoise3D(rng.int(1, 1_000_000));
  const graph = buildStructureGraph(preset, rng, noise);
  return meshStructureGraph(graph, { detail: preset.shape.detail });
}

// 8-decimal comparison — the precision baseline JSON was rounded to.
function positionsEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < actual.length; i++) {
    const a = Math.round(actual[i] * 1e8) / 1e8;
    if (a !== expected[i]) return false;
  }
  return true;
}

describe('StructureGraph byte-for-byte regression vs pre-refactor baseline', () => {
  // (form, speciesKey, seed) — must match scripts/capture-baseline.mjs CASES.
  const cases = [
    ['boulder', 'granite', 1],
    ['columnar', 'basalt', 1],
    ['slate', 'slate', 1],
    ['crystal', 'crystal', 1],
  ];

  for (const [form, species, seed] of cases) {
    it(`${form} matches baseline vertex-for-vertex (8 decimals)`, () => {
      const baseline = loadBaseline(form);
      const geo = buildViaGraph(species, seed);
      const actual = geo.attributes.position.array;
      assert.equal(
        actual.length / 3, baseline.vertexCount,
        `${form} vertex count changed (got ${actual.length / 3}, baseline ${baseline.vertexCount})`,
      );
      assert.ok(
        positionsEqual(actual, baseline.position),
        `${form} position array diverges from baseline at 8-decimal precision`,
      );
    });
  }
});
