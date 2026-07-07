import { assembleBillboardFromRawBake } from './impostor.js';
import { serializeRockBake } from './bake-transfer.js';

/**
 * Manages the off-thread impostor bake worker.
 */
export class BakeService {
  constructor() {
    this._worker = null;
    this._pending = new Map();
    this._ready = false;
    this._reqId = 0;
  }

  get available() {
    return this._ready;
  }

  async init() {
    if (this._ready) return true;
    if (this._worker) return false;

    try {
      const readyPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('bake worker timeout')), 8000);
        this._resolveReady = () => { clearTimeout(timer); resolve(); };
        this._rejectReady = (e) => { clearTimeout(timer); reject(e); };
      });

      this._worker = new Worker(new URL('./bake-worker.js', import.meta.url), { type: 'module' });
      this._worker.onmessage = (e) => this._onMessage(e);
      this._worker.onerror = (e) => console.error('[bake-worker]', e.message || e);

      const off = new OffscreenCanvas(64, 64);
      this._worker.postMessage({ type: 'init', canvas: off }, [off]);
      await readyPromise;
      this._ready = true;
    } catch (e) {
      console.warn('[SeedRock] Bake worker unavailable, using main thread:', e.message);
      this._worker?.terminate();
      this._worker = null;
      this._ready = false;
    }
    return this._ready;
  }

  _onMessage(e) {
    const m = e.data;
    if (m.type === 'ready') {
      console.log('[bake-worker] ready:', m.backend);
      this._resolveReady?.();
      return;
    }
    if (m.type === 'baked') {
      this._pending.get(m.id)?.resolve(m);
      this._pending.delete(m.id);
      return;
    }
    if (m.type === 'error') {
      const err = new Error(`[bake-worker] ${m.where}: ${m.message}`);
      this._pending.get(m.id)?.reject(err);
      this._pending.delete(m.id);
      if (!this._ready) this._rejectReady?.(err);
    }
  }

  /**
   * @param {import('three').Mesh} sourceMesh
   * @param {object} maps
   * @param {object} preset
   * @param {object} [opts]
   */
  async bakeRock(sourceMesh, maps, preset, opts = {}) {
    if (!this._ready) return null;

    const { payload, transfers } = await serializeRockBake(sourceMesh, maps, preset);
    const id = ++this._reqId;

    const result = await new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({
        type: 'bake',
        id,
        size: opts.size ?? 512,
        name: opts.name,
        payload,
      }, transfers);
    });

    return assembleBillboardFromRawBake(result, { name: opts.name });
  }

  dispose() {
    for (const [, pending] of this._pending) {
      pending.reject(new Error('BakeService disposed'));
    }
    this._pending.clear();
    this._worker?.terminate();
    this._worker = null;
    this._ready = false;
  }
}
