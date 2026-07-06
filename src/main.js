import * as THREE from 'three/webgpu';
import { createScene } from './core/scene.js';
import { makeRockMaterial, loadRockTextures } from './materials/rock-material.js';
import { downloadGLB } from './export/glb.js';
import { SPECIES, DEFAULT_SPECIES } from './species/index.js';
import { buildGUI, applyOverrides, createDefaultState } from './ui/controls.js';
import { buildLivingScene, buildHeroRock, disposeLivingScene, disposeHeroRock } from './generator/scene-build.js';
import { generateRockGeometry } from './generator/mesh.js';
import { Mesh } from 'three/webgpu';

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
  loadingBox.classList.toggle('fade', !on);
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
  const texLoader = new THREE.TextureLoader();
  const textureCache = new Map();

  const content = new THREE.Group();
  content.name = 'content';
  scene.add(content);

  const grid = scene.children.find((c) => c.isGridHelper);
  state.onShowGrid = (v) => { if (grid) grid.visible = v; };

  let currentMaterial = null;
  let currentRoot = null;

  async function loadTextures(preset) {
    const key = preset.id;
    if (textureCache.has(key)) return textureCache.get(key);
    const maps = await loadRockTextures(preset, texLoader);
    textureCache.set(key, maps);
    return maps;
  }

  function disposeContent() {
    if (!currentRoot) return;
    if (state.sceneMode === 'living') {
      disposeLivingScene(currentRoot);
    } else if (state.useLOD && currentRoot.isLOD) {
      disposeHeroRock(currentRoot);
    } else {
      currentRoot.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
        }
      });
    }
    content.remove(currentRoot);
    currentMaterial?.dispose?.();
    currentRoot = null;
    currentMaterial = null;
  }

  async function rebuildRock() {
    setLoading(true, 'Generating rock…', 0.5);
    disposeContent();

    const base = SPECIES[state.speciesKey] ?? SPECIES[DEFAULT_SPECIES];
    const preset = applyOverrides(base, state);
    const maps = await loadTextures(preset);
    currentMaterial = makeRockMaterial(preset, maps, state.overlay);

    if (state.sceneMode === 'living') {
      currentRoot = buildLivingScene(preset, state.seed, currentMaterial, {
        scatterCount: state.scene.scatterCount,
      });
      controls.target.set(0, 1.4, 0);
      camera.position.set(5, 3.2, 7);
    } else if (state.useLOD) {
      currentRoot = buildHeroRock(preset, state.seed, currentMaterial);
      controls.target.set(0, 1.1, 0);
    } else {
      const geometry = generateRockGeometry(preset, state.seed);
      const mesh = new Mesh(geometry, currentMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = -geometry.boundingBox.min.y;
      mesh.name = `${preset.id}_${state.seed}`;
      currentRoot = mesh;
    }

    content.add(currentRoot);
    controls.update();

    const vertCount = countVertices(currentRoot);
    if (hud) {
      hud.textContent = [
        'SeedRock',
        `backend: ${sceneCtx.backend}`,
        `species: ${preset.name}`,
        `seed: ${state.seed}`,
        `mode: ${state.sceneMode}`,
        `verts: ${vertCount}`,
      ].join('\n');
    }

    setLoading(false);
  }

  function countVertices(root) {
    let n = 0;
    root.traverse((o) => {
      if (o.isMesh) n += o.geometry?.attributes?.position?.count ?? 0;
      if (o.isInstancedMesh) n += (o.geometry?.attributes?.position?.count ?? 0) * o.count;
    });
    return n;
  }

  await rebuildRock();

  buildGUI({
    species: SPECIES,
    state,
    onRegenerate: () => { rebuildRock(); },
    onExport: () => downloadGLB(content, `seedrock_${state.speciesKey}_${state.seed}.glb`),
  });

  renderer.setAnimationLoop(() => {
    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = state.autoRotateSpeed;
    controls.update();
    if (currentRoot?.isLOD) currentRoot.update(camera);
    renderer.render(scene, camera);
  });
}

main().catch((e) => fail(String(e)));
