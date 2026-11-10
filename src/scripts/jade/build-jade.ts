import * as THREE from 'three';
import { createScaleTextures, createTabletTexture } from './procedural-textures';
import { createJadeMaterial } from './jade-material';
import {
  snakePoint,
  snakeTangent,
  snakeCurveAt,
  updateSnakeTube,
  updateSnakeScales,
  buildScaleIndex,
  buildScaleUv,
  SCALE_VERT_COUNT,
  snakeRadius,
  headYaw,
  ringSwing,
  kernelPulse,
  bodyFloat,
  type SnakeTubeTargets,
} from './pose';

export interface JadeParts {
  root: THREE.Group;
  shell: THREE.Mesh;
  kernel: THREE.Mesh;
  serpent: THREE.Group;
  axis: THREE.Group;
  copperRing: THREE.Mesh;
  baseBadge: THREE.Group;
  tablet: THREE.Mesh;
  stars: THREE.Group;
  relief: THREE.Mesh;
  /** 按时间求值并原地更新全部运动部件。网页预览与导出共用同一姿态函数（见 pose.ts）。 */
  updatePose: (time: number) => void;
}

/** 变半径管：沿曲线生成半径渐变的蛇身 */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusAt: (t: number) => number,
  tubularSegments = 220,
  radialSegments = 20,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const frames = curve.computeFrenetFrames(tubularSegments, true);

  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;
    const P = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radialSegments; j += 1) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      positions.push(P.x + r * nx, P.y + r * ny, P.z + r * nz);
      normals.push(nx, ny, nz);
      // 鳞片密度：沿蛇身一圈约 40 段、周向 6 段；UV 直接按"片数"给，
      // 这样 Blender 侧砖格纹理 scale=1 就能出整齐鳞片，而不是被拉成细条纹。
      uvs.push(t * 20, (j / radialSegments) * 3);
    }
  }
  for (let i = 1; i <= tubularSegments; i += 1) {
    for (let j = 1; j <= radialSegments; j += 1) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1);
      const b = (radialSegments + 1) * i + (j - 1);
      const c = (radialSegments + 1) * i + j;
      const d = (radialSegments + 1) * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

type HeadSection = { x: number; w: number; h: number; cy: number };

/**
 * 沿 +X 轴放样一组椭圆截面，用于蛇头上/下颌这类楔形形体。
 * 球+锥的拼接读不出蛇头轮廓，放样才能同时给出吻部收窄、上颌拱起与颈部过渡。
 */
function loftHead(
  sections: HeadSection[],
  radial: number,
  crease?: { cosY: number; band: number; depth: number },
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const N = sections.length;
  for (let i = 0; i < N; i += 1) {
    const s = sections[i];
    // 嘴缝只从第二个截面开始，头部后端保持光滑；越靠吻端越深。
    const w = i <= 1 ? 0 : Math.min(1, (i - 1) / 3);
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      let y = s.cy + Math.cos(a) * s.h;
      let z = Math.sin(a) * s.w;
      if (crease && w > 0) {
        // 沿"绕头一圈"的高度方向压一道凹槽：不新增网格、不靠贴图，
        // 任何光照角度都会在嘴线处产生自体阴影，这是小尺寸下最可靠的可读性来源。
        const d = Math.abs(Math.cos(a) - crease.cosY);
        if (d < crease.band) {
          const k = (1 - d / crease.band) * w * crease.depth;
          y -= Math.cos(a) * k;
          z -= Math.sin(a) * k;
        }
      }
      pos.push(s.x, y, z);
      uvs.push(i / (N - 1), j / radial);
    }
  }
  for (let i = 0; i < N - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // 绕序必须是 (a, a+1, b)：反过来法线全部朝内，吻端在渲染里就成了"空心管口"
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // 首尾封口，避免 GLB 里留下开放边
  for (const cap of [0, N - 1]) {
    const s = sections[cap];
    const center = pos.length / 3;
    pos.push(s.x, s.cy, 0);
    uvs.push(cap / (N - 1), 0.5);
    for (let j = 0; j < radial; j += 1) {
      const a = cap * (radial + 1) + j;
      if (cap === 0) indices.push(center, a + 1, a);
      else indices.push(center, a, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 按 x 在放样截面上线性插值，避免改 headSections 后忘记重算眼位。 */
function sampleHead(sections: HeadSection[], x: number): { w: number; h: number; cy: number } {
  for (let i = 0; i < sections.length - 1; i += 1) {
    const a = sections[i];
    const b = sections[i + 1];
    if (x <= b.x) {
      const t = (x - a.x) / Math.max(b.x - a.x, 1e-6);
      return {
        w: a.w + (b.w - a.w) * t,
        h: a.h + (b.h - a.h) * t,
        cy: a.cy + (b.cy - a.cy) * t,
      };
    }
  }
  const last = sections[sections.length - 1];
  return { w: last.w, h: last.h, cy: last.cy };
}

export function buildJadeModel(options: { quality?: 'high' | 'low' } = {}): JadeParts {
  const quality = options.quality ?? 'high';
  const hi = quality === 'high';
  const root = new THREE.Group();
  root.name = 'jade-heng';

  const scaleTex = createScaleTextures('gold');

  // 1. 青玉球壳
  const shellGeo = new THREE.SphereGeometry(1, hi ? 128 : 64, hi ? 96 : 48);
  const shellMat = createJadeMaterial();
  shellMat.name = 'mat-jade-shell';
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.name = 'jade-shell';
  shell.castShadow = true;
  shell.renderOrder = 6;
  root.add(shell);

  // 1b. 内壁：略小的背面子壳，制造玉壁厚度与边缘散射
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8dbfa8'),
    roughness: 0.28,
    metalness: 0,
    transmission: 0.7,
    thickness: 0.2,
    ior: 1.4,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.3,
    attenuationColor: new THREE.Color('#2f6f57'),
    attenuationDistance: 1.6,
  });
  innerMat.name = 'mat-jade-inner';
  const innerShell = new THREE.Mesh(new THREE.SphereGeometry(0.995, hi ? 64 : 32, hi ? 48 : 24), innerMat);
  innerShell.name = 'jade-shell-inner';
  innerShell.visible = false;

  // 1b-2. 内层玉胎（用户第 1 条"多层玉质结构"）：外壳之内再一层更实的青玉，
  // 让视线穿过外壳时能看到"第二层壁"，而不是一眼看穿到一个空球。
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5fa98a'),
    roughness: 0.34,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.5,
    ior: 1.45,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    attenuationColor: new THREE.Color('#2c6b52'),
    attenuationDistance: 1.4,
    envMapIntensity: 0.7,
  });
  coreMat.name = 'mat-jade-core';
  const innerCore = new THREE.Mesh(new THREE.SphereGeometry(0.74, hi ? 72 : 36, hi ? 56 : 28), coreMat);
  innerCore.name = 'jade-inner-core';
  innerCore.renderOrder = 3;
  root.add(innerCore);

  // 2. 暖白内核
  const kernelGeo = new THREE.SphereGeometry(0.16, hi ? 72 : 36, hi ? 56 : 28);
  const kernelMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffdf6'),
    emissive: new THREE.Color('#ffe6b8'),
    emissiveIntensity: 1.5,
    envMapIntensity: 0.4,
    roughness: 0.55,
    metalness: 0,
    transmission: 0.18,
    thickness: 0.5,
  });
  kernelMat.name = 'mat-kernel';
  const kernel = new THREE.Mesh(kernelGeo, kernelMat);
  kernel.name = 'default-kernel';
  kernel.position.set(0, 0.06, 0);
  root.add(kernel);

  // 2b. 玻璃珍珠：参考图的球心是一颗能反光的珠子，不是一个发光豆。
  // 半径取 0.20（直径 0.40，约占球半径 1/5，与参考图 110px/560px 一致），
  // 内核 0.16 被它包住，光从珠内透出来；高光靠 clearcoat + 低粗糙度打出小亮点。
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffdf4'),
    roughness: 0.04,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.3,
    ior: 1.47,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
    emissive: new THREE.Color('#fff1d0'),
    emissiveIntensity: 0.28,
  });
  pearlMat.name = 'mat-kernel-glass';
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.20, hi ? 64 : 32, hi ? 48 : 24), pearlMat);
  pearl.name = 'jade-pearl';
  pearl.position.set(0, 0.06, 0);
  pearl.renderOrder = 4;
  root.add(pearl);

  // 1c. 光晕：包裹内核的加法混合球，让白光向外柔和衰减，
  // 否则内核在玉壳里是硬边白圆盘，读不出"珠中有光"。
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gctx = glowCanvas.getContext('2d')!;
  const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,242,214,0.72)');
  grad.addColorStop(0.34, 'rgba(255,226,176,0.30)');
  grad.addColorStop(0.66, 'rgba(246,210,152,0.09)');
  grad.addColorStop(1, 'rgba(240,206,150,0.0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.BackSide,
  });
  glowMat.name = 'mat-kernel-glow';
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.40, 40, 30), glowMat);
  glow.name = 'kernel-glow';
  glow.position.set(0, 0.06, 0);
  glow.renderOrder = 5;
  root.add(glow);

  // 3. 衔尾蛇
  const serpent = new THREE.Group();
  serpent.name = 'ouroboros';
  const SERPENT_TILT = 0.55;
  // 轨道平面必须相对镜头倾斜：rotation 为 (0,0,0) 时蛇身环几乎侧对镜头、只绕球边缘，
  // 参考图里的环是斜跨球面（近端压在球前面、远端绕到球后）。TILT 把整圈绕 X 轴抬起来。
  serpent.rotation.set(SERPENT_TILT, 0.0, 0.0);
  const curve = snakeCurveAt(0);
  // t=0 是尾端（收细到 0.022 以便入口），t=1 是颈端（0.108，与头部颈径衔接）。
  // 管体用固定拓扑 + 每帧原地重算顶点：Frenet 帧在曲率近零处会翻转，
  // 静态建几何时看不出来，一旦沿时间连续变形就会整段扭麻花，所以改用平行传输（见 pose.ts）。
  const SEG = hi ? 300 : 170;
  const RAD = hi ? 32 : 22;
  const vCount = (SEG + 1) * (RAD + 1);
  const bodyPos = new Float32Array(vCount * 3);
  const bodyNor = new Float32Array(vCount * 3);
  const bodyUv = new Float32Array(vCount * 2);
  // UV 必须按物理尺度铺，不能按参数尺度：旧写法 u=t*20、v=j*3 让"管长 : 周长"约 6:1，
  // 方形砖格因此被拉成 6 倍长条——Scale 小看不出甲片、Scale 大整条变金点，怎么调都不收敛。
  // 这里按弧长（≈2πR）与当地周长（2πr(t)）取同一套 UV 密度，甲片才是正方形。
  const SNAKE_ARC = 2 * Math.PI * 1.14;
  const PLATES_PER_UNIT = 16;
  for (let i = 0; i <= SEG; i += 1) {
    const t = i / SEG;
    const ringLen = 2 * Math.PI * snakeRadius(t);
    for (let j = 0; j <= RAD; j += 1) {
      const k = (i * (RAD + 1) + j) * 2;
      bodyUv[k] = t * SNAKE_ARC * PLATES_PER_UNIT;
      bodyUv[k + 1] = (j / RAD) * ringLen * PLATES_PER_UNIT;
    }
  }
  const bodyIdx: number[] = [];
  for (let i = 1; i <= SEG; i += 1) {
    for (let j = 1; j <= RAD; j += 1) {
      const a = (RAD + 1) * (i - 1) + (j - 1);
      const b = (RAD + 1) * i + (j - 1);
      const c = (RAD + 1) * i + j;
      const d = (RAD + 1) * (i - 1) + j;
      bodyIdx.push(a, b, d, b, c, d);
    }
  }
  const tubeTarget: SnakeTubeTargets = {
    positions: bodyPos,
    normals: bodyNor,
    tubularSegments: SEG,
    radialSegments: RAD,
  };
  updateSnakeTube(tubeTarget, 0);
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyPos, 3));
  bodyGeo.setAttribute('normal', new THREE.BufferAttribute(bodyNor, 3));
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(bodyUv, 2));
  bodyGeo.setIndex(bodyIdx);
  bodyGeo.computeBoundingSphere();
  // 参考图的衔尾蛇是「金铜底 + 青玉甲片」，不是全绿蛇。
  // 关键教训：深绿蛇身压在深绿玉球上，在首页尺寸下完全读不出来（环直接消失）。
  // 所以底色必须回到金铜，青色只作为甲片浮雕存在。
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c39a56'),
    map: scaleTex.map,
    bumpMap: scaleTex.bump,
    bumpScale: 0.38,
    roughness: 0.34,
    // 教训：金属完全靠环境图出亮度。viewer 的环境图是压暗版，
    // metalness 0.78 的金蛇在这套环境里直接渲染成近黑色，正面看像是蛇环消失了。
    metalness: 0.42,
    envMapIntensity: 1.9,
    emissive: new THREE.Color('#3a2a10'),
    emissiveIntensity: 0.22,
    clearcoat: 0.22,
    clearcoatRoughness: 0.18,
  });
  bodyMat.name = 'mat-serpent';
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'serpent-body';
  serpent.add(body);
  // ---- 覆瓦鳞片：铺满全身的几何甲片 ----
  // 结论来自两轮对照：砖格 UV（金缝 + 青玉甲片）在正常观看距离只会读成编织袋/鱼网，
  // 缝隙越亮越像绳编；而几何甲片即使简化成 4x4 方格网也能读成鳞。
  // 因此这里不再是"样段"，而是整条蛇身：72 行 x 10 列 = 720 片，每片 18 个三角面，
  // 合计约 1.3 万三角面（远低于手机预算），固定拓扑原地重算，动画时不重建几何。
  const scalePos = new Float32Array(SCALE_VERT_COUNT * 3);
  const scaleNor = new Float32Array(SCALE_VERT_COUNT * 3);
  const scaleGeo = new THREE.BufferGeometry();
  scaleGeo.setAttribute('position', new THREE.BufferAttribute(scalePos, 3));
  scaleGeo.setAttribute('normal', new THREE.BufferAttribute(scaleNor, 3));
  scaleGeo.setAttribute('uv', new THREE.BufferAttribute(buildScaleUv(), 2));
  scaleGeo.setIndex(buildScaleIndex());
  updateSnakeScales(scalePos, scaleNor, 0);
  scaleGeo.computeBoundingSphere();
  // 甲片是青玉，蛇身底色是金铜：参考图的蛇正是"金铜底 + 青玉甲片"，
  // 纯青玉蛇压在青玉球上首页尺寸下会直接消失（前一版的实际结果）。
  const scaleMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2f7a58'),
    roughness: 0.24,
    metalness: 0.3,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
    envMapIntensity: 2.1,
  });
  scaleMat.name = 'mat-serpent-scale';
  const scales = new THREE.Mesh(scaleGeo, scaleMat);
  scales.name = 'serpent-scales';
  serpent.add(scales);

  // 腹鳞：沿内侧的一条薄带
  const bellyCurvePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const t = 0.06 + (0.82 * i) / 40;
    const p = curve.getPointAt(t);
    bellyCurvePts.push(p.clone().multiplyScalar(0.965));
  }
  const bellyCurve = new THREE.CatmullRomCurve3(bellyCurvePts);
  const bellyGeo = taperedTube(bellyCurve, (t) => 0.036 * (1 - 0.5 * t), 96, 12);
  const bellyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f0dcae'),
    roughness: 0.24,
    metalness: 0.9,
    emissive: new THREE.Color('#5e4a2a'),
    emissiveIntensity: 0.1,
  });
  bellyMat.name = 'mat-serpent-belly';
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.name = 'serpent-belly';
  // 腹鳞管在离线渲染里会被读成"第二根环"，与蛇身轮廓冲突，默认隐藏；
  // 节点保留以便将来用位移或法线表达腹鳞。
  belly.visible = false;
  serpent.add(belly);

  // ---- 蛇头 ----
  // 用户验收点：正面与四分之三要能读出"蛇"，必须同时有吻部、上颌、下颌、眼窝与颈部过渡。
  // 球+锥的组装做不到这一点（上一版读成"鸭嘴/勺头"），这里改为沿 +X 轴放样的楔形头。
  const head = new THREE.Group();
  head.name = 'serpent-head';
  const tip = snakePoint(1, 0);
  const fwd = snakeTangent(1, 0);

  // 颈套筒：沿蛇身切向反向延伸的短管，盖住 taperedTube 的端面，消除头身之间的直角台阶
  const neckGeo = new THREE.CylinderGeometry(0.113, 0.104, 0.20, 28, 1, false);
  neckGeo.rotateX(Math.PI / 2);
  const neck = new THREE.Mesh(neckGeo, bodyMat);
  neck.name = 'serpent-neck';
  neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.clone().negate());
  neck.position.copy(tip).addScaledVector(fwd, -0.06);
  root.add(neck);
  // 以球面外法线作"上"，让蛇头沿切线方向前探，背脊朝球外。
  // 基向量必须是右手系（X×Y=Z）：旧写法 sideV=up×fwd、upV=fwd×sideV 得到 X×Y=-Z，
  // 行列式 -1，setFromRotationMatrix 对镜像矩阵给出反向旋转，吻部会朝切线反方向。
  const up = tip.clone().normalize();
  const upV = up.clone().sub(fwd.clone().multiplyScalar(up.dot(fwd))).normalize();
  const sideV = new THREE.Vector3().crossVectors(fwd, upV).normalize();
  // 吻端在局部 x=0.23×0.82=0.189，尾尖距头原点 0.196，差 0.025 → 只是"相接"。
  // 前移 0.025 让吻端越过尾尖 0.018，视觉上才是"衔住"而不是"碰到"。
  head.position.copy(tip).addScaledVector(fwd, 0.025);
  head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, upV, sideV));
  // 头部整体缩到与收细后的蛇身匹配（原建模按蛇身半径 0.134 设计，现为 0.05）
  head.scale.setScalar(1.06);

  const headMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b08a4e'),
    roughness: 0.28,
    metalness: 0.62,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
    envMapIntensity: 2.4,
    side: THREE.DoubleSide,
  });
  headMat.name = 'mat-serpent-head';

  // 蛇头改为"单一闭合放样体 + 压出的嘴缝"：
  // 上下颌各做一块半壳再贴合，接缝在任何角度都读成"蚌壳/夹板"，这是前面几版失败的根因。
  // 这里只放样一个实心头，嘴线用一条几乎与表面相切的细管压出暗缝。
  // 比例校核（局部坐标，整体再乘 head.scale 0.82）：
  // 头长 0.47（x −0.24…0.23）、最大宽 0.296、最大高 0.232 → 长宽比 1.6:1，接近真实蛇首；
  // 上一版长 0.83、宽 0.344，长宽比 2.4:1 且 z 向远宽于 y 向，放大后读成"扁楔/勺子"。
  // 颈部截面 0.208 × 0.180 略细于蛇身直径 0.216，让头部从蛇身里自然长出来。
  const headSections: HeadSection[] = [
    { x: -0.24, w: 0.104, h: 0.090, cy: 0.004 },
    { x: -0.18, w: 0.128, h: 0.100, cy: 0.006 },
    { x: -0.10, w: 0.150, h: 0.114, cy: 0.010 },
    { x: -0.02, w: 0.152, h: 0.118, cy: 0.012 },
    { x: 0.05, w: 0.142, h: 0.112, cy: 0.008 },
    { x: 0.11, w: 0.124, h: 0.100, cy: 0.002 },
    { x: 0.16, w: 0.104, h: 0.088, cy: -0.002 },
    { x: 0.20, w: 0.082, h: 0.070, cy: -0.004 },
    { x: 0.225, w: 0.062, h: 0.054, cy: -0.006 },
  ];
  // 嘴缝：cos(a) = −0.30 对应截面下三分之一处，band 0.22 给出一道窄槽。
  const upperJaw = new THREE.Mesh(
    loftHead(headSections, hi ? 44 : 22, { cosY: -0.30, band: 0.26, depth: 0.030 }),
    headMat,
  );
  upperJaw.name = 'serpent-upper-jaw';
  head.add(upperJaw);

  const seamMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a1a10'),
    roughness: 0.85,
    metalness: 0.0,
  });
  seamMat.name = 'mat-serpent-mouth';

  // 旧方案（沿颌线铺一根细管）已删除：CatmullRom 在凸起的头面上会在中段切进、两端浮出，
  // 灰模里读成"一根粘在颌骨上的棍子"。改为在吻端做真正的张口：深色锥筒，尾尖从筒口进入。
  // 张口尺寸须大于"尾尖相对口心的径向偏距"，又不能大到读成套喇叭（上一版 0.046/0.020 就翻成喇叭了）。
  // 口内径按"尾尖相对口心的径向偏距"反推：实测该偏距随姿态在 0.028–0.037 之间变化，
  // 取外沿 0.042 / 内沿 0.038 才让尾尖始终落在口沿之内，读成"衔住"而不是"擦着唇边"。
  const gapeGeo = new THREE.CylinderGeometry(0.042, 0.038, 0.055, 18, 1, true);
  gapeGeo.rotateZ(-Math.PI / 2); // 圆柱轴 Y → +X（吻端方向）
  const gape = new THREE.Mesh(gapeGeo, seamMat);
  gape.name = 'serpent-mouth-gape';
  gape.material.side = THREE.DoubleSide;
  gape.position.set(0.226, -0.010, 0);
  head.add(gape);

  // 鼻孔：吻背两侧各一个小凹坑
  for (const side of [1, -1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), seamMat);
    nostril.name = 'serpent-nostril-' + (side > 0 ? 'l' : 'r');
    nostril.position.set(0.185, 0.006, 0.024 * side);
    nostril.scale.set(1, 0.7, 1);
    head.add(nostril);
  }

  // 头冠：金铜脊片，沿头顶排开
  const crestMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9b06a'),
    roughness: 0.24,
    metalness: 0.95,
    envMapIntensity: 2.4,
  });
  crestMat.name = 'mat-serpent-crest';
  // 头冠脊片在灰模里读成"悬空的扁剑"，参考图蛇头也没有这个结构，先不保留；
  // 头顶质感交给鳞片与金铜嵌线表达。
  void crestMat;

  // 眼窝 / 眼球 / 眼睑：按所在表面的椭球法线对齐，眼球不再埋在头里
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1f6f4c'),
    emissive: new THREE.Color('#0d3b28'),
    emissiveIntensity: 0.6,
    roughness: 0.10,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  eyeMat.name = 'mat-eye';
  const socketMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#123a2b'),
    roughness: 0.62,
    metalness: 0.0,
  });
  socketMat.name = 'mat-eye-socket';
  const lidMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b8874a'),
    roughness: 0.30,
    metalness: 0.9,
    envMapIntensity: 2.0,
  });
  lidMat.name = 'mat-eye-lid';

  // 眼位与法线都算在 x=0.02 处的截面上，θ=0.66 rad 让眼睛落在头侧上方
  // 眼位必须跟着 headSections 插值重算，否则眼球会浮在头外（上一版就浮过）。
  // x=0.03 落在 (−0.02, 0.148/0.116/0.012) 与 (0.05, 0.138/0.110/0.008) 之间，t=0.714。
  const eyeX = 0.03;
  const eyeSec = sampleHead(headSections, eyeX);
  const eyeH = eyeSec.h;
  const eyeW = eyeSec.w;
  const eyeCy = eyeSec.cy;
  const theta = 1.02;
  for (const side of [1, -1]) {
    const ey = eyeCy + Math.cos(theta) * eyeH;
    const ez = Math.sin(theta) * eyeW * side;
    const n = new THREE.Vector3(0, Math.cos(theta) / eyeH, (Math.sin(theta) / eyeW) * side).normalize();
    const pos = new THREE.Vector3(eyeX, ey, ez);

    // 眼组必须小而深：0.048 的窝 + 0.034 的眼球从 1.35 倍焦距看是"贴在头侧的蜗牛壳"
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.030, 24, 18), socketMat);
    socket.name = 'serpent-eye-socket-' + (side > 0 ? 'l' : 'r');
    socket.position.copy(pos).addScaledVector(n, -0.022);
    head.add(socket);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 26, 20), eyeMat);
    eye.name = 'serpent-eye-' + (side > 0 ? 'l' : 'r');
    eye.position.copy(pos).addScaledVector(n, 0.001);
    head.add(eye);

    // 竖瞳：沿法线前移的扁椭球，给眼球一个明确的视觉中心
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.011, 18, 14), socketMat);
    pupil.name = 'serpent-pupil-' + (side > 0 ? 'l' : 'r');
    pupil.position.copy(pos).addScaledVector(n, 0.019);
    pupil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    pupil.scale.set(1, 1.9, 0.5);
    head.add(pupil);

    // 眉脊：参考图蛇首有明显的眉弓，缺了它头就只是一个光滑楔形
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.021, 20, 14), headMat);
    brow.name = 'serpent-brow-' + (side > 0 ? 'l' : 'r');
    brow.position.set(0.004, eyeCy + eyeH * 0.58, eyeW * 0.40 * side);
    brow.scale.set(1.7, 0.45, 1.0);
    brow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    head.add(brow);

    // 颊窝：下颌后侧的内凹处，用一块略暗的小椭球压出阴影
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.026, 18, 12), socketMat);
    cheek.name = 'serpent-cheek-' + (side > 0 ? 'l' : 'r');
    cheek.position.set(-0.085, eyeCy - eyeH * 0.34, eyeW * 0.72 * side);
    cheek.scale.set(1.5, 0.9, 0.35);
    head.add(cheek);

    // 眼睑弧片已删除：在球面上贴一段缺口圆环，任何角度都读成"蜗牛壳"。
    // 改为让眼窝凹坑与眉脊在球体边缘自然形成上眼睑的阴影。
  }

    serpent.add(head);
  root.add(serpent);

  // 4. 竖直玉轴
  const axis = new THREE.Group();
  axis.name = 'jade-axis';
  const shaftGeo = new THREE.CylinderGeometry(0.042, 0.042, 2.44, hi ? 32 : 16);
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#cfe3d4'),
    roughness: 0.2,
    transmission: 0.5,
    thickness: 0.4,
    ior: 1.5,
    metalness: 0,
    clearcoat: 1,
  });
  shaftMat.name = 'mat-jade-axis';
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.name = 'axis-shaft';
  axis.add(shaft);
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c39a56'),
    roughness: 0.19,
    metalness: 1,
    envMapIntensity: 2.2,
  });
  goldMat.name = 'mat-gold';
  for (const y of [1.1, -1.1]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.09, hi ? 32 : 16), goldMat);
    collar.name = 'axis-collar-' + (y > 0 ? 'top' : 'bottom');
    collar.position.y = y;
    axis.add(collar);
    for (let i = 0; i < 2; i += 1) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.007, 8, hi ? 48 : 24), goldMat);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = y + (i === 0 ? -0.022 : 0.022);
      axis.add(groove);
    }
  }
  root.add(axis);

  // 5. 倾斜铜环（绕到球体背后）
  // 参考图的铜环是"宽扁测量带"而不是细圆环：用开口圆柱面做带子
  // 用 Lathe 生成矩形截面的实体环：有内外壁、上下环面与自然倒角，
  // 取代原先的「开口圆柱侧面」（薄片无厚度，近看边缘是毛边）。
  // 截面用圆角矩形：内壁 1.052、外壁 1.112（球半径 1.0，环壁离球面约 0.05），
  // 上下各 0.042 厚，四角 r=0.012 倒角，近看边缘有连续高光而不是纸片毛边。
  const ringInner = 1.005;
  const ringOuter = 1.105;
  const ringHalf = 0.065;
  const ringCham = 0.012;
  const ringProfile: THREE.Vector2[] = [];
  const arcPts = 4;
  const corner = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= arcPts; i += 1) {
      const a = a0 + (a1 - a0) * (i / arcPts);
      ringProfile.push(new THREE.Vector2(cx + Math.cos(a) * ringCham, cy + Math.sin(a) * ringCham));
    }
  };
  // 从内壁下倒角起，逆时针绕一圈（内壁 → 上 → 外壁 → 下）
  corner(ringInner + ringCham, -ringHalf + ringCham, Math.PI, Math.PI * 1.5);
  corner(ringOuter - ringCham, -ringHalf + ringCham, Math.PI * 1.5, Math.PI * 2);
  corner(ringOuter - ringCham, ringHalf - ringCham, 0, Math.PI * 0.5);
  corner(ringInner + ringCham, ringHalf - ringCham, Math.PI * 0.5, Math.PI);
  ringProfile.push(ringProfile[0].clone());
  const bandGeo = new THREE.LatheGeometry(ringProfile, hi ? 220 : 128);
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c99a52'),
    roughness: 0.30,
    metalness: 0.55,
    envMapIntensity: 2.6,
    emissive: new THREE.Color('#4a3210'),
    emissiveIntensity: 0.3,
  });
  ringMat.name = 'mat-copper-ring';
  ringMat.side = THREE.DoubleSide;
  const copperRing = new THREE.Mesh(bandGeo, ringMat);
  copperRing.name = 'copper-ring';
  // 环面相对像平面倾斜 49°：投影短长轴比 = cos(49°) ≈ 0.66，正面是清楚的斜向椭圆。
  // 曾试 25°/30°（比值 0.91/0.87）投影接近正圆，与「清楚斜向椭圆」的验收不符。
  copperRing.rotation.set(Math.PI / 2 - 0.855, 0.0, -0.18);
  copperRing.scale.set(1, 1, 1);
  copperRing.castShadow = true;
  root.add(copperRing);

  // 环面刻度：细齿沿圆周分布，形成测量环语汇
  const tickMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0d3a0'), roughness: 0.16, metalness: 1, envMapIntensity: 2.2 });
  tickMat.name = 'mat-copper-tick';
  const tickGeo = new THREE.BoxGeometry(0.008, 0.045, 0.007);

  // 刻度块：沿铜环的游标
  const tick = new THREE.Group();
  tick.name = 'copper-vernier';
  const tickBlock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), goldMat);
  tick.add(tickBlock);
  const tickFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.115, 0.02),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f6d5c'), roughness: 0.35, metalness: 0.4 }),
  );
  tickFace.position.z = 0.066;
  tick.add(tickFace);
  // 游标原本在 +X 位置，正好落在右上蛇头旁边，读成"漂浮的小金疙瘩"；挪到左下空档
  tick.position.set(-0.90, -0.52, 0.0);
  tick.rotation.z = Math.PI / 2;
  copperRing.add(tick);

  // 6. 底部徽章
  const baseBadge = new THREE.Group();
  baseBadge.name = 'base-badge';
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#8fc7ae'),
    roughness: 0.16,
    transmission: 0.34,
    thickness: 0.4,
    ior: 1.5,
    clearcoat: 0.8,
  });
  plinthMat.name = 'mat-plinth';
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.134, 0.024, hi ? 64 : 32), plinthMat);
  disc.rotation.x = Math.PI / 2;
  baseBadge.add(disc);
  const discInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.028, hi ? 64 : 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#9c7a4a'), roughness: 0.38, metalness: 0.9 }),
  );
  discInner.rotation.x = Math.PI / 2;
  baseBadge.add(discInner);
  const emblem = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.011, 12, hi ? 64 : 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8d3a4'), roughness: 0.3, metalness: 0.9 }),
  );
  baseBadge.add(emblem);
  // 教训：y=-1.3 时底徽悬在球下方 0.3，读成"吊坠"；贴到球底（-1.02）才像底座
  baseBadge.position.set(0, -1.02, 0.02);
  baseBadge.rotation.x = -0.2;
  root.add(baseBadge);

  // 7. 右侧辛巳玉牌
  // 玉牌不能是一张方卡片：做成圆角、带倒角厚度的小玉牌，边缘有收进的光
  const tabletShape = new THREE.Shape();
  const tw = 0.115;
  const th = 0.175;
  const tr = 0.026;
  tabletShape.moveTo(-tw + tr, -th);
  tabletShape.lineTo(tw - tr, -th);
  tabletShape.quadraticCurveTo(tw, -th, tw, -th + tr);
  tabletShape.lineTo(tw, th - tr);
  tabletShape.quadraticCurveTo(tw, th, tw - tr, th);
  tabletShape.lineTo(-tw + tr, th);
  tabletShape.quadraticCurveTo(-tw, th, -tw, th - tr);
  tabletShape.lineTo(-tw, -th + tr);
  tabletShape.quadraticCurveTo(-tw, -th, -tw + tr, -th);
  const tabletGeo = new THREE.ExtrudeGeometry(tabletShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.007,
    bevelSegments: hi ? 3 : 1,
    curveSegments: hi ? 10 : 5,
  });
  tabletGeo.center();
  // ExtrudeGeometry 的默认 UV 是"模型单位"而不是 0..1，直接贴图只会采到左下角一小块（渲成十字纹）。
  // 这里按法线重新铺 UV：正反面按 x/y 归一化，侧壁按周长/厚度铺。
  {
    const pos = tabletGeo.attributes.position;
    const nor = tabletGeo.attributes.normal;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      const nx = nor.getX(i);
      const ny = nor.getY(i);
      const nz = nor.getZ(i);
      if (Math.abs(nz) >= 0.5) {
        uvs[i * 2] = pos.getX(i) / (2 * tw) + 0.5;
        uvs[i * 2 + 1] = pos.getY(i) / (2 * th) + 0.5;
      } else {
        uvs[i * 2] = (Math.atan2(nx, ny) / Math.PI) * 0.5 + 0.5;
        uvs[i * 2 + 1] = pos.getZ(i) / 0.05 + 0.5;
      }
    }
    tabletGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  const tabletMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b9e0c9'),
    map: createTabletTexture('辛', '巳'),
    roughness: 0.22,
    transmission: 0.28,
    thickness: 0.3,
    clearcoat: 1,
    ior: 1.5,
  });
  tabletMat.name = 'mat-tablet';
  const tablet = new THREE.Mesh(tabletGeo, tabletMat);
  tablet.name = 'xin-si-tablet';
  // 参考图的辛巳牌坠在蛇环右下方外侧，牌面朝观众、长轴顺半径向外；离环太远会读成"浮在空中的绿卡片"，
  // 所以外沿半径取 1.16（环 1.14），并用一枚金环把牌顶与蛇环连起来。
  const tabletAngle = -Math.PI * 0.30;
  const tabletR = 1.16;
  tablet.position.set(Math.cos(tabletAngle) * tabletR, Math.sin(tabletAngle) * tabletR, 0.55);
  tablet.rotation.set(-0.05, -0.30, tabletAngle + Math.PI / 2);
  root.add(tablet);

  const tabletLink = new THREE.Mesh(
    new THREE.TorusGeometry(0.034, 0.011, 10, hi ? 24 : 12),
    ringMat,
  );
  tabletLink.name = 'tablet-link';
  tabletLink.position.set(Math.cos(tabletAngle) * (tabletR - 0.20), Math.sin(tabletAngle) * (tabletR - 0.20), 0.55);
  tabletLink.rotation.set(Math.PI / 2, 0, tabletAngle + Math.PI / 2);
  root.add(tabletLink);

  // 8. 七星刻纹
  const stars = new THREE.Group();
  stars.name = 'seven-stars';
  const bigDipper: Array<[number, number]> = [
    [-0.52, 0.2],
    [-0.36, 0.42],
    [-0.14, 0.5],
    [0.04, 0.34],
    [0.1, 0.12],
    [0.3, 0.04],
    [0.46, 0.16],
  ];
  const starMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6d3a0'),
    emissive: new THREE.Color('#b8945c'),
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.2,
  });
  starMat.name = 'mat-star';
  bigDipper.forEach(([u, v], i) => {
    const dir = new THREE.Vector3(u, v, Math.sqrt(Math.max(0.04, 1 - u * u - v * v))).normalize();
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.010 + (i === 3 ? 0.002 : 0), 12, 9), starMat);
    star.name = 'star-' + (i + 1);
    star.position.copy(dir.multiplyScalar(1.028));
    stars.add(star);
  });
  root.add(stars);

  // 9. 武曲浮雕（贴在球壳右上的一枚小浮雕盘）
  const reliefGeo = new THREE.CylinderGeometry(0.108, 0.108, 0.020, hi ? 48 : 24);
  const reliefMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9c391'),
    roughness: 0.3,
    metalness: 0.92,
  });
  reliefMat.name = 'mat-relief';
  const relief = new THREE.Mesh(reliefGeo, reliefMat);
  relief.name = 'wugu-relief';
  const dir = new THREE.Vector3(0.62, 0.62, 0.48).normalize();
  relief.position.copy(dir.clone().multiplyScalar(0.99));
  relief.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  root.add(relief);
  const reliefGlyph = new THREE.Mesh(
    new THREE.TorusGeometry(0.058, 0.012, 10, 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#8f6a3c'), roughness: 0.45, metalness: 0.8 }),
  );
  reliefGlyph.position.copy(dir.clone().multiplyScalar(1.006));
  reliefGlyph.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  root.add(reliefGlyph);

  // ---- 时间驱动：网页预览、GLB 导出与 Blender 动画共用 pose.ts 的同一套公式 ----
  const RING_BASE_X = Math.PI / 2 - 0.855;
  const RING_BASE_Z = -0.18;
  const AXIS_Z = new THREE.Vector3(0, 0, 1);
  const pTip = new THREE.Vector3();
  const pFwd = new THREE.Vector3();
  const pUp = new THREE.Vector3();
  const pUpV = new THREE.Vector3();
  const pSideV = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  function updatePose(time: number) {
    // 1) 蛇身顶点原地重算（拓扑不变，无新显存分配）
    updateSnakeTube(tubeTarget, time);
    const posAttr = bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const norAttr = bodyGeo.getAttribute('normal') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    bodyGeo.computeBoundingSphere();

    // 1b) 甲片跟着同一套取样走：否则蛇身一动，鳞片还留在上一帧的管面上
    updateSnakeScales(scalePos, scaleNor, time);
    (scaleGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (scaleGeo.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
    scaleGeo.computeBoundingSphere();

    // 2) 颈端姿态：颈部与蛇头必须跟着同一套取样走，否则动起来就脱开
    snakePoint(1, time, pTip);
    snakeTangent(1, time, pFwd);
    neck.quaternion.setFromUnitVectors(AXIS_Z, pFwd.clone().negate());
    neck.position.copy(pTip).addScaledVector(pFwd, -0.06);

    pUp.copy(pTip).normalize();
    pUpV.copy(pUp).sub(pFwd.clone().multiplyScalar(pUp.dot(pFwd))).normalize();
    pSideV.crossVectors(pFwd, pUpV).normalize();
    head.position.copy(pTip).addScaledVector(pFwd, 0.025);
    head.quaternion.setFromRotationMatrix(basis.makeBasis(pFwd, pUpV, pSideV));
    // 头颈轻微摆动：绕本地上轴小角度转头，幅度 0.10 rad，不破坏衔尾
    head.rotateY(headYaw(time));

    // 3) 铜环缓慢摆转（幅度小，始终可辨认是环）
    const swing = ringSwing(time);
    copperRing.rotation.set(RING_BASE_X + swing * 0.35, 0, RING_BASE_Z + swing);
    // 4) 内核柔和明暗（不做闪烁）
    const kp = kernelPulse(time);
    kernel.scale.setScalar(kp);
    glow.scale.setScalar(kp * 1.02);
    kernelMat.emissiveIntensity = 1.5 * kp;

    // 5) 整体轻微悬浮
    root.position.y = bodyFloat(time);
  }

  updatePose(0);

  return { root, shell, kernel, serpent, axis, copperRing, baseBadge, tablet, stars, relief, updatePose };
}

export function jadePartNames(parts: JadeParts): string[] {
  const names: string[] = [];
  parts.root.traverse((obj) => {
    if (obj.name) names.push(obj.name);
  });
  return names;
}