import { LOD, Mesh } from 'three/webgpu';
import { generateRockGeometry } from './mesh.js';

/**
 * Build a THREE.LOD rock with full / reduced / impostor detail levels.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 * @returns {import('three').LOD}
 */
export function buildRockLOD(preset, seed, material) {
  const lod = new LOD();
  lod.name = `rock_${preset.id}_${seed}`;

  const levels = [
    { key: 'full', distance: 0 },
    { key: 'reduced', distance: 8 },
    { key: 'impostor', distance: 18 },
  ];

  for (const { key, distance } of levels) {
    const detail = preset.lod?.[key]?.detail ?? preset.shape.detail;
    const levelPreset = {
      ...preset,
      shape: { ...preset.shape, detail },
    };
    const geometry = generateRockGeometry(levelPreset, seed);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `${preset.id}_LOD_${key}`;
    mesh.position.y = -geometry.boundingBox.min.y;
    lod.addLevel(mesh, distance);
  }

  return lod;
}
