import * as THREE from 'three/webgpu';
import { createScene } from './core/scene.js';
import { makeRockMaterial, loadRockTextures } from './materials/rock-material.js';
import { loadOverlayTextures } from './materials/overlays.js';
import { downloadGLB } from './export/glb.js';
import { SPECIES, DEFAULT_SPECIES } from './species/index.js';
import { buildGUI, applyOverrides, createDefaultState } from './ui/controls.js';
import { applyUrlState } from './ui/url-state.js';
import { applyCameraPreset } from './ui/showcase.js';
import { buildLivingScene, buildHeroRock, disposeLivingScene, disposeHeroRock } from './generator/scene-build.js';
import { generateRockGeometry } from './generator/mesh.js';
import { PaintBrush } from './generator/paint.js';
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

  const { scene, camera, renderer, controls, grid } = sceneCtx;
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

  // paintGroup is a sibling of currentRoot under content — disposeContent()
  // only removes currentRoot, so painted rocks survive rebuildRock() calls
  // (species/shape/erosion changes) and are included in GLB export.
  const paintGroup = new THREE.Group();
  paintGroup.name = 'paint_group';
  content.add(paintGroup);

  const gridHelper = grid;
  state.onShowGrid = (v) => { if (gridHelper) gridHelper.visible = v; };
  state.onShowGrid(state.showGrid);

  let currentMaterial = null;
  let currentRoot = null;
  let rebuildGen = 0;
  let mapsForBake = null;

  // Paint brush — built once, enabled/disabled on scene-mode switch. Sources
  // its preset/material lazily via closures so it always sees the live state.
  const brush = new PaintBrush({
    scene, camera, renderer,
    getPreset: () => applyOverrides(SPECIES[state.speciesKey] ?? SPECIES[DEFAULT_SPECIES], state),
    getMaterial: () => currentMaterial,
    getTerrain: () => scene.getObjectByName('terrain'),
  });
  brush.group.position.copy(paintGroup.position);
  paintGroup.add(brush.group);
  brush.setParams(state.paint);

  state.onPaintParams = () => brush.setParams(state.paint);
  state.onPaintClear = () => brush.clear();
  state.onPaintEnter = () => {
    brush.setSpecies();          // rebuild mesh for the current species/material
    brush.setParams(state.paint);
    brush.enable();
    controls.enabled = false;    // left-drag = paint, not orbit
  };
  state.onPaintExit = () => {
    brush.disable();
    controls.enabled = true;
  };

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
    currentMaterial = makeRockMaterial(preset, maps, state.overlay, overlayMaps, { style: state.style });
    brush.setStyle(state.style);

    const lodOpts = {
      bakeBillboard: state.useLOD && state.bakeBillboard,
      renderer,
      quality: state.quality,
      style: state.style,
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
    } else if (state.sceneMode === 'paint') {
      // Paint mode: a lightweight hero rock for preview (no LOD/bake). The brush
      // mesh is rebuilt too — species/shape/erosion changes swap what gets painted.
      const geometry = generateRockGeometry(preset, state.seed, { style: state.style });
      const mesh = new Mesh(geometry, currentMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = -geometry.boundingBox.min.y;
      mesh.name = `${preset.id}_${state.seed}_paint_preview`;
      currentRoot = mesh;
      brush.setSpecies();
    } else if (state.useLOD) {
      currentRoot = await buildHeroRock(preset, state.seed, currentMaterial, lodOpts);
      if (gen !== rebuildGen) return;
    } else {
      const geometry = generateRockGeometry(preset, state.seed, { style: state.style });
      const mesh = new Mesh(geometry, currentMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = -geometry.boundingBox.min.y;
      mesh.name = `${preset.id}_${state.seed}`;
      currentRoot = mesh;
    }

    content.add(currentRoot);
    applyCameraPreset(camera, controls, state.sceneMode);
    // Re-seal brush state after a rebuild: if we're in paint mode, re-enable
    // (disposeContent path may have swapped the material the brush captured).
    if (state.sceneMode === 'paint' && !brush.enabled) state.onPaintEnter?.();
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
      `painted: ${brush.count}`,
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
    onExport: () => downloadGLB(content, `seedrock_${state.speciesKey}_${state.seed}.glb`, { collider: state.exportCollider }),
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
