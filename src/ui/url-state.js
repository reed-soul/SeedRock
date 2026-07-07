import { SPECIES } from '../species/index.js';
import { controlsFromSpecies } from '../species/controls.js';

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
 *
 * Recognized query params (all optional):
 *   species=<key>          — registry key (e.g. granite)
 *   seed=<int>
 *   scene=single|living
 *   style=pbr|lowpoly|toon
 *   moss=<0..1>, snow=<0..1>
 *   scatter=<int>
 *   lod=0 (off), rotate=0 (off)
 *   p.<paramKey>=<number>  — per-species semantic knob override (Phase 2),
 *                            e.g. p.blockiness=0.3. Only keys declared in the
 *                            species' controls[] are honored.
 *
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

  // Per-species param overrides — only honor keys the active species declares.
  const preset = SPECIES[state.speciesKey];
  if (preset?.controls?.length) {
    const declared = new Set(preset.controls.map((d) => d.key));
    // Seed state.params from the species defaults so overrides compose cleanly.
    if (!state.params) state.params = controlsFromSpecies(preset).params;
    for (const d of preset.controls) {
      const raw = params.get(`p.${d.key}`);
      if (raw == null) continue;
      const v = num(raw, undefined);
      if (v === undefined) continue;
      state.params[d.key] = v;
    }
    // Drop any stale param keys not declared on the current species (defensive).
    for (const k of Object.keys(state.params)) {
      if (!declared.has(k)) delete state.params[k];
    }
  }
}

/**
 * Build a viewer URL from an example or partial state.
 *
 * Emits per-species params as `p.<key>` query params when present, so a URL can
 * carry the full tuned state, not just the headline fields.
 *
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
  if (example.style) p.set('style', example.style);
  // Per-species params (only those declared on the species, to keep URLs clean).
  if (example.params) {
    const preset = SPECIES[example.speciesKey];
    const declared = preset ? new Set(preset.controls?.map((d) => d.key) ?? []) : null;
    for (const [k, v] of Object.entries(example.params)) {
      if (declared && !declared.has(k)) continue;
      p.set(`p.${k}`, String(v));
    }
  }
  const root = base.endsWith('/') ? `${base}index.html` : `${base}/index.html`;
  const qs = p.toString();
  return qs ? `${root}?${qs}` : root;
}

