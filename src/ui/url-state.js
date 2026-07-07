import { SPECIES } from '../species/index.js';

/** @param {number} v @param {number} [fallback] */
function num(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/** @param {number} v */
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Apply URL query overrides onto viewer state (non-destructive merge).
 * @param {ReturnType<import('./controls.js').createDefaultState>} state
 * @param {URLSearchParams} [params]
 */
export function applyUrlState(state, params = new URLSearchParams(location.search)) {
  const species = params.get('species');
  if (species && SPECIES[species]) state.speciesKey = species;

  const seed = params.get('seed');
  if (seed != null) {
    const n = parseInt(seed, 10);
    if (Number.isFinite(n)) state.seed = n;
  }

  const scene = params.get('scene');
  if (scene === 'single' || scene === 'living') state.sceneMode = scene;

  if (params.has('moss')) state.overlay.moss = clamp01(num(params.get('moss'), 0));
  if (params.has('snow')) state.overlay.snow = clamp01(num(params.get('snow'), 0));
  if (params.has('scatter')) state.scene.scatterCount = Math.max(0, Math.round(num(params.get('scatter'), 0)));

  if (params.get('lod') === '0') state.useLOD = false;
  if (params.get('rotate') === '0') state.autoRotate = false;

  const style = params.get('style');
  if (style === 'pbr' || style === 'lowpoly' || style === 'toon') state.style = style;
}

/**
 * Build a viewer URL from an example or partial state.
 * @param {object} example
 * @param {string} [base]
 */
export function buildViewerUrl(example, base = import.meta.env?.BASE_URL ?? '/') {
  const p = new URLSearchParams();
  if (example.speciesKey) p.set('species', example.speciesKey);
  if (example.seed != null) p.set('seed', String(example.seed));
  if (example.sceneMode) p.set('scene', example.sceneMode);
  if (example.overlay?.moss) p.set('moss', String(example.overlay.moss));
  if (example.overlay?.snow) p.set('snow', String(example.overlay.snow));
  if (example.scene?.scatterCount) p.set('scatter', String(example.scene.scatterCount));
  if (example.useLOD === false) p.set('lod', '0');
  const root = base.endsWith('/') ? `${base}index.html` : `${base}/index.html`;
  const qs = p.toString();
  return qs ? `${root}?${qs}` : root;
}
