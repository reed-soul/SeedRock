import {
  Mesh, Group,
} from 'three/webgpu';
import { buildRockLOD } from './lod.js';
import { buildCliff } from './cliff.js';
import { buildScatter, disposeScatter } from './scatter.js';

/**
 * Assemble a living scene: cliff backdrop + hero LOD rock + scatter boulders.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 * @param {{ scatterCount?: number }} opts
 */
export function buildLivingScene(preset, seed, material, opts = {}) {
  const root = new Group();
  root.name = 'living_scene';

  const cliffMat = material.clone();
  root.add(buildCliff(preset, `${seed}:cliff`, cliffMat));

  const hero = buildRockLOD(preset, seed, material);
  hero.position.set(0, 0, 1.2);
  root.add(hero);

  const scatter = buildScatter(preset, `${seed}:scatter`, material, {
    count: opts.scatterCount ?? 14,
  });
  root.add(scatter);

  root.userData.hero = hero;
  root.userData.scatter = scatter;
  root.userData.cliffMat = cliffMat;
  return root;
}

export function disposeLivingScene(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.isMesh && o !== root.userData?.hero) {
      o.geometry?.dispose?.();
    }
    if (o.isLOD) {
      o.levels.forEach((lvl) => lvl.object.geometry?.dispose?.());
    }
  });
  if (root.userData?.scatter) disposeScatter(root.userData.scatter);
  root.userData?.cliffMat?.dispose?.();
  root.userData?.hero?.levels?.forEach((lvl) => lvl.object.geometry?.dispose?.());
  root.clear();
}

/**
 * Single hero rock with LOD.
 */
export function buildHeroRock(preset, seed, material) {
  const lod = buildRockLOD(preset, seed, material);
  lod.name = 'hero_rock';
  return lod;
}

export function disposeHeroRock(lod) {
  if (!lod?.isLOD) return;
  lod.levels.forEach((lvl) => lvl.object.geometry?.dispose?.());
  lod.clear();
}
