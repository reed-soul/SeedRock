// Scatter Painting — drag on the terrain to drop rock instances in real time.
//
// A PaintBrush owns one InstancedMesh per geometry variant (preallocated to
// MAX_PAINT per variant, grown by bumping `im.count` as slots are filled; the
// ring buffer wraps so the oldest instance is overwritten once the cap is hit).
// Pointer events raycast against the terrain mesh; a distance gate prevents
// clumping on slow drags.
//
// Geometry comes from generateRockGeometry with 3 pre-baked variants (matching
// the existing scatter.js pattern), and the material is shared with the hero
// rock so texture/overlay changes propagate for free.

import {
  Group, InstancedMesh, Matrix4, Quaternion, Euler, Vector2, Vector3, Raycaster,
} from 'three/webgpu';
import { generateRockGeometry } from './mesh.js';
import { Rng } from '../core/rng.js';

export const MAX_PAINT = 2000;

const _mat = new Matrix4();
const _pos = new Vector3();
const _scl = new Vector3();
const _quat = new Quaternion();
const _eul = new Euler();

/**
 * Distance gate for the brush. Returns true when the cursor has moved far
 * enough (horizontal distance) since the last drop to place a new instance.
 * Extracted as a pure fn so it can be unit-tested without DOM/WebGPU.
 *
 * @param {{x:number,y:number,z:number}|null} prev  last drop point (world), null if first
 * @param {{x:number,y:number,z:number}} cur        current cursor hit point
 * @param {number} spacing                          minimum horizontal distance in world units
 */
export function shouldDrop(prev, cur, spacing) {
  if (!prev) return true;
  const dx = cur.x - prev.x;
  const dz = cur.z - prev.z;
  return dx * dx + dz * dz >= spacing * spacing;
}

/**
 * Ring-buffer slot index. Wraps around MAX_PAINT so overwriting replaces the
 * oldest instance. Pure fn for testability.
 * @param {number} slot   current slot pointer
 * @param {number} count  how many instances have been placed (for im.count)
 */
export function nextSlot(slot, count) {
  return count < MAX_PAINT ? count : (slot + 1) % MAX_PAINT;
}

/**
 * Pick a variant index for a new paint drop (mirrors scatter.js cycling).
 * @param {import('../core/rng.js').Rng} rng
 * @param {number} variantCount
 */
export function pickVariantIndex(rng, variantCount) {
  return rng.int(0, variantCount - 1);
}

/**
 * @param {object} opts
 * @param {import('three').Scene} opts.scene
 * @param {import('three').Camera} opts.camera
 * @param {import('three').Renderer} opts.renderer
 * @param {() => import('../species/granite.js').RockPreset} opts.getPreset
 * @param {() => import('three').Material} opts.getMaterial
 * @param {() => import('three').Mesh} opts.getTerrain
 */
export class PaintBrush {
  constructor(opts) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.renderer = opts.renderer;
    this.dom = opts.renderer.domElement;
    this.getPreset = opts.getPreset;
    this.getMaterial = opts.getMaterial;
    this.getTerrain = opts.getTerrain;

    this.params = { spacing: 0.3, scaleMin: 0.15, scaleMax: 0.45, randomRot: true };
    this.style = 'pbr';
    this.enabled = false;

    this.ray = new Raycaster();
    this.ndc = new Vector2();
    this.group = new Group();
    this.group.name = 'paint';

    // One InstancedMesh per variant; rebuilt when species changes.
    this.layers = [];
    this.variants = [];
    this.lastDrop = null;     // world point of last placed instance
    this.painting = false;    // pointer currently down

    // Bind once so add/removeEventListener match the same reference.
    this._onDown = this._onPointerDown.bind(this);
    this._onMove = this._onPointerMove.bind(this);
    this._onUp = this._onPointerUp.bind(this);
  }

  get count() {
    return this.layers.reduce((n, layer) => n + layer.count, 0);
  }

  /** Build / rebuild InstancedMeshes for the current species. Clears artwork. */
  setSpecies() {
    this.clear();
    for (const layer of this.layers) {
      this.group.remove(layer.mesh);
      layer.mesh.dispose();
    }
    this.variants.forEach((g) => g.dispose());
    this.layers = [];
    this.variants = [];

    const preset = this.getPreset();
    const mat = this.getMaterial();
    if (!preset || !mat) return;

    const rng = new Rng(`paint:${preset.id}`);
    const detail = preset.lod?.impostor?.detail ?? 2;
    this.variants = [0, 1, 2].map((vi) => {
      const subPreset = {
        ...preset,
        shape: {
          ...preset.shape,
          radius: preset.shape.radius * rng.range(0.85, 1.1),
          detail: Math.max(1, detail),
        },
        noise: {
          ...preset.noise,
          amplitude: preset.noise.amplitude * rng.range(0.8, 1.2),
        },
      };
      const geo = generateRockGeometry(subPreset, `${vi}`, { style: this.style });
      geo.computeBoundingBox();
      return geo;
    });

    // Three.js InstancedMesh can't grow after construction — preallocate the
    // cap per variant and fill slots via setMatrixAt, bumping `count` as we go.
    this.layers = this.variants.map((geo, vi) => {
      const mesh = new InstancedMesh(geo, mat, MAX_PAINT);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `paint_instances_${vi}`;
      this.group.add(mesh);
      return { mesh, slot: 0, count: 0 };
    });
  }

  setParams(p) {
    Object.assign(this.params, p);
  }

  setStyle(style) {
    this.style = style;
  }

  enable() {
    if (this.enabled) return;
    if (!this.layers.length) this.setSpecies();
    this.enabled = true;
    this.dom.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    this.dom.style.cursor = 'crosshair';
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.painting = false;
    this.lastDrop = null;
    this.dom.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    this.dom.style.cursor = '';
  }

  clear() {
    this.lastDrop = null;
    for (const layer of this.layers) {
      layer.slot = 0;
      layer.count = 0;
      layer.mesh.count = 0;
    }
  }

  /** Raycast the terrain under the cursor; returns the hit point or null. */
  _hit(event) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.ndc, this.camera);
    const terrain = this.getTerrain();
    if (!terrain) return null;
    const hits = this.ray.intersectObject(terrain, false);
    return hits.length ? hits[0].point.clone() : null;
  }

  /** Place one instance at a world point (seat against the terrain). */
  _drop(point) {
    if (!this.layers.length) return;
    const { scaleMin, scaleMax, randomRot } = this.params;
    const rng = new Rng(`paint-drop:${this.count}:${point.x.toFixed(3)}:${point.z.toFixed(3)}`);
    const scale = rng.range(scaleMin, scaleMax);
    const vi = pickVariantIndex(rng, this.variants.length);
    const layer = this.layers[vi];

    // Seat: drop the bounding-box bottom to the terrain surface so the rock
    // sits IN the ground rather than hovering. Mirrors scatter.js seating.
    const bbox = this.variants[vi].boundingBox;
    const seatY = bbox ? point.y - bbox.min.y * scale : point.y;

    _pos.set(point.x, seatY, point.z);
    _scl.setScalar(scale);
    if (randomRot) {
      _eul.set(rng.vary(0, 0.25), rng.range(0, Math.PI * 2), rng.vary(0, 0.25));
    } else {
      _eul.set(0, 0, 0);
    }
    _quat.setFromEuler(_eul);
    _mat.compose(_pos, _quat, _scl);

    layer.mesh.setMatrixAt(layer.slot, _mat);
    layer.slot = nextSlot(layer.slot, layer.count);
    layer.count = Math.min(layer.count + 1, MAX_PAINT);
    layer.mesh.count = layer.count;
    layer.mesh.instanceMatrix.needsUpdate = true;
    this.lastDrop = point;
  }

  _onPointerDown(event) {
    if (event.button !== 0) return;     // left only
    this.painting = true;
    const p = this._hit(event);
    if (p) this._drop(p);
  }

  _onPointerMove(event) {
    if (!this.painting) return;
    const p = this._hit(event);
    if (!p) return;
    if (shouldDrop(this.lastDrop, p, this.params.spacing)) {
      this._drop(p);
    }
  }

  _onPointerUp() {
    this.painting = false;
    this.lastDrop = null;
  }

  dispose() {
    this.disable();
    this.variants.forEach((g) => g.dispose());
    for (const layer of this.layers) layer.mesh.dispose();
    this.layers = [];
    this.group.clear();
  }
}
