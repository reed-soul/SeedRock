// Off-main-thread rock impostor baker — own WebGPU queue via OffscreenCanvas.

import {
  WebGPURenderer, BufferGeometry, BufferAttribute, Mesh, Group, Vector3, Box3,
  OrthographicCamera, MeshStandardMaterial, Texture, SRGBColorSpace, RepeatWrapping,
} from 'three/webgpu';
import { bakeGroupToTextures } from './impostor.js';

let renderer = null;

function bitmapsToTextures(bitmaps) {
  const out = {};
  for (const [k, d] of Object.entries(bitmaps || {})) {
    const t = new Texture(d.bitmap);
    t.colorSpace = d.colorSpace === 'srgb' ? SRGBColorSpace : 'srgb-linear';
    t.wrapS = t.wrapT = RepeatWrapping;
    t.needsUpdate = true;
    out[k] = t;
  }
  return out;
}

function reconstructMesh(payload) {
  const geo = new BufferGeometry();
  for (const [name, a] of Object.entries(payload.attrs)) {
    geo.setAttribute(name, new BufferAttribute(new a.array.constructor(a.array), a.itemSize));
  }
  if (payload.index) {
    geo.setIndex(new BufferAttribute(new payload.index.array.constructor(payload.index.array), 1));
  }

  const maps = bitmapsToTextures(payload.bitmaps);
  const mat = new MeshStandardMaterial({
    color: payload.material.color,
    roughness: payload.material.roughness,
    metalness: payload.material.metalness,
    map: maps.albedo ?? null,
    normalMap: maps.normal ?? null,
    roughnessMap: maps.roughness ?? null,
  });

  const mesh = new Mesh(geo, mat);
  mesh.position.set(payload.position[0], payload.position[1], payload.position[2]);
  mesh.frustumCulled = false;
  return { mesh, maps };
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  try {
    if (msg.type === 'init') {
      renderer = new WebGPURenderer({ canvas: msg.canvas, antialias: false });
      await renderer.init();
      self.postMessage({
        type: 'ready',
        backend: renderer.backend?.isWebGPUBackend ? 'webgpu' : 'other',
      });
      return;
    }

    if (msg.type === 'bake') {
      if (!renderer) throw new Error('renderer not initialised');

      const { mesh, maps } = reconstructMesh(msg.payload);
      const group = new Group();
      group.add(mesh);

      const box = new Box3().setFromObject(group);
      const center = box.getCenter(new Vector3());
      const sz = box.getSize(new Vector3());
      const halfW = (Math.max(sz.x, sz.z) / 2) * 1.05;
      const halfH = (sz.y / 2) * 1.05;
      const depth = Math.max(sz.x, sz.z, sz.y) + 4;

      const views = [];
      for (const [name, dir] of [['front', new Vector3(0, 0, 1)], ['side', new Vector3(1, 0, 0)]]) {
        const cam = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, depth * 2);
        cam.position.copy(center).addScaledVector(dir, depth);
        cam.lookAt(center);
        views.push({ name, camera: cam });
      }

      const baked = await bakeGroupToTextures(renderer, group, views, {
        size: msg.size ?? 512,
        dilate: 8,
        rawPixels: true,
      });

      const transfers = [];
      for (const v of ['front', 'side']) {
        for (const ch of ['albedo', 'normal', 'rough']) {
          transfers.push(baked[v][ch].data.buffer);
        }
      }

      self.postMessage({
        type: 'baked',
        id: msg.id,
        baked,
        center: [center.x, center.y, center.z],
        halfW,
        halfH,
        name: msg.name,
      }, transfers);

      mesh.geometry.dispose();
      matDispose(mesh.material);
      for (const t of Object.values(maps)) t.dispose?.();
      return;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      where: msg.type,
      message: String(err?.stack || err).slice(0, 600),
    });
  }
};

function matDispose(mat) {
  mat.map?.dispose?.();
  mat.normalMap?.dispose?.();
  mat.roughnessMap?.dispose?.();
  mat.dispose?.();
}
