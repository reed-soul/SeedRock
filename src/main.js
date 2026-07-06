import * as THREE from 'three/webgpu';
import { Mesh } from 'three/webgpu';
import { createScene } from './core/scene.js';
import { buildRock } from './generator/mesh.js';
import { makeRockMaterial } from './materials/rock-material.js';
import { downloadGLB } from './export/glb.js';
import { SPECIES, DEFAULT_SPECIES } from './species/index.js';
import { buildGUI, applyOverrides, createDefaultState } from './ui/controls.js';

const hud = document.getElementById('hud');
const errBox = document.getElementById('err');
const loadingBox = document.getElementById('loading');
const loadingMsg = loadingBox?.querySelector('.msg');
const loadingBar = loadingBox?.querySelector('.bar-fill');

const fail = (msg) => {
  if (errBox) { errBox.style.display = 'grid'; errBox.textContent = msg; }
  console.error(msg);
};

const setLoading = (on, text, frac) => {
  if (!loadingBox) return;
  loadingBox.style.display = on ? 'flex' : 'none';
  if (text && loadingMsg) loadingMsg.textContent = text;
  if (frac != null && loadingBar) loadingBar.style.width = `${Math.round(frac * 100)}%`;
};

async function main() {
  setLoading(true, 'Initializing WebGPU…', 0.1);

  const app = document.getElementById('app');
  if (!app) return fail('Missing #app container');

  let sceneCtx;
  try {
    sceneCtx = await createScene(app);
  } catch (e) {
    return fail(`WebGPU init failed: ${e.message}\n\nTry Chrome 113+ or Edge with WebGPU enabled.`);
  }

  const { scene, camera, renderer, controls } = sceneCtx;
  const state = createDefaultState();

  let rockMesh = null;
  let rockGroup = new THREE.Group();
  rockGroup.name = 'rock';
  scene.add(rockGroup);

  const grid = scene.children.find((c) => c.isGridHelper);

  state.onShowGrid = (v) => { if (grid) grid.visible = v; };

  function disposeRock() {
    if (!rockMesh) return;
    rockGroup.remove(rockMesh);
    rockMesh.geometry.dispose();
    rockMesh.material.dispose();
    rockMesh = null;
  }

  function rebuildRock() {
    disposeRock();
    const base = SPECIES[state.speciesKey] ?? SPECIES[DEFAULT_SPECIES];
    const preset = applyOverrides(base, state);
    const { geometry } = buildRock(preset, state.seed);

    const material = makeRockMaterial(preset);
    rockMesh = new Mesh(geometry, material);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    rockMesh.name = `${preset.id}_${state.seed}`;
    rockMesh.position.y = geometry.boundingBox.min.y * -1;
    rockGroup.add(rockMesh);

    if (hud) {
      hud.textContent = [
        'SeedRock',
        `backend: ${sceneCtx.backend}`,
        `species: ${preset.name}`,
        `seed: ${state.seed}`,
        `verts: ${geometry.attributes.position.count}`,
      ].join('\n');
    }
  }

  setLoading(true, 'Generating rock…', 0.6);
  rebuildRock();
  setLoading(false);

  buildGUI({
    species: SPECIES,
    state,
    onRegenerate: () => rebuildRock(),
    onExport: () => downloadGLB(rockGroup, `seedrock_${state.speciesKey}_${state.seed}.glb`),
  });

  renderer.setAnimationLoop(() => {
    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = state.autoRotateSpeed;
    controls.update();
    renderer.render(scene, camera);
  });
}

main().catch((e) => fail(String(e)));
