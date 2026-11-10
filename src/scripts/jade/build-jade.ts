import * as THREE from 'three';
import { createScaleTextures, createTabletTexture } from './procedural-textures';
import { createJadeMaterial } from './jade-material';
import {
  snakePoint,
  snakeTangent,
  snakeCurveAt,
  updateSnakeTube,
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
function loftHead(sections: HeadSection[], radial: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const N = sections.length;
  for (let i = 0; i < N; i += 1) {
    const s = sections[i];
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(s.x, s.cy + Math.cos(a) * s.h, Math.sin(a) * s.w);
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

/**
 * 鳞片样段：在一小段蛇身上生成覆瓦状几何甲片，用于与砖格法线方案做同机位对照。
 * 每片甲片是压扁的半球（8×6 段），沿切线方向重叠 45%、逐行错位半个步距，
 * 尺寸随蛇身半径缩放，方向取"顺着蛇身走"的局部坐标架。
 * 返回单个合并网格，节点名 serpent-scales-sample，便于 Blender 侧单独赋材质或隐藏。
 */
function buildScaleSample(
  curve: THREE.CatmullRomCurve3,
  t0: number,
  t1: number,
  radiusAt: (t: number) => number,
  hi: boolean,
): THREE.Mesh | null {
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const rows = hi ? 26 : 14;      // 沿蛇身
  const cols = hi ? 12 : 8;       // 绕一周
  const segA = hi ? 6 : 4;        // 甲片纵向段数
  const segB = hi ? 5 : 4;        // 甲片横向段数
  const len = curve.getLength();
  const tmpT = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < rows; i += 1) {
    const fi = i / (rows - 1);
    const t = t0 + (t1 - t0) * fi;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    // 外法线取径向（环在 XY 平面上绕原点），再用切向正交化
    tmpN.copy(p).normalize();
    tmpN.sub(tan.clone().multiplyScalar(tmpN.dot(tan))).normalize();
    tmpB.crossVectors(tan, tmpN).normalize();
    const r = radiusAt(t);
    // 甲片长度按弧长给，保证重叠比例稳定：步距 = 弧长/rows，片长 = 步距×1.45
    const step = (len * (t1 - t0)) / rows;
    const plateLen = step * 1.45;
    const plateWid = ((2 * Math.PI * r) / cols) * 1.55;
    const plateHt = r * 0.30;
    for (let j = 0; j < cols; j += 1) {
      // 逐行错位半格：读成覆瓦而不是方格阵
      const phase = ((j + (i % 2) * 0.5) / cols) * Math.PI * 2;
      const radial = tmpN.clone().multiplyScalar(Math.cos(phase)).add(tmpB.clone().multiplyScalar(Math.sin(phase)));
      const centre = p.clone().addScaledVector(radial, r * 0.92);
      const base = pos.length / 3;
      for (let a = 0; a <= segA; a += 1) {
        const u = a / segA;
        // 沿切向：前端薄、后端厚，形成叠压的"檐口"
        const along = (u - 0.5) * plateLen;
        const taper = Math.sin(Math.PI * Math.min(u, 1)) ** 0.55;
        for (let b = 0; b <= segB; b += 1) {
          const w = (b / segB - 0.5) * plateWid;
          const across = Math.sin(Math.PI * Math.min(b / segB, 1)) ** 0.6;
          const lift = plateHt * taper * across;
          v.copy(centre).addScaledVector(tan, along).addScaledVector(tmpB, w).addScaledVector(radial, lift);
          pos.push(v.x, v.y, v.z);
          // 法线近似取径向 + 少量切向倾斜，甲片才有"贴着蛇身"的立体感
          nor.push(radial.x * 0.86 + tan.x * (u - 0.5) * 0.5, radial.y * 0.86 + tan.y * (u - 0.5) * 0.5, radial.z * 0.86 + tan.z * (u - 0.5) * 0.5);
          uvs.push(u, b / segB);
        }
      }
      for (let a = 0; a < segA; a += 1) {
        for (let b = 0; b < segB; b += 1) {
          const q = base + a * (segB + 1) + b;
          idx.push(q, q + 1, q + segB + 1, q + segB + 1, q + 1, q + segB + 2);
        }
      }
    }
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#12402e'),
    roughness: 0.24,
    metalness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
  });
  mat.name = 'mat-serpent-scale';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'serpent-scales-sample';
  return mesh;
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
    transmission: 0.22,
    thickness: 0.5,
    ior: 1.45,
    transparent: true,
    opacity: 0.46,
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
  serpent.rotation.set(0.0, 0.0, 0.0);
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
  for (let i = 0; i <= SEG; i += 1) {
    for (let j = 0; j <= RAD; j += 1) {
      const k = (i * (RAD + 1) + j) * 2;
      bodyUv[k] = (i / SEG) * 20;
      bodyUv[k + 1] = (j / RAD) * 3;
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
  // ---- 鳞片样段（第 4 条：先做局部，再铺满）----
  // 现有方案是砖格法线/颜色（一张 canvas 贴图 + bumpMap），远看是菱形网、近看像编织袋。
  // 这里用几何甲片做对照样段：每片是压扁的半球，沿切线方向重叠 45%、逐行错位半个步距，
  // 尺寸随蛇身半径变化（颈部大、尾部小），方向始终顺着蛇身走向。
  const scales = buildScaleSample(curve, 0.66, 0.80, snakeRadius, hi);
  if (scales) serpent.add(scales);

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
  head.scale.setScalar(0.82);

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
    { x: -0.18, w: 0.126, h: 0.098, cy: 0.006 },
    { x: -0.10, w: 0.146, h: 0.112, cy: 0.010 },
    { x: -0.02, w: 0.148, h: 0.116, cy: 0.012 },
    { x: 0.05, w: 0.138, h: 0.110, cy: 0.008 },
    { x: 0.11, w: 0.118, h: 0.096, cy: 0.002 },
    { x: 0.16, w: 0.096, h: 0.082, cy: -0.004 },
    { x: 0.20, w: 0.070, h: 0.064, cy: -0.010 },
    { x: 0.215, w: 0.052, h: 0.048, cy: -0.014 },
  ];
  const upperJaw = new THREE.Mesh(loftHead(headSections, hi ? 44 : 22), headMat);
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
  const eyeH = 0.1117;
  const eyeW = 0.1409;
  const eyeCy = 0.0092;
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
    color: new THREE.Color('#cfe6d6'),
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
  baseBadge.position.set(0, -1.3, 0.02);
  baseBadge.rotation.x = -0.24;
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
  const tabletMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dfeee0'),
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
  tablet.position.set(0.98, -0.66, 0.58);
  tablet.rotation.set(-0.04, -0.42, 0.06);
  root.add(tablet);

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