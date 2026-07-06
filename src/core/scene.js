import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * @param {HTMLElement} container
 * @returns {Promise<{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGPURenderer, controls: OrbitControls, backend: string }>}
 */
export async function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d24);
  scene.fog = new THREE.Fog(0x1a1d24, 18, 55);

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 200);
  camera.position.set(4.2, 2.8, 5.5);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  await renderer.init();

  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2 (fallback)';

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1.1, 0);
  controls.minDistance = 1.5;
  controls.maxDistance = 25;
  controls.update();

  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.position.set(6, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  scene.add(new THREE.HemisphereLight(0xb8c8e8, 0x3a3530, 0.85));
  scene.add(new THREE.AmbientLight(0x404550, 0.25));

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(12, 24, 0x3a4048, 0x2a2e34);
  grid.position.y = 0.001;
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
    dispose() {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      controls.dispose();
    },
  };
}
