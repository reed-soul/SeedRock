// Serialize a rock mesh + PBR maps for the off-thread impostor baker.

import { SRGBColorSpace } from 'three/webgpu';

/**
 * @param {import('three').Mesh} mesh
 * @param {{ albedo?: import('three').Texture, normal?: import('three').Texture, roughness?: import('three').Texture }} maps
 * @param {{ color?: number, roughness?: number, metalness?: number }} preset
 */
export async function serializeRockBake(mesh, maps, preset) {
  const geo = mesh.geometry;
  const transfers = [];
  const attrs = {};

  for (const [name, attr] of Object.entries(geo.attributes)) {
    const arr = attr.array.slice();
    attrs[name] = { array: arr, itemSize: attr.itemSize };
    transfers.push(arr.buffer);
  }

  let index = null;
  if (geo.index) {
    const arr = geo.index.array.slice();
    index = { array: arr };
    transfers.push(arr.buffer);
  }

  const bitmaps = {};
  const texKeys = ['albedo', 'normal', 'roughness'];
  for (const k of texKeys) {
    const tex = maps?.[k === 'roughness' ? 'roughness' : k];
    const img = tex?.image;
    if (!img) continue;
    try {
      const bmp = await createImageBitmap(img);
      bitmaps[k] = {
        bitmap: bmp,
        colorSpace: tex.colorSpace === SRGBColorSpace ? 'srgb' : 'linear',
      };
      transfers.push(bmp);
    } catch { /* skip */ }
  }

  const payload = {
    attrs,
    index,
    position: [mesh.position.x, mesh.position.y, mesh.position.z],
    material: {
      color: preset.color ?? 0x888888,
      roughness: preset.roughness ?? 0.9,
      metalness: preset.metalness ?? 0,
    },
    bitmaps,
  };

  return { payload, transfers };
}
