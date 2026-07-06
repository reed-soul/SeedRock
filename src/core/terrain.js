import {
  Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry,
} from 'three/webgpu';
import { makeNoise3D } from './noise.js';

const _c = new Color();
const SOIL_LOW = new Color(0x2a2218);
const SOIL_MID = new Color(0x4a3f32);
const SOIL_HIGH = new Color(0x6a6254);

/**
 * Gentle procedural ground with height-tinted vertex colors.
 * @param {{ size?: number, segments?: number, seed?: number }} [opts]
 */
export function buildTerrain(opts = {}) {
  const size = opts.size ?? 38;
  const segments = opts.segments ?? 80;
  const noise = makeNoise3D(opts.seed ?? 3310);
  const geo = new PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const half = size * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const macro = noise.fbm(x * 0.075, z * 0.075, 0.15, 4, 2, 0.5);
    const detail = noise.fbm(x * 0.32, z * 0.32, 1.4, 3, 2.1, 0.45);
    const edge = Math.hypot(x / half, z / half);
    const bowl = Math.pow(Math.max(0, edge - 0.55) / 0.45, 2);
    const h = macro * 0.62 + detail * 0.14 - bowl * 0.42;
    pos.setY(i, h);

    const tint = Math.max(0, Math.min(1, (h + 0.28) / 0.75));
    _c.copy(SOIL_LOW).lerp(SOIL_MID, tint).lerp(SOIL_HIGH, tint * tint * 0.35);
    colors[i * 3] = _c.r;
    colors[i * 3 + 1] = _c.g;
    colors[i * 3 + 2] = _c.b;
  }

  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
  }));
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  return mesh;
}
