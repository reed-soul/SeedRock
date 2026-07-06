import {
  MeshStandardNodeMaterial, MeshToonNodeMaterial, BackSide, Color,
  RepeatWrapping, SRGBColorSpace, NoColorSpace, DataTexture,
} from 'three/webgpu';
import {
  texture, triplanarTexture, float, vec3, vec4, normalView, normalWorld, normalize,
  cameraViewMatrix, positionWorld, mx_noise_float, add, mix, smoothstep, clamp,
} from 'three/tsl';
import { textureUrl } from '../core/textures.js';

/**
 * @typedef {{ moss?: number, snow?: number, useMossTexture?: boolean, useSnowTexture?: boolean }} OverlayParams
 * @typedef {{
 *   mossAlbedo?: import('three').Texture, mossNormal?: import('three').Texture, mossRoughness?: import('three').Texture,
 *   snowAlbedo?: import('three').Texture, snowNormal?: import('three').Texture, snowRoughness?: import('three').Texture,
 * }} OverlayMaps
 * @typedef {'pbr'|'lowpoly'|'toon'} RockStyle
 */

// Toon ramp: a small 1D gradient map sampled by NdotL. 4 bands read as a clean
// cel-shade; cloned per-material so consumers can mutate without cross-talk.
let _toonRampBase = null;
function makeToonRamp() {
  if (!_toonRampBase) {
    // 4 hard bands: shadow / mid-low / mid-high / highlight. NearestFilter keeps
    // the steps crisp; the toon material samples the r channel by NoL.
    const data = new Uint8Array([60, 120, 200, 255]);
    _toonRampBase = new DataTexture(data, 4, 1);
    _toonRampBase.needsUpdate = true;
  }
  const ramp = _toonRampBase.clone();
  ramp.needsUpdate = true;
  return ramp;
}

/**
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {{ albedo?: import('three').Texture, normal?: import('three').Texture, roughness?: import('three').Texture, ao?: import('three').Texture }} maps
 * @param {OverlayParams} [overlay]
 * @param {OverlayMaps} [overlayMaps]
 * @param {{ style?: RockStyle }} [opts]
 */
export function makeRockMaterial(preset, maps = {}, overlay = {}, overlayMaps = {}, opts = {}) {
  const style = opts.style ?? 'pbr';
  const isLowpoly = style === 'lowpoly';
  const isToon = style === 'toon';
  // flatShading derives face normals per triangle — the per-pixel normalNode
  // perturbation is ignored, so skip building it (saves work + avoids artifacts).
  // Toon lighting also ignores fine normal detail (it bands by NoL).
  const useNormalDetail = !isLowpoly && !isToon;

  const mat = isToon
    ? new MeshToonNodeMaterial({ gradientMap: makeToonRamp() })
    : new MeshStandardNodeMaterial({
        roughness: preset.roughness,
        metalness: preset.metalness,
      });
  if (isLowpoly) mat.flatShading = true;
  mat.shadowSide = BackSide;

  const triScale = float(preset.textures?.triplanarScale ?? 0.45);
  const mossAmt = float(overlay.moss ?? 0);
  const snowAmt = float(overlay.snow ?? 0);
  const useMossTex = overlay.useMossTexture !== false;
  const useSnowTex = overlay.useSnowTexture !== false;

  let colorNode;
  let roughnessNode = float(preset.roughness);
  let normalDetail = null;

  if (maps.albedo) {
    colorNode = triplanarTexture(texture(maps.albedo), null, null, triScale);
    if (maps.roughness) {
      roughnessNode = triplanarTexture(texture(maps.roughness), null, null, triScale).g;
    }
    if (maps.normal && useNormalDetail) {
      const d = triplanarTexture(texture(maps.normal), null, null, triScale).xyz.mul(2).sub(vec3(1, 1, 2));
      normalDetail = d;
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

  if (normalDetail) {
    const dView = cameraViewMatrix.mul(vec4(normalDetail, 0)).xyz;
    mat.normalNode = normalize(normalView.add(dView.mul(0.65)));
  }

  if (maps.ao) {
    mat.aoNode = triplanarTexture(texture(maps.ao), null, null, triScale).r;
  }

  if ((overlay.moss ?? 0) > 0 || (overlay.snow ?? 0) > 0) {
    const up = vec3(0, 1, 0);
    const slope = clamp(normalWorld.dot(up), float(0), float(1));
    const mossMask = smoothstep(float(0.32), float(0.7), slope).mul(mossAmt);
    const snowMask = smoothstep(float(0.55), float(0.9), slope).mul(snowAmt);

    if (useMossTex && overlayMaps.mossAlbedo && (overlay.moss ?? 0) > 0) {
      const mossScale = float(0.55);
      const mossColor = triplanarTexture(texture(overlayMaps.mossAlbedo), null, null, mossScale);
      colorNode = mix(colorNode, mossColor, mossMask);

      if (overlayMaps.mossRoughness) {
        const mossRough = triplanarTexture(texture(overlayMaps.mossRoughness), null, null, mossScale).g;
        roughnessNode = mix(roughnessNode, mossRough, mossMask);
      } else {
        roughnessNode = mix(roughnessNode, float(0.88), mossMask.mul(0.3));
      }

      if (overlayMaps.mossNormal && useNormalDetail) {
        const mossN = triplanarTexture(texture(overlayMaps.mossNormal), null, null, mossScale).xyz.mul(2).sub(vec3(1, 1, 2));
        const mossView = cameraViewMatrix.mul(vec4(mossN, 0)).xyz;
        const baseNormal = mat.normalNode ?? normalView;
        mat.normalNode = normalize(mix(baseNormal, normalize(baseNormal.add(mossView.mul(0.5))), mossMask));
      }
    } else if ((overlay.moss ?? 0) > 0) {
      const mossColor = vec3(0.2, 0.36, 0.16);
      colorNode = mix(colorNode, mossColor, mossMask);
      roughnessNode = mix(roughnessNode, float(0.88), mossMask.mul(0.3));
    }

    const snowColor = vec3(0.91, 0.93, 0.96);
    if (useSnowTex && overlayMaps.snowAlbedo && (overlay.snow ?? 0) > 0) {
      const snowScale = float(0.65);
      const snowTexColor = triplanarTexture(texture(overlayMaps.snowAlbedo), null, null, snowScale);
      colorNode = mix(colorNode, snowTexColor, snowMask);

      if (overlayMaps.snowRoughness) {
        const snowRough = triplanarTexture(texture(overlayMaps.snowRoughness), null, null, snowScale).g;
        roughnessNode = mix(roughnessNode, snowRough, snowMask);
      } else {
        roughnessNode = mix(roughnessNode, float(0.98), snowMask.mul(0.6));
      }

      if (overlayMaps.snowNormal && useNormalDetail) {
        const snowN = triplanarTexture(texture(overlayMaps.snowNormal), null, null, snowScale).xyz.mul(2).sub(vec3(1, 1, 2));
        const snowView = cameraViewMatrix.mul(vec4(snowN, 0)).xyz;
        const baseNormal = mat.normalNode ?? normalView;
        mat.normalNode = normalize(mix(baseNormal, normalize(baseNormal.add(snowView.mul(0.35))), snowMask));
      }
    } else if ((overlay.snow ?? 0) > 0) {
      colorNode = mix(colorNode, snowColor, snowMask);
      roughnessNode = mix(roughnessNode, float(0.98), snowMask.mul(0.6));
    }
  }

  mat.colorNode = colorNode;
  mat.roughnessNode = roughnessNode;

  return mat;
}

/**
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

  const [albedo, normal, roughness, ao] = await Promise.all([
    load(textures.albedo, true),
    load(textures.normal ?? `${base}_normal.png`, false),
    load(textures.roughness ?? `${base}_roughness.png`, false),
    load(textures.ao ?? `${base}_ao.png`, false),
  ]);

  return { albedo, normal, roughness, ao };
}
