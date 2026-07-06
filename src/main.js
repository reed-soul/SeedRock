import * as THREE from 'three/webgpu';
import { createScene } from './core/scene.js';
import { makeRockMaterial, loadRockTextures } from './materials/rock-material.js';
import { loadOverlayTextures } from './materials/overlays.js';
import { downloadGLB } from './export/glb.js';
import { SPECIES, DEFAULT_SPECIES } from './species/index.js';
import { buildGUI, applyOverrides, createDefaultState } from './ui/controls.js';
import { applyUrlState } from './ui/url-state.js';
import { buildLivingScene, buildHeroRock, disposeLivingScene, disposeHeroRock } from './generator/scene-build.js';
import { generateRockGeometry } from './generator/mesh.js';
import { BakeService } from './core/bake-service.js';
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

const nextPaint = () => new Promise((r) => {
  requestAnimationFrame(() => requestAnimationFrame(r));
});

async function main() {
  setLoading(true, 'Initializing renderer…', 0.1);

  const app = document.getElementById('app');
  if (!app) return fail('Missing #app container');

  let sceneCtx;
  try {
    sceneCtx = await createScene(app);
  } catch (e) {
    return fail(`Renderer init failed:\n${e.message}\n\nTry Chrome 113+ or Edge.`);
  }

  const { scene, camera, renderer, controls } = sceneCtx;
  const state = createDefaultState();
  applyUrlState(state);
  const texLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  const bakeService = new BakeService();
  await bakeService.init();
  const overlayMaps = await loadOverlayTextures(texLoader);

  const content = new THREE.Group();
  content.name = 'content';
  scene.add(content);

  const grid = scene.children.find((c) => c.isGridHelper);
  state.onShowGrid = (v) => { if (grid) grid.visible = v; };

  let currentMaterial = null;
  let currentRoot = null;
  let rebuildGen = 0;
  let mapsForBake = null;

  const perf = { frames: 0, acc: 0, fps: 0, ms: 0 };

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
        if (o.isMesh) o.geometry?.dispose?.();
      });
    }
    content.remove(currentRoot);
    currentMaterial?.dispose?.();
    currentRoot = null;
    currentMaterial = null;
  }

  async function rebuildRock() {
    const gen = ++rebuildGen;
    setLoading(true, 'Generating rock…', 0.35);
    disposeContent();

    const base = SPECIES[state.speciesKey] ?? SPECIES[DEFAULT_SPECIES];
    const preset = applyOverrides(base, state);
    const maps = await loadTextures(preset);
    if (gen !== rebuildGen) return;

    mapsForBake = maps;
    currentMaterial = makeRockMaterial(preset, maps, state.overlay, overlayMaps);

    const lodOpts = {
      bakeBillboard: state.useLOD && state.bakeBillboard,
      renderer,
      quality: state.quality,
      bakeService,
      maps,
      bakeOpts: {
        yield: nextPaint,
        bakeService,
        maps,
        onProgress: () => setLoading(true, 'Baking impostor…', 0.7),
      },
    };

    if (state.sceneMode === 'living') {
      setLoading(true, 'Building living scene…', 0.5);
      currentRoot = await buildLivingScene(preset, state.seed, currentMaterial, {
        scatterCount: state.scene.scatterCount,
        ...lodOpts,
      });
      if (gen !== rebuildGen) return;
      controls.target.set(0, 1.4, 0);
      camera.position.set(5, 3.2, 7);
    } else if (state.useLOD) {
      currentRoot = await buildHeroRock(preset, state.seed, currentMaterial, lodOpts);
      if (gen !== rebuildGen) return;
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
    updateHud(preset);
    setLoading(false);
  }

  function countVertices(root) {
    let n = 0;
    root.traverse((o) => {
      if (o.isMesh && !o.userData?.isBillboardCard) {
        n += o.geometry?.attributes?.position?.count ?? 0;
      }
      if (o.isInstancedMesh) n += (o.geometry?.attributes?.position?.count ?? 0) * o.count;
    });
    return n;
  }

  function updateHud(preset) {
    if (!hud) return;
    const lines = [
      'SeedRock',
      `backend: ${sceneCtx.backend}`,
      `bake: ${bakeService.available ? 'worker' : 'main'}`,
      `species: ${preset.name}`,
      `seed: ${state.seed}`,
      `mode: ${state.sceneMode}`,
      `lod: ${state.useLOD ? (state.bakeBillboard ? 'mesh+billboard' : 'mesh') : 'off'}`,
      `verts: ${countVertices(currentRoot)}`,
    ];
    if (state.perfHud) {
      lines.push(`fps: ${perf.fps}`, `frame: ${perf.ms}ms`);
    }
    hud.textContent = lines.join('\n');
  }

  await rebuildRock();

  buildGUI({
    species: SPECIES,
    state,
    onRegenerate: () => { rebuildRock(); },
    onExport: () => downloadGLB(content, `seedrock_${state.speciesKey}_${state.seed}.glb`),
  });

  let lastHud = 0;
  renderer.setAnimationLoop((time) => {
    const dt = perf.last ? time - perf.last : 16;
    perf.last = time;
    perf.acc += dt;
    perf.frames++;
    if (perf.acc >= 500) {
      perf.fps = Math.round((perf.frames * 1000) / perf.acc);
      perf.ms = Math.round(perf.acc / perf.frames);
      perf.frames = 0;
      perf.acc = 0;
      if (state.perfHud && time - lastHud > 400) {
        lastHud = time;
        const preset = SPECIES[state.speciesKey] ?? SPECIES[DEFAULT_SPECIES];
        updateHud(applyOverrides(preset, state));
      }
    }

    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = state.autoRotateSpeed;
    controls.update();
    const lod = currentRoot?.userData?.hero ?? (currentRoot?.isLOD ? currentRoot : null);
    if (lod?.isLOD) lod.update(camera);
    renderer.render(scene, camera);
  });
}

main().catch((e) => fail(String(e)));
