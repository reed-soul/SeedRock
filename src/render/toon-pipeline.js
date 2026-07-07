import { RenderPipeline, Color } from 'three/webgpu';
import { toonOutlinePass } from 'three/tsl';

/**
 * Post-processing pipeline for toon style: cel-shaded scene + ink outline.
 * Uses three/tsl `toonOutlinePass` (not on the THREE namespace in three@0.184).
 *
 * @param {import('three').WebGPURenderer} renderer
 * @param {import('three').Scene} scene
 * @param {import('three').Camera} camera
 */
export function createToonPipeline(renderer, scene, camera) {
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = toonOutlinePass(scene, camera, new Color(0, 0, 0), 0.004, 1.0);
  return pipeline;
}
