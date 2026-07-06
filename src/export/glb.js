import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3, Group, Mesh, Vector3 } from 'three/webgpu';

class MSFTLodExtension {
  constructor(writer, lodSource) {
    this.writer = writer;
    this.name = 'MSFT_lod';
    this.lodSource = lodSource;
  }

  afterParse() {
    const json = this.writer.json;
    if (!json.nodes) return;
    const groups = new Map();
    json.nodes.forEach((node, i) => {
      const m = /^(.*)_LOD(\d+)$/.exec(node.name || '');
      if (!m) return;
      const list = groups.get(m[1]) ?? [];
      list.push({ i, n: +m[2] });
      groups.set(m[1], list);
    });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.n - b.n);
      const base = json.nodes[list[0].i];
      base.extensions = base.extensions || {};
      base.extensions[this.name] = { ids: list.slice(1).map((e) => e.i) };
      const cov = this.coverages(list.length);
      if (cov) {
        base.extras = base.extras || {};
        base.extras.MSFT_screencoverage = cov;
      }
      this.writer.extensionsUsed[this.name] = true;
    }
  }

  coverages(levelCount) {
    const src = this.lodSource;
    if (!src?.isLOD || src.levels.length < levelCount) return null;
    const height = new Box3().setFromObject(src).getSize(new Vector3()).y;
    if (!height) return null;
    const covAt = (d) => Math.min(1, (height / (2 * d * Math.tan(25 * Math.PI / 180))) ** 2);
    return [...src.levels.slice(1, levelCount).map((l) => covAt(l.distance)), 0.001];
  }
}

function cloneLevelObject(src, lodIndex, baseName) {
  const lg = new Group();
  lg.name = `${baseName}_LOD${lodIndex}`;
  lg.visible = true;
  lg.position.copy(src.position);
  lg.rotation.copy(src.rotation);
  lg.scale.copy(src.scale);

  src.traverse((o) => {
    if (!o.isMesh) return;
    const out = new Mesh(o.geometry, o.material);
    out.name = o.name || `${baseName}_mesh`;
    out.castShadow = o.castShadow;
    out.receiveShadow = o.receiveShadow;
    out.position.copy(o.position);
    out.rotation.copy(o.rotation);
    out.scale.copy(o.scale);
    lg.add(out);
  });

  if (lg.children.length === 0 && src.isMesh) {
    const out = new Mesh(src.geometry, src.material);
    out.name = `${baseName}_mesh`;
    lg.add(out);
  }

  return lg;
}

function buildExportTree(lodRoot) {
  const baseName = lodRoot.name.replace(/_LOD\d+$/, '') || lodRoot.name;
  const root = new Group();
  root.name = baseName;
  root.position.copy(lodRoot.position);
  root.rotation.copy(lodRoot.rotation);
  root.scale.copy(lodRoot.scale);

  lodRoot.levels.forEach((level, i) => {
    root.add(cloneLevelObject(level.object, i, baseName));
  });

  return root;
}

export async function exportGLB(object3d, opts = {}) {
  const exporter = new GLTFExporter();

  let lodRoot = null;
  if (object3d.isLOD) lodRoot = object3d;
  else object3d.traverse((o) => { if (o.isLOD && !lodRoot) lodRoot = o; });

  if (lodRoot) {
    exporter.register((writer) => new MSFTLodExtension(writer, lodRoot));
  }

  const exportRoot = lodRoot ? buildExportTree(lodRoot) : object3d;
  const result = await exporter.parseAsync(exportRoot, {
    binary: true,
    onlyVisible: opts.onlyVisible ?? false,
  });

  return result;
}

export async function downloadGLB(object3d, filename, opts = {}) {
  const name = filename.endsWith('.glb') ? filename : `${filename}.glb`;

  let handle = null;
  if (window.showSaveFilePicker) {
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'Binary glTF', accept: { 'model/gltf-binary': ['.glb'] } }],
      });
    } catch (e) {
      if (e.name === 'AbortError') return 0;
      handle = null;
    }
  }

  const result = await exportGLB(object3d, opts);
  const blob = new Blob([result], { type: 'model/gltf-binary' });

  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return blob.size;
}
