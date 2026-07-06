import {
  Group, InstancedMesh, Matrix4, Quaternion, Euler, Vector3,
} from 'three/webgpu';
import { generateRockGeometry } from './mesh.js';
import { Rng } from '../core/rng.js';

const _pos = new Vector3();
const _scl = new Vector3();
const _quat = new Quaternion();
const _eul = new Euler();
const _mat = new Matrix4();

/**
 * Scatter smaller procedural rocks around the hero — instanced per variant.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {string|number} seed
 * @param {import('three').Material} material
 * @param {{ count?: number, radius?: number, minScale?: number, maxScale?: number }} opts
 */
export function buildScatter(preset, seed, material, opts = {}) {
  const rng = new Rng(`scatter:${preset.id}:${seed}`);
  const count = opts.count ?? 12;
  const radius = opts.radius ?? 6;
  const minScale = opts.minScale ?? 0.15;
  const maxScale = opts.maxScale ?? 0.45;

  const variants = [0, 1, 2].map((vi) => {
    const subSeed = `${seed}:v${vi}`;
    const impDetail = opts.quality === 'low' ? 1 : opts.quality === 'medium' ? 2 : (preset.lod?.impostor?.detail ?? 2);
    const subPreset = {
      ...preset,
      shape: {
        ...preset.shape,
        radius: preset.shape.radius * rng.range(0.85, 1.1),
        detail: Math.max(1, impDetail),
      },
      noise: {
        ...preset.noise,
        amplitude: preset.noise.amplitude * rng.range(0.8, 1.2),
      },
    };
    return generateRockGeometry(subPreset, subSeed);
  }).map((geo) => {
    geo.computeBoundingBox();
    return geo;
  });

  const group = new Group();
  group.name = 'scatter';

  const perVariant = variants.map(() => []);

  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const r = 1.8 + Math.sqrt(rng.next()) * (radius - 1.8);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const s = rng.range(minScale, maxScale) * (i % 4 === 0 ? 1.3 : 1);
    const vi = i % variants.length;
    const baseY = -variants[vi].boundingBox.min.y * s;

    _eul.set(rng.vary(0, 0.25), rng.range(0, Math.PI * 2), rng.vary(0, 0.25));
    _quat.setFromEuler(_eul);
    _pos.set(x, baseY, z);
    _scl.setScalar(s);
    perVariant[i % variants.length].push(_mat.clone().compose(_pos, _quat, _scl));
  }

  perVariant.forEach((matrices, vi) => {
    if (!matrices.length) return;
    const im = new InstancedMesh(variants[vi], material, matrices.length);
    matrices.forEach((m, idx) => im.setMatrixAt(idx, m));
    im.instanceMatrix.needsUpdate = true;
    const avgScale = matrices.reduce((sum, m) => sum + m.elements[0], 0) / matrices.length;
    im.castShadow = avgScale >= 0.28;
    im.receiveShadow = true;
    im.name = `scatter_${vi}`;
    group.add(im);
  });

  group.userData.disposables = variants;
  return group;
}

export function disposeScatter(group) {
  if (!group) return;
  group.traverse((o) => {
    if (o.isInstancedMesh) o.geometry?.dispose?.();
  });
  group.userData.disposables?.forEach((g) => g.dispose());
  group.clear();
}
