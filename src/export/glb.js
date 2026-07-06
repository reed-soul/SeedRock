import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export async function exportGLB(object3d) {
  const exporter = new GLTFExporter();
  return exporter.parseAsync(object3d, { binary: true, onlyVisible: true });
}

export async function downloadGLB(object3d, filename) {
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

  const result = await exportGLB(object3d);
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
