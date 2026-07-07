// SeedRock Headless API — design and grow rocks programmatically, with no dev
// server, no browser, and no GPU. This is a thin ADAPTER over the exact same
// generation code the app runs: it imports the real species presets, the real
// control→preset bridge (species/controls.js), and the real
// generateRockGeometry, so a rock grown here is identical to one grown in the UI.
//
// Runtime-agnostic: runs under Node and Deno unchanged, because SeedRock and any
// scene integrator share the same stack (three/webgpu BufferGeometry, which is
// pure data — no rendering happens here). Nothing in the app is modified; the
// Vite bundle never imports this file.
//
// Two tiers of use:
//   • GEOMETRY (no GPU): generate() → a real three BufferGeometry of the rock.
//     Runs anywhere. Great for agents that want to design shapes, read stats,
//     and round-trip presets.
//   • TEXTURED: not in this module — materials need a live renderer. Use the
//     app's makeRockMaterial in a scene context for that. The Headless path
//     focuses on geometry, stats, and preset round-tripping.
//
// The design/introspection surface (listSpecies, getSchema, describe) is what an
// agent uses to know which species exist and which knobs each exposes.

import { SPECIES, DEFAULT_SPECIES, SPECIES_LIST } from '../species/index.js';
import {
  controlsFromSpecies, applySpeciesControls, mergeControls,
} from '../species/controls.js';
import { toPreset, fromPreset, buildPreset } from '../species/preset.js';
import { generateRockGeometry } from '../generator/mesh.js';
import { Box3, Vector3 } from 'three/webgpu';

export { SPECIES, DEFAULT_SPECIES };
export { toPreset, fromPreset, buildPreset };

// ---- introspection --------------------------------------------------------

/** One-line descriptor per species — the menu an agent picks from. */
export function listSpecies() {
  return SPECIES_LIST.map((sp) => ({
    key: sp.id,
    name: sp.name,
    latin: sp.latin ?? null,
    biome: sp.biome ?? null,
    form: sp.shape?.form ?? 'boulder',
    material: sp.material ?? 'standard',
  }));
}

/**
 * The full knob vocabulary for a species: exactly what the UI exposes, as data.
 * Mirrors SeedThree's getSchema — each entry of the species' controls[] becomes
 * a knob with its declared range/default.
 * @param {string} speciesKey
 */
export function getSchema(speciesKey) {
  const sp = SPECIES[speciesKey];
  if (!sp) throw new Error(`[seedrock] unknown species "${speciesKey}"`);
  const knobs = (sp.controls ?? []).map((d) => ({
    key: d.key,
    name: d.name,
    group: d.group ?? 'shape',
    min: d.min,
    max: d.max,
    step: d.step,
    default: d.get(sp),
  }));
  return {
    species: speciesKey,
    name: sp.name,
    latin: sp.latin ?? null,
    biome: sp.biome ?? null,
    form: sp.shape?.form ?? 'boulder',
    knobs,
    // Shared (non-species) controls the generator also reads.
    shared: [
      { key: 'seed', name: 'Seed', min: 1, max: 999999, step: 1, default: 1 },
      { key: 'style', name: 'Style', options: ['pbr', 'lowpoly', 'toon'], default: 'pbr' },
    ],
  };
}

/** Default controls for a species (identical to a fresh UI load). */
export function defaultControls(speciesKey) {
  const sp = SPECIES[speciesKey];
  if (!sp) throw new Error(`[seedrock] unknown species "${speciesKey}"`);
  return controlsFromSpecies(sp);
}

// ---- describe(): the agent-facing TEXT menu -------------------------------
// Progressive disclosure, mirroring the app's collapsed panel: the first hit is
// species + SEED (the seed alone gives endless distinct rocks — it's the main
// dial), and the granular knobs stay behind the species' own describe.

const fmtKnob = (k) => `  ${k.key} — ${k.name}; ${k.min}..${k.max} step ${k.step} (default ${k.default})`;

/**
 * Text menu for agents. Call with no args for the species list; with a species
 * key for its quick-start + knob index.
 * @param {string|null} [speciesKey]
 */
export function describe(speciesKey = null) {
  if (!speciesKey) {
    const rows = listSpecies().map(
      (s) => `  ${s.key.padEnd(14)} ${s.name}${s.latin ? ` (${s.latin})` : ''} — ${s.biome}, ${s.form} form`,
    );
    return [
      'SeedRock species — pick one, then design by SEED first:',
      ...rows,
      '',
      "Quick start:  generate({ species: 'granite', seed: 1..999999 })",
      'Every seed is a different individual of the species — iterating the seed',
      'is usually all a scene needs. Fine dials exist per species:',
      "  describe('<species>')  → that species' knobs",
    ].join('\n');
  }
  const schema = getSchema(speciesKey);
  return [
    `${schema.name}${schema.latin ? ` (${schema.latin})` : ''} — ${schema.biome}, ${schema.form} form.`,
    '',
    `Quick start:  generate({ species: '${speciesKey}', seed: 1..999999 })`,
    'The SEED is the main dial — each one is a different rock. Read the',
    'returned stats (verts, bbox) and re-roll or resize before reaching',
    'for fine dials.',
    '',
    `Knobs (${schema.knobs.length}):`,
    ...schema.knobs.map(fmtKnob),
    'Shared:',
    ...schema.shared.map(fmtKnob),
  ].join('\n');
}

// ---- stats ----------------------------------------------------------------

const geoTris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/**
 * Geometry stats for a BufferGeometry or any object containing geometries.
 * @param {import('three').BufferGeometry|import('three').Object3D} input
 */
export function statsOf(input) {
  // BufferGeometry path (the common Headless case).
  if (input?.attributes?.position && typeof input.computeBoundingBox === 'function') {
    input.computeBoundingBox();
    input.computeBoundingSphere();
    const b = input.boundingBox;
    const s = new Vector3();
    b.getSize(s);
    return {
      triangles: Math.round(geoTris(input)),
      verts: input.attributes.position.count,
      sizeMeters: {
        width: +s.x.toFixed(3),
        height: +s.y.toFixed(3),
        depth: +s.z.toFixed(3),
      },
      boundingBox: { min: b.min.toArray(), max: b.max.toArray() },
    };
  }
  // Object3D path — sum across meshes.
  let triangles = 0, verts = 0, meshes = 0;
  input?.traverse?.((o) => {
    if (!o.geometry) return;
    meshes++;
    triangles += geoTris(o.geometry);
    verts += o.geometry.attributes.position.count;
  });
  let size = null, box = null;
  try {
    const b = new Box3().setFromObject(input);
    if (isFinite(b.min.x) && isFinite(b.max.x)) {
      const s = new Vector3();
      b.getSize(s);
      size = { width: +s.x.toFixed(3), height: +s.y.toFixed(3), depth: +s.z.toFixed(3) };
      box = { min: b.min.toArray(), max: b.max.toArray() };
    }
  } catch { /* best-effort */ }
  return { meshes, triangles: Math.round(triangles), verts, sizeMeters: size, boundingBox: box };
}

// ---- skeleton (cheap preview, no erosion) ---------------------------------

/**
 * Cheap skeleton stats: builds the rock but SKIPS erosion (the expensive pass)
 * for a fast first look. Same RNG contract as generate() so counts are stable.
 * @param {{ species: string, seed?: number, controls?: object }} o
 */
export function skeleton({ species, seed = 1, controls = {} } = {}) {
  const sp = SPECIES[species];
  if (!sp) throw new Error(`[seedrock] unknown species "${species}"`);
  const base = controlsFromSpecies(sp);
  const merged = mergeControls(base, { ...controls, seed });
  const shaped = applySpeciesControls(sp, merged);
  // Build WITHOUT erosion by disabling all three passes — still gets the form +
  // displacement. Cheaper than full generate() when you just want form/size.
  const noErosion = {
    ...shaped,
    erosion: {
      thermal: { enabled: false },
      hydraulic: { enabled: false },
      edgeWear: { enabled: false },
    },
  };
  const geo = generateRockGeometry(noErosion, seed, { style: shaped.style ?? 'pbr' });
  return { ...statsOf(geo), eroded: false };
}

// ---- generate (geometry, no GPU) -----------------------------------------

/**
 * Grow a rock from a design — real geometry at the given style, no GPU.
 *
 * @param {object} o
 * @param {string} o.species   species key (see listSpecies)
 * @param {number} [o.seed=1]
 * @param {object} [o.controls]  partial controls override (see getSchema).
 *        May include `params: { knobKey: value }` for per-species semantic knobs,
 *        and `shape`/`erosion`/`overlay`/`style` for the shared fields.
 * @param {'pbr'|'lowpoly'|'toon'} [o.style='pbr']  convenience: o.style is merged into controls
 * @returns {{ geometry: import('three').BufferGeometry, stats: object, preset: object, shaped: object }}
 */
export function generate({ species, seed = 1, controls = {}, style = 'pbr' } = {}) {
  const sp = SPECIES[species];
  if (!sp) throw new Error(`[seedrock] unknown species "${species}"`);
  const base = controlsFromSpecies(sp);
  const override = { ...controls, seed, style: controls.style ?? style };
  const merged = mergeControls(base, override);
  const shaped = applySpeciesControls(sp, merged);
  const geometry = generateRockGeometry(shaped, seed, { style: override.style });
  return {
    geometry,
    stats: statsOf(geometry),
    preset: toPreset({ ...merged, speciesKey: species }, species),
    shaped,
  };
}
