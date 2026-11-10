import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { buildJadeModel, type JadeParts } from './build-jade';
import { LOOP_SECONDS } from './pose';

export interface JadeViewerHandle {
  dispose: () => void;
  exportGLB: () => Promise<ArrayBuffer>;
  setQuality: (q: 'high' | 'low') => void;
  orbitTo: (view: 'front' | 'side' | 'back') => void;
  setPaused: (paused: boolean) => void;
  isPaused: () => boolean;
  /** 按指定时间求值姿态，用于逐帧导出与离线渲染对齐 */
  poseAt: (time: number) => void;
  loopSeconds: number;
}

const VIEWS: Record<string, number> = { front: 0, side: Math.PI / 2, back: Math.PI };

/** 程序化影棚环境：柔和顶光 + 深墨绿地色，避免点状高光把玉球照成塑料球。 */
function makeStudioEnvironment(): THREE.Texture {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8fa596');
  sky.addColorStop(0.18, '#6b8574');
  sky.addColorStop(0.36, '#4a6455');
  sky.addColorStop(0.54, '#2c4038');
  sky.addColorStop(0.74, '#1a2a24');
  sky.addColorStop(1, '#0e1714');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // 顶部主光带
  const key = ctx.createRadialGradient(w * 0.34, h * 0.08, 4, w * 0.34, h * 0.08, w * 0.3);
  key.addColorStop(0, 'rgba(255,248,228,0.16)');
  key.addColorStop(1, 'rgba(255,252,240,0)');
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, w, h);
  // 侧向补光
  const fill = ctx.createRadialGradient(w * 0.82, h * 0.34, 4, w * 0.82, h * 0.34, w * 0.22);
  fill.addColorStop(0, 'rgba(176,208,192,0.4)');
  fill.addColorStop(1, 'rgba(200,224,214,0)');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 屏幕背景：中心暖白向四周深墨绿收拢，给透射材质提供可穿透的亮底 */
function makeBackdrop(): THREE.Texture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.5, size * 0.44, size * 0.02, size * 0.5, size * 0.5, size * 0.74);
  g.addColorStop(0, '#1d3a2f');
  g.addColorStop(0.32, '#152b23');
  g.addColorStop(0.64, '#0f1f19');
  g.addColorStop(0.85, '#0a1611');
  g.addColorStop(1, '#070f0c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
  // 1.82 只框住玉球本体，衔尾蛇环（R 1.14 + 管径 0.11）与铜环在 /lab 里被切出画面。
  // 用户第 1 条要求旋转查看整体，因此取景半径必须覆盖整个装配。
  const FIT_RADIUS = 2.20;
  const FIT_CENTER_Y = -0.06;

  /** 依据视口宽高比计算能完整容纳模型的相机距离，避免窄屏或宽屏裁切。 */
  function fitDistance(aspect: number) {
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fov = Math.min(vFov, hFov);
    return (FIT_RADIUS / Math.sin(fov / 2)) * 1.04;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.36;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envEquirect = makeStudioEnvironment();
  const envRT = pmrem.fromEquirectangular(envEquirect);
  scene.environment = envRT.texture;
  // 背景交给页面 CSS 渐变，canvas 保持透明，避免出现一块深色方块边界
  const backdrop = makeBackdrop();

  // 球后柔光：给透射材质提供亮源，玉体才会泛起暖白内光
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 256; haloCanvas.height = 256;
  const hctx = haloCanvas.getContext('2d')!;
  const hg = hctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  hg.addColorStop(0, 'rgba(255,250,232,0.55)');
  hg.addColorStop(0.3, 'rgba(232,244,222,0.3)');
  hg.addColorStop(0.62, 'rgba(150,204,170,0.08)');
  hg.addColorStop(1, 'rgba(120,180,150,0)');
  hctx.fillStyle = hg;
  hctx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(haloCanvas),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(3.4, 3.4, 1);
  halo.position.set(0.05, 0.12, -1.35);
  scene.add(halo);

  // 球后柔光箱：必须是网格（Sprite 不进入透射采样缓冲），玉体透射时才有亮源
  const sbCanvas = document.createElement('canvas');
  sbCanvas.width = 512; sbCanvas.height = 512;
  const sb = sbCanvas.getContext('2d')!;
  const sg = sb.createRadialGradient(256, 250, 8, 256, 256, 250);
  sg.addColorStop(0, 'rgba(255,252,240,0.95)');
  sg.addColorStop(0.28, 'rgba(255,246,220,0.62)');
  sg.addColorStop(0.58, 'rgba(228,240,214,0.24)');
  sg.addColorStop(0.82, 'rgba(180,214,190,0.05)');
  sg.addColorStop(1, 'rgba(160,200,175,0)');
  sb.fillStyle = sg;
  sb.fillRect(0, 0, 512, 512);
  const softboxTex = new THREE.CanvasTexture(sbCanvas);
  softboxTex.colorSpace = THREE.SRGBColorSpace;
  const softbox = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({
      map: softboxTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  softbox.name = 'softbox-backlight';
  softbox.position.set(0.0, 0.02, -1.16);
  scene.add(softbox);

  // 灯光：主光（暖）+ 补光（冷）+ 顶部轮廓
  const key = new THREE.DirectionalLight(0xfff6e8, 0.85);
  key.position.set(3.4, 2.4, 3.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe8f2ff, 2.1);
  rim.position.set(-3.4, 1.2, -2.6);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xf8fff8, 0x7fa38c, 2.2);
  scene.add(fill);
  const snakeFill = new THREE.DirectionalLight(0xdff0e2, 2.0);
  snakeFill.position.set(-1.6, 2.2, 5.0);
  scene.add(snakeFill);
  const rimWarm = new THREE.DirectionalLight(0xfff0d0, 3.2);
  rimWarm.position.set(1.8, 2.2, -3.6);
  scene.add(rimWarm);

  const core = new THREE.PointLight(0xffcf8c, 22.0, 7.0, 2);
  core.position.set(0, 0, 0);
  scene.add(core);

  const parts: JadeParts = buildJadeModel({ quality: 'high' });
  // 开发期自检钩子：/lab 控制台可直接查看各部件世界坐标与材质，便于定位"部件消失"这类问题。
  (window as unknown as { __jadeParts?: unknown; __jadeCamera?: unknown }).__jadeParts = parts;
  (window as unknown as { __jadeCamera?: unknown }).__jadeCamera = camera;
  // 球壳需要环境倒影，把影棚环境图直接交给玉质着色器
  const shellShader = parts.shell.material as THREE.ShaderMaterial;
  if (shellShader.uniforms?.uEnv) shellShader.uniforms.uEnv.value = envEquirect;
  scene.add(parts.root);


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
  let paused = false;
  let motionClock = 0;
  let dprCap = 1.75;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) {
    // 系统要求减少动态效果：不自动旋转，并停在循环起点姿态上静态展示
    controls.autoRotate = false;
    paused = true;
    parts.updatePose(0);
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
  // 减少动态效果时至少渲染一帧，避免只看到空白画布
  renderer.render(scene, camera);
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
    if (!paused) {
      // 全部运动部件由 pose.ts 的同一套公式驱动；网页、GLB 与 Blender 共用这个时间基准
      parts.updatePose(t);
      parts.stars.rotation.y = t * 0.045;
      motionClock = t;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  function setRunning(next: boolean) {
    running = next;
    if (!next) controls.autoRotate = false;
  }

  /** 暂停/继续动作。暂停时定格在当前姿态，仍可拖动旋转查看结构。 */
  function setPaused(next: boolean) {
    paused = next;
    if (next) {
      controls.autoRotate = false;
    }
  }

  function isPaused() {
    return paused;
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
    // 自定义 ShaderMaterial 无法写入 glTF 材质名，导出前临时换成 PBR 近似材质，
    // 否则 Blender 侧找不到 mat-jade-shell，玉球会变成一块白球。
    const shellShader = parts.shell.material as THREE.MeshPhysicalMaterial;
    const proxy = new THREE.MeshPhysicalMaterial({
      name: 'mat-jade-shell',
      color: new THREE.Color('#8fd6b4'),
      roughness: 0.07,
      metalness: 0,
      transmission: 0.55,
      thickness: 0.6,
      ior: 1.52,
      attenuationColor: new THREE.Color('#4fbf94'),
      attenuationDistance: 2.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
    });
    parts.shell.material = proxy;
    try {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(parts.root, { binary: true, onlyVisible: true });
      return result as ArrayBuffer;
    } finally {
      parts.shell.material = shellShader;
      proxy.dispose();
    }
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
    backdrop.dispose();
    softboxTex.dispose();
    (softbox.material as THREE.MeshBasicMaterial).dispose();
    (softbox.geometry as THREE.BufferGeometry).dispose();
    (halo.material as THREE.SpriteMaterial).map?.dispose();
    (halo.material as THREE.SpriteMaterial).dispose();
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
  return { dispose, exportGLB, setQuality, orbitTo, setPaused, isPaused, poseAt: (time: number) => parts.updatePose(time), loopSeconds: LOOP_SECONDS };
}