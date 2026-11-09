import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildJadeModel, type JadeParts } from './build-jade';

export interface JadeViewerHandle {
  dispose: () => void;
  exportGLB: () => Promise<ArrayBuffer>;
  setQuality: (q: 'high' | 'low') => void;
  orbitTo: (view: 'front' | 'side' | 'back') => void;
}

const VIEWS: Record<string, number> = { front: 0, side: Math.PI / 2, back: Math.PI };

export function mountJadeViewer(root: HTMLElement): JadeViewerHandle | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    root.dataset.renderer = 'failed';
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.25, 8.6);
  const FIT_RADIUS = 1.78;
  const FIT_CENTER_Y = -0.12;

  /** 依据视口宽高比计算能完整容纳模型的相机距离，避免窄屏或宽屏裁切。 */
  function fitDistance(aspect: number) {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fov = Math.min(vFov, hFov);
    return (FIT_RADIUS / Math.sin(fov / 2)) * 1.04;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  // 灯光：主光（暖）+ 补光（冷）+ 顶部轮廓
  const key = new THREE.DirectionalLight(0xfff2d8, 2.1);
  key.position.set(3.2, 4.4, 3.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe6ff, 1.25);
  rim.position.set(-3.6, 1.6, -2.8);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xfff6e4, 0x2a3a30, 0.9);
  scene.add(fill);
  const core = new THREE.PointLight(0xffe6b0, 3.2, 6, 2);
  core.position.set(0, 0, 0);
  scene.add(core);

  const parts: JadeParts = buildJadeModel({ quality: 'high' });
  scene.add(parts.root);

  // 柔和投影：地面圆盘阴影
  const shadowPlane = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 64),
    new THREE.MeshBasicMaterial({ color: 0x8fa894, transparent: true, opacity: 0.16 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.72;
  scene.add(shadowPlane);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 5.4;
  controls.maxDistance = 14;
  controls.target.set(0, FIT_CENTER_Y, 0);
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.82;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  let running = true;
  let dprCap = 1.75;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) {
    controls.autoRotate = false;
    running = false;
  }

  function applySize() {
    const rect = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const want = fitDistance(camera.aspect);
    const dist = camera.position.length();
    if (Math.abs(dist - want) > 0.05) {
      camera.position.setLength(want);
      controls.update();
    }
  }

  applySize();
  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(root);

  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let acc = 0;
  let fps = 60;

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    frames += 1;
    if (acc >= 1) {
      fps = frames / acc;
      frames = 0;
      acc = 0;
      if (fps < 42 && dprCap > 1) {
        dprCap = Math.max(1, dprCap - 0.25);
        applySize();
      }
    }
    if (!running) return;
    const t = now / 1000;
    parts.root.position.y = Math.sin(t * 0.6) * 0.035;
    parts.serpent.rotation.z = Math.sin(t * 0.22) * 0.06;
    parts.stars.rotation.y = t * 0.06;
    parts.kernel.scale.setScalar(1 + Math.sin(t * 1.1) * 0.02);
    controls.update();
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function setRunning(next: boolean) {
    running = next;
    if (!next) controls.autoRotate = false;
  }

  function onVisibility() {
    setRunning(!document.hidden && !reduced.matches);
  }
  document.addEventListener('visibilitychange', onVisibility);

  function orbitTo(view: 'front' | 'side' | 'back') {
    const target = VIEWS[view] ?? 0;
    const radius = fitDistance(camera.aspect);
    const start = Math.atan2(camera.position.x, camera.position.z);
    const delta = target - start;
    let n = 0;
    const steps = 30;
    const from = camera.position.clone();
    function step() {
      n += 1;
      const k = n / steps;
      const angle = start + delta * k;
      camera.position.set(Math.sin(angle) * radius, FIT_CENTER_Y + 0.3, Math.cos(angle) * radius);
      camera.lookAt(0, FIT_CENTER_Y, 0);
      if (n < steps) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  async function exportGLB(): Promise<ArrayBuffer> {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(parts.root, { binary: true, onlyVisible: true });
    return result as ArrayBuffer;
  }

  function setQuality(q: 'high' | 'low') {
    dprCap = q === 'high' ? 1.75 : 1;
    applySize();
  }

  function dispose() {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    controls.dispose();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    parts.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }

  root.dataset.renderer = 'ready';
  return { dispose, exportGLB, setQuality, orbitTo };
}
