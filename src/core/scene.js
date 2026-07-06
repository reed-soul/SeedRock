import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildSky } from './sky.js';
import { buildTerrain } from './terrain.js';

/**
 * @param {HTMLElement} container
 * @param {{ forceWebGL?: boolean }} [opts]
 */
async function initRenderer(container, opts = {}) {
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    forceWebGL: opts.forceWebGL ?? false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  await renderer.init();
  return renderer;
}

/**
 * @param {HTMLElement} container
 * @returns {Promise<{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGPURenderer, controls: OrbitControls, backend: string, grid: THREE.GridHelper }>}
 */
export async function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4a5a6e);
  scene.fog = new THREE.Fog(0x4a5a6e, 20, 88);

  const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.05, 200);
  camera.position.set(9.4, 4.8, 10.8);

  let renderer;
  let backend;
  try {
    renderer = await initRenderer(container, { forceWebGL: false });
    backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  } catch (webgpuErr) {
    console.warn('[SeedRock] WebGPU init failed, falling back to WebGL2:', webgpuErr);
    try {
      renderer = await initRenderer(container, { forceWebGL: true });
      backend = 'WebGL2 (fallback)';
    } catch (webglErr) {
      throw new Error(`WebGPU: ${webgpuErr.message}\nWebGL2: ${webglErr.message}`);
    }
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 2.5, -2.2);
  controls.minDistance = 2.5;
  controls.maxDistance = 42;
  controls.update();

  scene.add(buildSky());

  const sun = new THREE.DirectionalLight(0xffe6c8, 3.1);
  sun.position.set(14, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.028;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -6, near: 0.5, far: 55 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb8c8e8, 0.55);
  fill.position.set(-8, 5, -6);
  scene.add(fill);

  scene.add(new THREE.HemisphereLight(0xd0dff5, 0x3a3028, 0.95));
  scene.add(new THREE.AmbientLight(0x505868, 0.18));

  scene.add(buildTerrain({ seed: 3310 }));

  const grid = new THREE.GridHelper(24, 48, 0x5a6478, 0x3a4048);
  grid.position.y = 0.015;
  grid.visible = false;
  scene.add(grid);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    controls,
    backend,
    grid,
    dispose() {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      controls.dispose();
    },
  };
}
