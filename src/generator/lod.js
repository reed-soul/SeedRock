import { LOD, Mesh } from 'three/webgpu';
import { generateRockGeometry } from './mesh.js';
import { bakeRockImpostor } from '../core/impostor.js';

const LOD_NAMES = ['LOD0', 'LOD1', 'LOD2', 'LOD3'];

function meshLevel(preset, seed, material, detailKey, distance, lodIndex) {
  const detail = preset.lod?.[detailKey]?.detail ?? preset.shape.detail;
  const levelPreset = { ...preset, shape: { ...preset.shape, detail } };
  const geometry = generateRockGeometry(levelPreset, seed);
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `${preset.id}_${LOD_NAMES[lodIndex]}`;
  mesh.userData.lodLevel = lodIndex;
  mesh.position.y = -geometry.boundingBox.min.y;
  return { mesh, distance };
}

/**
 * Build a THREE.LOD rock with full / reduced / (mesh or billboard) levels.
 */
export function buildRockLOD(preset, seed, material, opts = {}) {
  const lod = new LOD();
  lod.name = `rock_${preset.id}_${seed}`;

  const full = meshLevel(preset, seed, material, 'full', 0, 0);
  const reduced = meshLevel(preset, seed, material, 'reduced', 10, 1);
  lod.addLevel(full.mesh, full.distance);
  lod.addLevel(reduced.mesh, reduced.distance);

  if (!opts.bakeBillboard) {
    const imp = meshLevel(preset, seed, material, 'impostor', 20, 2);
    lod.addLevel(imp.mesh, imp.distance);
  }

  lod.userData.reducedMesh = reduced.mesh;
  return lod;
}

/**
 * Async LOD build — adds baked billboard impostor as LOD3.
 * @param {import('three/webgpu').WebGPURenderer} renderer
 * @param {import('../core/bake-service.js').BakeService} [bakeService]
 */
export async function buildRockLODAsync(renderer, preset, seed, material, opts = {}) {
  const lod = buildRockLOD(preset, seed, material, { bakeBillboard: true });
  const source = lod.userData.reducedMesh;

  const bakeSource = new Mesh(source.geometry.clone(), material);
  bakeSource.position.copy(source.position);
  bakeSource.castShadow = source.castShadow;
  bakeSource.receiveShadow = source.receiveShadow;

  const bakeName = `${preset.id}_${seed}`;
  let billboard = null;

  if (opts.bakeService?.available && opts.maps) {
    billboard = await opts.bakeService.bakeRock(bakeSource, opts.maps, preset, {
      size: opts.bakeSize ?? 512,
      name: bakeName,
    });
  }

  if (!billboard) {
    billboard = await bakeRockImpostor(renderer, bakeSource, {
      name: bakeName,
      size: opts.bakeSize ?? 512,
      onProgress: opts.onProgress,
      yield: opts.yield,
    });
  }

  bakeSource.geometry.dispose();
  billboard.position.y = source.position.y;
  billboard.name = `${bakeName}_LOD3`;
  lod.addLevel(billboard, 22);
  lod.userData.billboard = billboard;
  return lod;
}

export function disposeRockLOD(lod) {
  if (!lod?.isLOD) return;
  for (const { object } of lod.levels) {
    if (object.userData?.isBillboard) {
      object.traverse((o) => {
        if (o.userData?.isBillboardCard) {
          o.material?.map?.dispose?.();
          o.material?.roughnessMap?.dispose?.();
          o.material?.dispose?.();
          o.geometry?.dispose?.();
        }
      });
    } else {
      object.traverse?.((o) => o.geometry?.dispose?.());
      object.geometry?.dispose?.();
    }
  }
  lod.clear();
}
