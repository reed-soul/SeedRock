import GUI from 'lil-gui';
import { SPECIES, DEFAULT_SPECIES } from '../species/index.js';
import { createShowcaseState } from './showcase.js';

/**
 * @param {object} ctx
 * @param {Record<string, import('../species/granite.js').RockPreset>} ctx.species
 * @param {object} ctx.state
 * @param {(reason: string) => void} ctx.onRegenerate
 * @param {() => Promise<number>} ctx.onExport
 */
export function buildGUI(ctx) {
  const gui = new GUI({ title: 'SeedRock' });
  gui.domElement.style.cssText += 'opacity:0.94;';

  const folders = {
    species: gui.addFolder('Rock Type'),
    shape: gui.addFolder('Shape'),
    erosion: gui.addFolder('Erosion'),
    overlay: gui.addFolder('Cover'),
    scene: gui.addFolder('Scene'),
    paint: gui.addFolder('Paint'),
    export: gui.addFolder('Export'),
  };

  const speciesKeys = Object.keys(ctx.species);
  const state = ctx.state;

  folders.species.add(state, 'speciesKey', speciesKeys).name('Type').onChange(() => {
    const preset = ctx.species[state.speciesKey];
    syncFromPreset(preset);
    ctx.onRegenerate('species');
  });

  folders.species.add(state, 'seed').name('Seed').onFinishChange(() => ctx.onRegenerate('seed'));
  folders.species.add({ randomize: () => {
    state.seed = Math.floor(Math.random() * 1_000_000);
    gui.controllersRecursive().find((c) => c.property === 'seed')?.updateDisplay();
    ctx.onRegenerate('seed');
  }}, 'randomize').name('Randomize Seed');

  folders.shape.add(state.shape, 'radius', 0.4, 2.0, 0.05).name('Radius').onChange(() => ctx.onRegenerate('shape'));
  folders.shape.add(state.shape, 'detail', 1, 5, 1).name('Detail').onFinishChange(() => ctx.onRegenerate('shape'));
  folders.shape.add(state.shape, 'squash', 0.4, 1.2, 0.02).name('Squash').onChange(() => ctx.onRegenerate('shape'));
  folders.shape.add(state.shape, 'amplitude', 0.05, 0.5, 0.01).name('Noise Amp').onChange(() => ctx.onRegenerate('shape'));

  folders.erosion.add(state.erosion, 'thermal').name('Thermal').onChange(() => ctx.onRegenerate('erosion'));
  folders.erosion.add(state.erosion, 'hydraulic').name('Hydraulic').onChange(() => ctx.onRegenerate('erosion'));
  folders.erosion.add(state.erosion, 'edgeWear').name('Edge Wear').onChange(() => ctx.onRegenerate('erosion'));

  folders.overlay.add(state.overlay, 'moss', 0, 1, 0.01).name('Moss').onChange(() => ctx.onRegenerate('overlay'));
  folders.overlay.add(state.overlay, 'useMossTexture').name('Moss Texture').onChange(() => ctx.onRegenerate('overlay'));
  folders.overlay.add(state.overlay, 'snow', 0, 1, 0.01).name('Snow').onChange(() => ctx.onRegenerate('overlay'));
  folders.overlay.add(state.overlay, 'useSnowTexture').name('Snow Texture').onChange(() => ctx.onRegenerate('overlay'));

  folders.scene.add(state, 'sceneMode', { Single: 'single', Living: 'living', Paint: 'paint' }).name('Mode').onChange((mode) => {
    // Entering/exiting paint toggles orbit + the brush; rebuild routes the
    // camera preset via applyCameraPreset in main.js.
    if (mode === 'paint') {
      state.onPaintEnter?.();
    } else {
      state.onPaintExit?.();
    }
    ctx.onRegenerate('scene');
  });
  folders.scene.add(state.scene, 'scatterCount', 0, 30, 1).name('Scatter').onFinishChange(() => ctx.onRegenerate('scene'));
  folders.scene.add(state, 'useLOD').name('LOD').onChange(() => ctx.onRegenerate('scene'));
  folders.scene.add(state, 'bakeBillboard').name('Billboard Bake').onChange(() => ctx.onRegenerate('scene'));
  folders.scene.add(state, 'autoRotate').name('Auto Rotate');
  folders.scene.add(state, 'autoRotateSpeed', 0.1, 3, 0.1).name('Rotate Speed');
  folders.scene.add(state, 'quality', { High: 'high', Medium: 'medium', Low: 'low' }).name('Quality').onChange(() => ctx.onRegenerate('scene'));
  folders.scene.add(state, 'perfHud').name('Perf HUD');
  folders.scene.add(state, 'showGrid').name('Grid').onChange((v) => { state.onShowGrid?.(v); });

  // Paint brush — only meaningful in Paint mode, but the controls are live in
  // any mode so the user can dial in spacing/scale before entering paint.
  folders.paint.add(state.paint, 'spacing', 0.1, 1.2, 0.05).name('Brush Spacing').onChange(() => state.onPaintParams?.());
  folders.paint.add(state.paint, 'scaleMin', 0.05, 0.6, 0.01).name('Min Scale').onChange(() => state.onPaintParams?.());
  folders.paint.add(state.paint, 'scaleMax', 0.1, 1.5, 0.01).name('Max Scale').onChange(() => state.onPaintParams?.());
  folders.paint.add(state.paint, 'randomRot').name('Random Rotation').onChange(() => state.onPaintParams?.());
  folders.paint.add({ clear: () => state.onPaintClear?.() }, 'clear').name('Clear Painted');

  folders.export.add({ exportGlb: async () => {
    const bytes = await ctx.onExport();
    if (bytes) console.log(`[SeedRock] exported ${(bytes / 1024).toFixed(1)} KB`);
  }}, 'exportGlb').name('Download .glb');

  function syncFromPreset(preset) {
    state.shape.radius = preset.shape.radius;
    state.shape.detail = preset.shape.detail;
    state.shape.squash = preset.shape.squash ?? 1;
    state.shape.amplitude = preset.noise.amplitude;
    state.erosion.thermal = preset.erosion.thermal?.enabled !== false;
    state.erosion.hydraulic = preset.erosion.hydraulic?.enabled !== false;
    state.erosion.edgeWear = preset.erosion.edgeWear?.enabled !== false;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  syncFromPreset(ctx.species[state.speciesKey] ?? ctx.species[DEFAULT_SPECIES]);

  return gui;
}

/**
 * Merge live GUI overrides into a species preset copy.
 * @param {import('../species/granite.js').RockPreset} preset
 * @param {object} state
 */
export function applyOverrides(preset, state) {
  return {
    ...preset,
    shape: {
      ...preset.shape,
      radius: state.shape.radius,
      detail: Math.round(state.shape.detail),
      squash: state.shape.squash,
    },
    noise: {
      ...preset.noise,
      amplitude: state.shape.amplitude,
    },
    erosion: {
      thermal: { ...preset.erosion.thermal, enabled: state.erosion.thermal },
      hydraulic: { ...preset.erosion.hydraulic, enabled: state.erosion.hydraulic },
      edgeWear: { ...preset.erosion.edgeWear, enabled: state.erosion.edgeWear },
    },
  };
}

export function createDefaultState() {
  return createShowcaseState();
}
