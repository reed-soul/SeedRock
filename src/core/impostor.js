// Rock impostor bake — crossed billboard cards for far LOD (adapted from SeedThree).
// Bakes albedo / world-normal / roughness from orthographic front + side views.

import {
  Scene, OrthographicCamera, RenderTarget, HemisphereLight, Box3, Vector3, Color,
  CanvasTexture, MeshBasicNodeMaterial, PlaneGeometry, Mesh, Group, DoubleSide,
  MeshStandardNodeMaterial, SRGBColorSpace, NoColorSpace,
} from 'three/webgpu';
import { texture, float, vec3, vec4, normalWorld, normalView, cameraViewMatrix, normalize } from 'three/tsl';

const linToSrgb = (u) => {
  const c = u / 255;
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
};

function dilate(data, w, h, passes) {
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = data[i * 4 + 3] > 8 ? 1 : 0;
  for (let p = 0; p < passes; p++) {
    const next = filled.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (filled[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        if (x > 0 && filled[i - 1]) { const k = (i - 1) * 4; r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        if (x < w - 1 && filled[i + 1]) { const k = (i + 1) * 4; r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        if (y > 0 && filled[i - w]) { const k = (i - w) * 4; r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        if (y < h - 1 && filled[i + w]) { const k = (i + w) * 4; r += data[k]; g += data[k + 1]; b += data[k + 2]; n++; }
        if (n) {
          const k = i * 4;
          data[k] = r / n; data[k + 1] = g / n; data[k + 2] = b / n;
          next[i] = 1;
        }
      }
    }
    filled.set(next);
  }
}

function flipRows(data, w, h) {
  const row = new Uint8Array(w * 4);
  for (let y = 0; y < h >> 1; y++) {
    const a = y * w * 4, b = (h - 1 - y) * w * 4;
    row.set(data.subarray(a, a + w * 4));
    data.copyWithin(a, b, b + w * 4);
    data.set(row, b);
  }
}

let readbackFlipped = null;

async function probeReadbackRowOrder(renderer) {
  if (readbackFlipped !== null) return readbackFlipped;
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 1), new MeshBasicNodeMaterial({ colorNode: vec3(1, 1, 1) }));
  quad.position.y = 0.5;
  scene.add(quad);
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  cam.position.z = 2;
  const prevRT = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  const rt = new RenderTarget(8, 8);
  renderer.setRenderTarget(rt);
  await renderer.renderAsync(scene, cam);
  const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, 8, 8);
  renderer.setRenderTarget(prevRT);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  quad.geometry.dispose();
  quad.material.dispose();
  readbackFlipped = px[3] < 128;
  return readbackFlipped;
}

function pixelsToTexture(pixels, size, dilatePasses, srgb, flip) {
  const data = processPixels(pixels, size, dilatePasses, srgb, flip);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** DOM-free pixel post-process — usable in workers. */
export function processPixels(pixels, size, dilatePasses, srgb, flip) {
  const data = new Uint8ClampedArray(pixels);
  if (srgb) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = linToSrgb(data[i]);
      data[i + 1] = linToSrgb(data[i + 1]);
      data[i + 2] = linToSrgb(data[i + 2]);
    }
  }
  if (flip) flipRows(data, size, size);
  dilate(data, size, size, dilatePasses);
  return data;
}

export function textureFromProcessedPixels(data, size, srgb) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function captureMaterial(srcMesh, channel) {
  const src = srcMesh.material;
  const m = new MeshBasicNodeMaterial();
  m.side = DoubleSide;
  if (src.alphaTest) m.alphaTest = src.alphaTest;
  const alpha = float(1);
  if (channel === 'normal') {
    m.colorNode = vec4(normalWorld.mul(0.5).add(0.5), alpha);
  } else if (channel === 'rough') {
    const r = src.roughnessMap ? texture(src.roughnessMap).g : float(src.roughness ?? 1);
    m.colorNode = vec4(vec3(r), alpha);
  }
  return m;
}

function makeCardMaterial(maps) {
  const mat = new MeshStandardNodeMaterial({
    map: maps.albedo,
    roughnessMap: maps.rough,
    alphaTest: 0.12,
    side: DoubleSide,
    roughness: 1,
    metalness: 0,
  });
  if (maps.normal) {
    const detail = texture(maps.normal).xyz.mul(2).sub(1);
    const dView = cameraViewMatrix.mul(vec4(detail, 0)).xyz;
    mat.normalNode = normalize(normalView.add(dView.mul(0.55)));
  }
  return mat;
}

export async function bakeGroupToTextures(renderer, sourceRoot, views, opts = {}) {
  const size = opts.size ?? 512;
  const flip = await probeReadbackRowOrder(renderer);
  const scene = new Scene();
  scene.add(sourceRoot);
  scene.add(new HemisphereLight(0xffffff, 0x888888, 2.8));

  const meshes = [];
  sourceRoot.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const original = new Map(meshes.map((m) => [m, m.material]));
  const captures = {
    normal: new Map(meshes.map((m) => [m, captureMaterial(m, 'normal')])),
    rough: new Map(meshes.map((m) => [m, captureMaterial(m, 'rough')])),
  };

  const setChannel = (ch) => {
    for (const m of meshes) {
      m.material = ch === 'albedo' ? original.get(m) : captures[ch].get(m);
    }
  };

  const prevRT = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  const rt = new RenderTarget(size, size);
  const out = {};

  try {
    for (const view of views) {
      const channels = {};
      for (const ch of ['albedo', 'normal', 'rough']) {
        setChannel(ch);
        renderer.setRenderTarget(rt);
        await renderer.renderAsync(scene, view.camera);
        const pixels = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, size, size);
        channels[ch] = opts.rawPixels
          ? { data: processPixels(pixels, size, opts.dilate ?? 8, ch === 'albedo', flip), size, srgb: ch === 'albedo' }
          : pixelsToTexture(pixels, size, opts.dilate ?? 8, ch === 'albedo', flip);
        opts.onProgress?.();
        if (opts.yield) await opts.yield();
      }
      out[view.name] = channels;
    }
  } finally {
    setChannel('albedo');
    for (const ch of Object.values(captures)) {
      for (const m of ch.values()) m.dispose();
    }
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevColor, prevAlpha);
    rt.dispose();
    scene.remove(sourceRoot);
  }
  return out;
}

/**
 * Bake crossed billboard impostor cards from a rock mesh.
 * @param {import('three/webgpu').WebGPURenderer} renderer
 * @param {import('three').Mesh} sourceMesh
 * @param {object} [opts]
 */
export async function bakeRockImpostor(renderer, sourceMesh, opts = {}) {
  const size = opts.size ?? 512;
  const clone = sourceMesh.clone();
  clone.visible = true;
  clone.position.set(0, 0, 0);
  clone.updateMatrixWorld(true);

  const box = new Box3().setFromObject(clone);
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

  const baked = await bakeGroupToTextures(renderer, clone, views, {
    size,
    dilate: opts.dilate ?? 8,
    onProgress: opts.onProgress,
    yield: opts.yield,
  });

  const group = new Group();
  group.name = `${opts.name ?? 'rock'}_LOD3`;
  group.userData.isBillboard = true;
  group.userData.lodLevel = 3;
  const cardGeo = new PlaneGeometry(halfW * 2, halfH * 2);

  for (const [idx, key] of [[0, 'front'], [1, 'side']]) {
    const card = new Mesh(cardGeo, makeCardMaterial(baked[key]));
    card.name = `billboard_${key}`;
    card.position.copy(center);
    if (idx === 1) card.rotation.y = -Math.PI / 2;
    card.castShadow = true;
    card.receiveShadow = false;
    card.userData.isBillboardCard = true;
    group.add(card);
  }

  clone.geometry?.dispose?.();
  return group;
}

/** Assemble billboard from worker raw pixel payload. */
export function assembleBillboardFromRawBake(res, opts = {}) {
  const center = new Vector3(res.center[0], res.center[1], res.center[2]);
  const { halfW, halfH } = res;
  const viewTex = {};

  for (const v of ['front', 'side']) {
    viewTex[v] = {};
    for (const ch of ['albedo', 'normal', 'rough']) {
      const { data, size, srgb } = res.baked[v][ch];
      viewTex[v][ch] = textureFromProcessedPixels(new Uint8ClampedArray(data), size, srgb);
    }
  }

  const group = new Group();
  group.name = `${opts.name ?? res.name ?? 'rock'}_LOD3`;
  group.userData.isBillboard = true;
  group.userData.lodLevel = 3;
  const cardGeo = new PlaneGeometry(halfW * 2, halfH * 2);

  for (const [idx, key] of [[0, 'front'], [1, 'side']]) {
    const card = new Mesh(cardGeo, makeCardMaterial(viewTex[key]));
    card.name = `billboard_${key}`;
    card.position.copy(center);
    if (idx === 1) card.rotation.y = -Math.PI / 2;
    card.castShadow = true;
    card.receiveShadow = false;
    card.userData.isBillboardCard = true;
    group.add(card);
  }

  return group;
}

export function disposeBillboard(group) {
  if (!group) return;
  group.traverse((o) => {
    if (!o.userData?.isBillboardCard) return;
    o.material.map?.dispose?.();
    o.material.roughnessMap?.dispose?.();
    o.material.normalMap?.dispose?.();
    o.material.dispose?.();
    o.geometry?.dispose?.();
  });
}
