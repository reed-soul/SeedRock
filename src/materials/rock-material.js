import {
  MeshStandardNodeMaterial, BackSide, Color, RepeatWrapping, SRGBColorSpace, NoColorSpace,
} from 'three/webgpu';
import {
  texture, triplanarTexture, float, vec3, vec4, normalView, normalWorld, normalize,
  cameraViewMatrix, positionWorld, mx_noise_float, add, mix, smoothstep, clamp,
} from 'three/tsl';
import { textureUrl } from '../core/textures.js';

/**
 * @typedef {{ moss?: number, snow?: number }} OverlayParams
 */

/**
 * Procedural rock material — triplanar PBR when textures exist, otherwise
 * world-space noise tinting over the species base color.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {{ albedo?: import('three').Texture, normal?: import('three').Texture, roughness?: import('three').Texture }} maps
 * @param {OverlayParams} [overlay]
 */
export function makeRockMaterial(preset, maps = {}, overlay = {}) {
  const mat = new MeshStandardNodeMaterial({
    roughness: preset.roughness,
    metalness: preset.metalness,
  });
  mat.shadowSide = BackSide;

  const triScale = float(preset.textures?.triplanarScale ?? 0.45);
  const mossAmt = float(overlay.moss ?? 0);
  const snowAmt = float(overlay.snow ?? 0);

  let colorNode;
  let roughnessNode = float(preset.roughness);

  if (maps.albedo) {
    colorNode = triplanarTexture(texture(maps.albedo), null, null, triScale);
    if (maps.roughness) {
      roughnessNode = triplanarTexture(texture(maps.roughness), null, null, triScale).g;
    }
    if (maps.normal) {
      const d = triplanarTexture(texture(maps.normal), null, null, triScale).xyz.mul(2).sub(vec3(1, 1, 2));
      const dView = cameraViewMatrix.mul(vec4(d, 0)).xyz;
      mat.normalNode = normalize(normalView.add(dView.mul(0.65)));
    }
  } else {
    const base = new Color(preset.color);
    const world = positionWorld.mul(2.5);
    const grain = mx_noise_float(world);
    const vein = mx_noise_float(world.mul(3.2).add(vec3(4.1, 1.7, 2.3)));
    const tint = mix(
      vec3(base.r, base.g, base.b),
      vec3(base.r * 0.82, base.g * 0.82, base.b * 0.88),
      grain,
    );
    colorNode = mix(tint, tint.mul(0.78), vein.mul(0.35));
    roughnessNode = add(float(preset.roughness), grain.mul(0.08));
  }

  if ((overlay.moss ?? 0) > 0 || (overlay.snow ?? 0) > 0) {
    const up = vec3(0, 1, 0);
    const slope = clamp(normalWorld.dot(up), float(0), float(1));
    const mossMask = smoothstep(float(0.32), float(0.7), slope).mul(mossAmt);
    const snowMask = smoothstep(float(0.55), float(0.9), slope).mul(snowAmt);
    const mossColor = vec3(0.2, 0.36, 0.16);
    const snowColor = vec3(0.91, 0.93, 0.96);
    colorNode = mix(colorNode, mossColor, mossMask);
    colorNode = mix(colorNode, snowColor, snowMask);
    roughnessNode = mix(roughnessNode, float(0.98), snowMask.mul(0.6));
    roughnessNode = mix(roughnessNode, float(0.88), mossMask.mul(0.3));
  }

  mat.colorNode = colorNode;
  mat.roughnessNode = roughnessNode;

  return mat;
}

/**
 * Load optional PBR textures for a species preset.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {import('three').TextureLoader} loader
 */
export async function loadRockTextures(preset, loader) {
  const { textures } = preset;
  if (!textures?.albedo) return {};

  const base = textures.albedo.replace(/_albedo\.(png|jpg|webp)$/, '');
  const load = async (filename, srgb) => {
    if (!filename) return null;
    try {
      const tex = await loader.loadAsync(textureUrl(filename));
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
      tex.anisotropy = 8;
      return tex;
    } catch {
      return null;
    }
  };

  const [albedo, normal, roughness] = await Promise.all([
    load(textures.albedo, true),
    load(textures.normal ?? `${base}_normal.png`, false),
    load(textures.roughness ?? `${base}_roughness.png`, false),
  ]);

  return { albedo, normal, roughness };
}
