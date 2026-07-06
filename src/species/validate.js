/** @typedef {import('./granite.js').RockPreset} RockPreset */

const REQUIRED = ['id', 'name', 'color', 'roughness', 'shape', 'noise', 'erosion', 'lod'];

/**
 * Validate a rock species preset. Throws on invalid structure.
 * @param {RockPreset} preset
 * @param {string} [registryKey]
 */
export function validateSpecies(preset, registryKey) {
  if (!preset || typeof preset !== 'object') {
    throw new Error('preset must be an object');
  }

  for (const key of REQUIRED) {
    if (preset[key] === undefined) {
      throw new Error(`missing required field: ${key}`);
    }
  }

  if (registryKey && preset.id !== registryKey) {
    throw new Error(`id "${preset.id}" does not match registry key "${registryKey}"`);
  }

  if (preset.shape.detail < 1 || preset.shape.detail > 6) {
    throw new Error(`shape.detail out of range: ${preset.shape.detail}`);
  }

  if (preset.noise.octaves < 1 || preset.noise.amplitude <= 0) {
    throw new Error('invalid noise parameters');
  }

  for (const level of ['full', 'reduced', 'impostor']) {
    if (!preset.lod[level]?.detail) {
      throw new Error(`lod.${level}.detail required`);
    }
  }

  return true;
}

/**
 * @param {Record<string, RockPreset>} species
 */
export function validateAllSpecies(species) {
  const errors = [];
  for (const [key, preset] of Object.entries(species)) {
    try {
      validateSpecies(preset, key);
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
    }
  }
  if (errors.length) {
    throw new Error(`Species validation failed:\n${errors.join('\n')}`);
  }
  return Object.keys(species).length;
}
