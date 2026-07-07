// `seedrock-preset/1` — the shareable JSON format for a tuned rock.
//
// A preset captures the full editable state needed to reproduce a rock: which
// species, which seed, the shared shape/erosion/overlay/style fields, and the
// per-species semantic-knob values (the `params` sub-object from
// `controlsFromSpecies`). It is the on-disk twin of the URL query string:
// the URL carries a few headline fields for shareable links; the preset JSON
// carries the whole thing for Save/Load and Headless-API round-trips.
//
// Format:
//   {
//     format: 'seedrock-preset/1',
//     species: 'granite',           // SPECIES registry key
//     seed: 42,
//     shape: { radius, detail, squash, amplitude },
//     erosion: { thermal, hydraulic, edgeWear },   // booleans
//     overlay: { moss, snow, useMossTexture, useSnowTexture },
//     style: 'pbr' | 'lowpoly' | 'toon',
//     params: { blockiness: 0.8, grainRoughness: 0.035, ... }  // per-species knobs
//   }
//
// Round-trip contract:
//   toPreset(state) → JSON → fromPreset(json) → state'
//   state' applied through applySpeciesControls produces the same rock as state.

import { SPECIES, DEFAULT_SPECIES } from './index.js';
import { controlsFromSpecies, mergeControls } from './controls.js';

export const PRESET_FORMAT = 'seedrock-preset/1';

/**
 * Serialize viewer state (or a partial controls object) to a `seedrock-preset/1`
 * JSON-ready object. `speciesKey` is read from `state.speciesKey` if present.
 *
 * @param {object} state  viewer state (or controls object) with optional speciesKey
 * @param {string} [speciesKey]  override species key (used by Headless API)
 * @returns {{ format: string, species: string, seed: number, shape: object, erosion: object, overlay: object, style: string, params: object }}
 */
export function toPreset(state, speciesKey) {
  const species = speciesKey ?? state.speciesKey;
  if (!species || !SPECIES[species]) {
    throw new Error(`[seedrock] toPreset: unknown species "${species}"`);
  }
  return {
    format: PRESET_FORMAT,
    species,
    seed: state.seed ?? 1,
    shape: { ...state.shape },
    erosion: { ...state.erosion },
    overlay: { ...state.overlay },
    style: state.style ?? 'pbr',
    params: { ...(state.params ?? {}) },
  };
}

/**
 * Parse a `seedrock-preset/1` JSON object back into a controls object, merged
 * over the species' defaults so a preset from an older version still fills gaps.
 *
 * @param {object} json
 * @returns {{ speciesKey: string, seed: number, shape: object, erosion: object, overlay: object, style: string, params: object }}
 */
export function fromPreset(json) {
  if (!json || json.format !== PRESET_FORMAT) {
    throw new Error(`[seedrock] fromPreset: expected format "${PRESET_FORMAT}", got "${json?.format}"`);
  }
  const species = json.species;
  if (!species || !SPECIES[species]) {
    throw new Error(`[seedrock] fromPreset: unknown species "${species}"`);
  }
  // Start from the species defaults, then overlay the preset fields. `mergeControls`
  // deep-merges shape/erosion/overlay/params so a partial preset still works.
  const base = controlsFromSpecies(SPECIES[species]);
  const merged = mergeControls(base, {
    shape: json.shape,
    erosion: json.erosion,
    overlay: json.overlay,
    params: json.params,
    style: json.style,
  });
  return {
    speciesKey: species,
    seed: json.seed ?? base.seed,
    shape: merged.shape,
    erosion: merged.erosion,
    overlay: merged.overlay,
    style: merged.style,
    params: merged.params,
  };
}

/**
 * Convenience: build a preset object directly from (species, seed, partial controls)
 * — the Headless API's `generate({ species, seed, controls })` uses this.
 *
 * @param {string} speciesKey
 * @param {number} [seed=1]
 * @param {object} [controlsOverride]  partial controls merged over the species defaults
 */
export function buildPreset(speciesKey = DEFAULT_SPECIES, seed = 1, controlsOverride = {}) {
  const preset = SPECIES[speciesKey] ?? SPECIES[DEFAULT_SPECIES];
  const base = controlsFromSpecies(preset);
  const merged = mergeControls(base, { ...controlsOverride, seed });
  return toPreset({ ...merged, speciesKey }, speciesKey);
}
