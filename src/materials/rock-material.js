import {
  MeshStandardNodeMaterial, BackSide, Color, RepeatWrapping, SRGBColorSpace, NoColorSpace,
} from 'three/webgpu';
import {
  texture, triplanarTexture, float, vec3, vec4, normalView, normalize, cameraViewMatrix,
  positionWorld, mx_noise_float, mul, add, mix,
} from 'three/tsl';

/**
 * Procedural rock material — triplanar PBR when textures exist, otherwise
 * world-space noise tinting over the species base color.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {{ albedo?: import('three').Texture, normal?: import('three').Texture, roughness?: import('three').Texture }} maps
 */
export function makeRockMaterial(preset, maps = {}) {
  const mat = new MeshStandardNodeMaterial({
    roughness: preset.roughness,
    metalness: preset.metalness,
  });
  mat.shadowSide = BackSide;

  const triScale = float(preset.textures?.triplanarScale ?? 0.45);

  if (maps.albedo) {
    mat.colorNode = triplanarTexture(texture(maps.albedo), null, null, triScale);
    if (maps.roughness) {
      mat.roughnessNode = triplanarTexture(texture(maps.roughness), null, null, triScale).g;
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
    mat.colorNode = mix(tint, tint.mul(0.78), vein.mul(0.35));
    mat.roughnessNode = add(float(preset.roughness), grain.mul(0.08));
  }

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
  const load = async (url, srgb) => {
    if (!url) return null;
    try {
      const tex = await loader.loadAsync(url);
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
