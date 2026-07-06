import { RepeatWrapping, SRGBColorSpace, NoColorSpace } from 'three/webgpu';
import { overlayTextureUrl } from '../core/textures.js';

let cached = null;

/**
 * Load shared biome overlay textures (moss). Cached after first load.
 * @param {import('three').TextureLoader} loader
 */
export async function loadOverlayTextures(loader) {
  if (cached) return cached;

  const load = async (filename, srgb) => {
    try {
      const tex = await loader.loadAsync(overlayTextureUrl(filename));
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
      tex.anisotropy = 8;
      return tex;
    } catch {
      return null;
    }
  };

  const [mossAlbedo, mossNormal, mossRoughness] = await Promise.all([
    load('moss_albedo.png', true),
    load('moss_normal.png', false),
    load('moss_roughness.png', false),
  ]);

  cached = { mossAlbedo, mossNormal, mossRoughness };
  return cached;
}

export function clearOverlayCache() {
  cached = null;
}
