// Capture pre-refactor geometry baselines for the four form factories.
// Run once BEFORE the StructureGraph refactor; the output JSON in tests/golden/
// becomes the byte-for-byte regression gate (8-decimal position comparison).
//
// Each baseline captures the EXACT call sequence mesh.js uses today:
//   boulder  → buildBoulder() then displaceRadial() (separate steps, like mesh.js)
//   columnar → buildColumnar()
//   slate    → buildSlate()
//   crystal  → buildCrystal()
//
// Usage: node scripts/capture-baseline.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeNoise3D } from '../src/core/noise.js';
import { Rng } from '../src/core/rng.js';
import { SPECIES } from '../src/species/index.js';
import { buildBoulder, displaceRadial } from '../src/generator/forms/boulder.js';
import { buildColumnar } from '../src/generator/forms/columnar.js';
import { buildSlate } from '../src/generator/forms/slate.js';
import { buildCrystal } from '../src/generator/forms/crystal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(__dirname, '..', 'tests', 'golden');
mkdirSync(goldenDir, { recursive: true });

// Fixed (species, seed) pairs — one per form. These are the regression-gate
// cases; tests/structure.test.js loads the same JSON files.
const CASES = [
  { form: 'boulder', species: 'granite', seed: 1 },
  { form: 'columnar', species: 'basalt', seed: 1 },
  { form: 'slate', species: 'slate', seed: 1 },
  { form: 'crystal', species: 'crystal', seed: 1 },
];

function snapshot(geo) {
  const pos = geo.attributes.position.array;
  // Round to 8 decimals to avoid float noise; that's the comparison precision.
  const rounded = Array.from(pos, (v) => Math.round(v * 1e8) / 1e8);
  return {
    vertexCount: pos.length / 3,
    position: rounded,
  };
}

function buildForm(caseSpec) {
  const preset = SPECIES[caseSpec.species];
  const rng = new Rng(`${preset.id}:${caseSpec.seed}`);
  // mesh.js seeds noise from rng.int(1, 1_000_000) AFTER creating the rng — mirror
  // that EXACT order so boulder's noise matches.
  const noise = makeNoise3D(rng.int(1, 1_000_000));

  if (caseSpec.form === 'boulder') {
    const { geo, origin } = buildBoulder(preset.shape, preset.noise, noise, rng);
    displaceRadial(
      geo, origin, preset.noise, noise,
      preset.shape.stretch ?? [1, 1, 1], preset.shape.squash,
    );
    return geo;
  }
  if (caseSpec.form === 'columnar') return buildColumnar(preset.shape, noise, rng).geo;
  if (caseSpec.form === 'slate')    return buildSlate(preset.shape, rng).geo;
  if (caseSpec.form === 'crystal') {
    // Golden baseline is the legacy angular fan. Crystal species now default
    // to Worley nucleation — force fan here so re-capture stays comparable.
    return buildCrystal({ ...preset.shape, nucleation: 'fan' }, rng).geo;
  }
  throw new Error(`unknown form ${caseSpec.form}`);
}

const manifest = {};
for (const c of CASES) {
  const geo = buildForm(c);
  const snap = snapshot(geo);
  const fname = `${c.form}.baseline.json`;
  writeFileSync(join(goldenDir, fname), JSON.stringify(snap, null, 2));
  manifest[c.form] = { species: c.species, seed: c.seed, vertexCount: snap.vertexCount };
  console.log(`  ${c.form.padEnd(9)} ${snap.vertexCount} verts → ${fname}`);
}

console.log('\nBaseline captured. tests/structure.test.js will load these as the');
console.log('byte-for-byte regression gate for the StructureGraph refactor.');
