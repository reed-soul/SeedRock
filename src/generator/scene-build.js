import { Group } from 'three/webgpu';
import { buildRockLOD, buildRockLODAsync, disposeRockLOD } from './lod.js';
import { buildCliff } from './cliff.js';
import { buildScatter, disposeScatter } from './scatter.js';

/**
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 * @param {{ scatterCount?: number, bakeBillboard?: boolean, renderer?: import('three/webgpu').WebGPURenderer, bakeOpts?: object }} opts
 */
export async function buildLivingScene(preset, seed, material, opts = {}) {
  const root = new Group();
  root.name = 'living_scene';

  const cliffMat = material.clone();
  root.add(buildCliff(preset, `${seed}:cliff`, cliffMat));

  const hero = await buildHeroRock(preset, seed, material, opts);
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
  if (root.userData?.hero) disposeHeroRock(root.userData.hero);
  root.traverse((o) => {
    if (o.isMesh && !o.userData?.isBillboardCard) o.geometry?.dispose?.();
  });
  if (root.userData?.scatter) disposeScatter(root.userData.scatter);
  root.userData?.cliffMat?.dispose?.();
  root.clear();
}

/**
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 * @param {{ bakeBillboard?: boolean, renderer?: import('three/webgpu').WebGPURenderer, bakeOpts?: object }} [opts]
 */
export async function buildHeroRock(preset, seed, material, opts = {}) {
  if (opts.bakeBillboard && opts.renderer) {
    const lod = await buildRockLODAsync(opts.renderer, preset, seed, material, opts.bakeOpts);
    lod.name = 'hero_rock';
    return lod;
  }
  const lod = buildRockLOD(preset, seed, material, { bakeBillboard: false });
  lod.name = 'hero_rock';
  return lod;
}

export function disposeHeroRock(lod) {
  disposeRockLOD(lod);
}
