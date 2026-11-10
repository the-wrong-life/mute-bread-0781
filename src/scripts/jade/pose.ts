import * as THREE from 'three';

/**
 * 玉衡 · 衔尾蛇姿态函数（唯一动作依据）
 *
 * 设计约束（对应本轮验收要求）：
 * - 所有随时间变化的项都以 2π/T 为角频率的整数倍出现，因此 t 与 t+T 姿态完全重合，循环无缝。
 * - 路径是解析函数，可被 Three.js 实时预览、GLB 导出与 Blender 动画脚本按同一公式求值，
 *   不依赖任何一方的缓存状态，避免"网页和后端动作不一致"。
 * - u=0 是尾尖、u=1 是颈端；缺口 gap 恒定，尾尖始终停在吻部内侧，衔尾关系不随时间断开。
 */

/** 循环周期（秒）。用户要求第一批 6–10 秒，取 8 秒。 */
export const LOOP_SECONDS = 8;

/** 咬合缺口（弧度）。只留出吻部宽度。 */
export const GAP = 0.16;

/** 蛇环基准半径：球半径 1.0，蛇外沿几乎与球沿齐平。 */
export const BASE_RADIUS = 1.16;

const END_ANGLE = Math.PI * 0.25;
const SWEEP = Math.PI * 2 - GAP;
const SQUASH_Y = 0.965;

/**
 * 蛇身半径：尾尖 0.020 收细入口，颈部 0.110 与头部衔接。
 *
 * 教训：旧式 `0.022 + 0.086 * min(u*1.7,1)^0.65` 在 u>0.59 之后恒为 0.108，
 * 整条蛇有 40% 的长度是等粗，正向看就是一根塑料管/呼啦圈。必须全段连续变化。
 */
export function snakeRadius(u: number): number {
  const t = Math.min(Math.max(u, 0), 1);
  return 0.024 + 0.104 * Math.pow(t, 0.55);
}

/** 时间相位：把秒换成 0–1 的循环相位。 */
function phase(time: number): number {
  const p = (time % LOOP_SECONDS) / LOOP_SECONDS;
  return p < 0 ? p + 1 : p;
}

/**
 * 姿态求值：把 (u, time) 映射到世界坐标点。
 *
 * 三类运动叠加：
 * 1. 沿身体的纵向行波（头→尾传播），表现为蛇身缓慢起伏，头和尾通过同一条波联动；
 * 2. 环半径的呼吸（两倍频），让外轮廓不是死圆；
 * 3. 绕环轴的轻微进动，给出三维姿态变化（侧视也能看出前后错动）。
 */
export function snakePoint(u: number, time: number, out = new THREE.Vector3()): THREE.Vector3 {
  const ph = phase(time);
  const a = END_ANGLE - SWEEP * (1 - u);
  const s = (a - (END_ANGLE - SWEEP)) / SWEEP; // 0 尾 → 1 颈

  // 半径呼吸：两倍频，幅度小，避免轮廓抖动
  const breath = 0.026 * Math.sin(Math.PI * 4 * s - Math.PI * 2 * ph + 0.7);
  const r = BASE_RADIUS + breath;

  // 环面内的角度偏移：让蛇身在环上"缓慢游动"
  const drift = 0.018 * Math.sin(Math.PI * 2 * ph + Math.PI * 2 * s);
  const ang = a + drift;

  // 纵向行波：沿身体传播的起伏，振幅 0.05，两倍频
  const wave = 0.05 * Math.sin(Math.PI * 2 * (2 * s - ph));
  // 基础深度：两端在缺口处回到 0，衔尾贴合；再加一层时间项做前后错动
  const depth = Math.sin(s * Math.PI * 2) * 0.10 + 0.022 * Math.sin(Math.PI * 2 * (s + ph));

  const x = Math.cos(ang) * r;
  const y = Math.sin(ang) * r * SQUASH_Y + wave;
  const z = depth;

  // 整体轻微进动：绕 X 轴摆一个很小的角度（等价于环面缓慢侧倾）
  const tilt = 0.035 * Math.sin(Math.PI * 2 * ph);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return out.set(x, y * ct - z * st, y * st + z * ct);
}

/** 切向：中心差分，比单侧差分稳定。 */
export function snakeTangent(u: number, time: number, out = new THREE.Vector3()): THREE.Vector3 {
  const h = 1e-3;
  const u0 = Math.max(0, u - h);
  const u1 = Math.min(1, u + h);
  const p0 = snakePoint(u0, time, new THREE.Vector3());
  const p1 = snakePoint(u1, time, new THREE.Vector3());
  return out.subVectors(p1, p0).normalize();
}

/** 头部额外摆动：颈端绕"上"方向小幅转头，幅度 0.10 rad。 */
export function headYaw(time: number): number {
  return 0.10 * Math.sin(Math.PI * 2 * phase(time) + 0.4);
}

/** 铜环摆转角度（弧度）。慢速、幅度小，始终可辨认它是环。 */
export function ringSwing(time: number): number {
  return 0.055 * Math.sin(Math.PI * 2 * phase(time) * 1 + 1.1);
}

/** 内核亮度系数：0.92–1.08 的柔和明暗，不做闪烁。 */
export function kernelPulse(time: number): number {
  return 1 + 0.08 * Math.sin(Math.PI * 2 * phase(time) * 2);
}

/** 整体悬浮高度。 */
export function bodyFloat(time: number): number {
  return 0.032 * Math.sin(Math.PI * 2 * phase(time) * 1 + 0.2);
}

export interface SnakeTubeTargets {
  positions: Float32Array;
  normals: Float32Array;
  tubularSegments: number;
  radialSegments: number;
}

/**
 * 原地重建管体顶点。拓扑不变，只改 position/normal，因此不需要重建 BufferGeometry，
 * 也不会产生新的显存分配（每帧只做数值计算）。
 *
 * 坐标架用平行传输而不是 Frenet：Frenet 在曲率近零处会翻转，蛇身会出现整段扭麻花。
 */
export function updateSnakeTube(target: SnakeTubeTargets, time: number): void {
  const { positions, normals, tubularSegments: N, radialSegments: M } = target;
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const prevN = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // 初值：任取一个与切向不平行的向量做正交化
  snakeTangent(0, time, t);
  prevN.set(0, 1, 0);
  if (Math.abs(prevN.dot(t)) > 0.9) prevN.set(0, 0, 1);
  prevN.sub(tmp.copy(t).multiplyScalar(prevN.dot(t))).normalize();

  for (let i = 0; i <= N; i += 1) {
    const u = i / N;
    snakePoint(u, time, p);
    snakeTangent(u, time, t);

    // 平行传输：把上一帧的法向投影到当前截面上
    n.copy(prevN).sub(tmp.copy(t).multiplyScalar(prevN.dot(t)));
    if (n.lengthSq() < 1e-9) {
      n.set(0, 1, 0).sub(tmp.copy(t).multiplyScalar(t.y));
    }
    n.normalize();
    prevN.copy(n);
    b.crossVectors(t, n).normalize();

    const r = snakeRadius(u);
    for (let j = 0; j <= M; j += 1) {
      const v = (j / M) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * n.x + sin * b.x;
      const ny = cos * n.y + sin * b.y;
      const nz = cos * n.z + sin * b.z;
      const k = (i * (M + 1) + j) * 3;
      positions[k] = p.x + r * nx;
      positions[k + 1] = p.y + r * ny;
      positions[k + 2] = p.z + r * nz;
      normals[k] = nx;
      normals[k + 1] = ny;
      normals[k + 2] = nz;
    }
  }
}

/** 与 updateSnakeTube 同一套取值的静态曲线，供腹鳞、鳞片样段等附属件初始化使用。 */
export function snakeCurveAt(time: number, steps = 320): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    pts.push(snakePoint(i / steps, time));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}
