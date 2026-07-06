import { SPECIES } from '../species/index.js';

/** Default first-run experience — curated for maximum visual impact. */
export const SHOWCASE = {
  speciesKey: 'karst',
  seed: 3310,
  sceneMode: 'living',
  scene: { scatterCount: 20 },
  overlay: {
    moss: 0.18,
    snow: 0,
    useMossTexture: true,
    useSnowTexture: true,
  },
  useLOD: true,
  bakeBillboard: true,
  autoRotate: true,
  autoRotateSpeed: 0.32,
  showGrid: false,
  quality: 'high',
  perfHud: false,
  paint: {
    spacing: 0.3,
    scaleMin: 0.15,
    scaleMax: 0.45,
    randomRot: true,
  },
};

/** @type {Record<'living'|'single'|'paint', { position: [number, number, number], target: [number, number, number] }>} */
export const CAMERA_PRESETS = {
  living: {
    position: [9.4, 4.8, 10.8],
    target: [0, 2.5, -2.2],
  },
  single: {
    position: [5.1, 3.1, 6.4],
    target: [0, 1.45, 0],
  },
  paint: {
    // Steeper overhead angle — easier to see where the brush lands on terrain.
    position: [6, 11, 6],
    target: [0, 0.4, 0],
  },
};

/**
 * @param {import('three').PerspectiveCamera camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
 * @param {'living'|'single'|'paint'} mode
 */
export function applyCameraPreset(camera, controls, mode) {
  const preset = CAMERA_PRESETS[mode] ?? CAMERA_PRESETS.single;
  camera.position.set(...preset.position);
  controls.target.set(...preset.target);
  controls.minDistance = mode === 'living' ? 2.5 : 1.5;
  controls.maxDistance = mode === 'living' ? 42 : 35;
  controls.update();
}

/**
 * Build viewer state tuned for the showcase species.
 * URL query params still override via applyUrlState().
 */
export function createShowcaseState() {
  const preset = SPECIES[SHOWCASE.speciesKey];
  return {
    speciesKey: SHOWCASE.speciesKey,
    seed: SHOWCASE.seed,
    shape: {
      radius: preset.shape.radius,
      detail: preset.shape.detail,
      squash: preset.shape.squash ?? 1,
      amplitude: preset.noise.amplitude,
    },
    erosion: {
      thermal: preset.erosion.thermal?.enabled !== false,
      hydraulic: preset.erosion.hydraulic?.enabled !== false,
      edgeWear: preset.erosion.edgeWear?.enabled !== false,
    },
    overlay: { ...SHOWCASE.overlay },
    sceneMode: SHOWCASE.sceneMode,
    scene: { ...SHOWCASE.scene },
  useLOD: SHOWCASE.useLOD,
  bakeBillboard: SHOWCASE.bakeBillboard,
    autoRotate: SHOWCASE.autoRotate,
    autoRotateSpeed: SHOWCASE.autoRotateSpeed,
    showGrid: SHOWCASE.showGrid,
    quality: SHOWCASE.quality,
    perfHud: SHOWCASE.perfHud,
    paint: { ...SHOWCASE.paint },
  };
}
