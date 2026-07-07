import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toonOutlinePass } from 'three/tsl';
import { RenderPipeline } from 'three/webgpu';
import { createToonPipeline } from '../src/render/toon-pipeline.js';

test('toonOutlinePass is exported from three/tsl (not THREE namespace)', () => {
  assert.equal(typeof toonOutlinePass, 'function');
});

test('createToonPipeline wires RenderPipeline + toonOutlinePass', () => {
  const renderer = { toneMapping: 0, outputColorSpace: 'srgb' };
  const scene = { isScene: true };
  const camera = { isCamera: true };
  const pipeline = createToonPipeline(renderer, scene, camera);
  assert.ok(pipeline instanceof RenderPipeline);
  assert.ok(pipeline.outputNode, 'outputNode should be set');
});
