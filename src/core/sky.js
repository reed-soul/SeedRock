import {
  BackSide, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, SphereGeometry,
} from 'three/webgpu';

const HORIZON = new Color(0x4a5a6e);
const ZENITH = new Color(0x8eb4e8);

/**
 * Gradient sky dome — cheap atmosphere without a post stack.
 */
export function buildSky(radius = 90) {
  const geo = new SphereGeometry(radius, 40, 24);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const pos = geo.attributes.position;
  const tmp = new Color();

  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow(Math.max(0, pos.getY(i) / radius), 0.72);
    tmp.copy(HORIZON).lerp(ZENITH, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const mesh = new Mesh(geo, new MeshBasicMaterial({
    vertexColors: true,
    side: BackSide,
    fog: false,
  }));
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  return mesh;
}
