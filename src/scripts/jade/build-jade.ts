import * as THREE from 'three';
import { createScaleTextures, createTabletTexture } from './procedural-textures';
import { createJadeMaterial } from './jade-material';

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
 * 蛇身路径：贴着球面绕行一整圈（衔尾），纬度基本恒定在赤道附近并缓慢起伏，
 * 使正面看成一条完整闭合的环，而不是散成两段螺旋。
 */
function serpentCurve(): THREE.CatmullRomCurve3 {
  // 蛇是「贴着球面的外圈」：R=1.14（球 1.0），只比球面外扩一点，
  // 参考图里蛇的外沿几乎与球沿齐平，R 过大就读成悬在远处的呼啦圈。
  // 前后起伏用 z 的正弦给出，一半绕到球后，保留空间关系。
  const pts: THREE.Vector3[] = [];
  const steps = 320;
  const gap = 0.16; // 咬合缺口：只留出吻部宽度，尾尖正好被衔在口中
  const sweep = Math.PI * 2 - gap;
  const R = 1.14;
  const squashY = 0.965;
  const zAmp = 0.10;
  const endAngle = Math.PI * 0.25; // 蛇头落在画面右上 45°
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = endAngle - sweep * (1 - t);
    // 深度按整圈正弦给：两端在缺口处都回到 0，咬合才贴合；
    // 而不是只把整个环转一个角度（那样侧视会塌成一条线）。
    const z = Math.sin(((a - (endAngle - sweep)) / sweep) * Math.PI * 2) * zAmp;
    pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R * squashY, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}

export function buildJadeModel(options: { quality?: 'high' | 'low' } = {}): JadeParts {
  const quality = options.quality ?? 'high';
  const hi = quality === 'high';
  const root = new THREE.Group();
  root.name = 'jade-heng';

  const scaleTex = createScaleTextures('jade');

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
  grad.addColorStop(0, 'rgba(255,246,222,0.95)');
  grad.addColorStop(0.42, 'rgba(255,232,186,0.42)');
  grad.addColorStop(0.72, 'rgba(246,214,160,0.14)');
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
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 36), glowMat);
  glow.name = 'kernel-glow';
  glow.position.set(0, 0.06, 0);
  glow.renderOrder = 5;
  root.add(glow);

  // 3. 衔尾蛇
  const serpent = new THREE.Group();
  serpent.name = 'ouroboros';
  serpent.rotation.set(0.0, 0.0, 0.0);
  const curve = serpentCurve();
  // t=0 是尾端（收细到 0.020 以便入口），t=1 是颈端（0.132，与头部颈径衔接）
  const bodyGeo = taperedTube(curve, (t) => 0.022 + 0.086 * Math.pow(Math.min(t * 1.7, 1), 0.65), hi ? 460 : 230, hi ? 44 : 26);
  bodyGeo.scale(1, 1, 1);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c9a05e'),
    bumpMap: scaleTex.bump,
    bumpScale: 0.32,
    roughness: 0.28,
    metalness: 0.72,
    envMapIntensity: 2.6,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
  });
  bodyMat.name = 'mat-serpent';
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'serpent-body';
  serpent.add(body);

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
  const tip = curve.getPointAt(1);
  const fwd = curve.getTangentAt(1).normalize();

  // 颈套筒：沿蛇身切向反向延伸的短管，盖住 taperedTube 的端面，消除头身之间的直角台阶
  const neckGeo = new THREE.CylinderGeometry(0.106, 0.096, 0.30, 28, 1, false);
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
  head.position.copy(tip);
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
  const headSections: HeadSection[] = [
    { x: -0.46, w: 0.104, h: 0.074, cy: 0.012 },
    { x: -0.36, w: 0.146, h: 0.098, cy: 0.010 },
    { x: -0.26, w: 0.164, h: 0.106, cy: 0.006 },
    { x: -0.14, w: 0.170, h: 0.108, cy: 0.000 },
    { x: -0.02, w: 0.172, h: 0.106, cy: -0.006 },
    { x: 0.08, w: 0.158, h: 0.098, cy: -0.010 },
    { x: 0.16, w: 0.134, h: 0.086, cy: -0.014 },
    { x: 0.24, w: 0.106, h: 0.072, cy: -0.018 },
    { x: 0.30, w: 0.080, h: 0.058, cy: -0.022 },
    { x: 0.34, w: 0.054, h: 0.044, cy: -0.026 },
    { x: 0.37, w: 0.028, h: 0.030, cy: -0.030 },
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

  // 嘴缝：沿每段截面的最大宽度线走，半径略小于表面内缩量，只露出一条细暗线
  const seamR = 0.008;
  const seamPts: THREE.Vector3[] = [];
  for (const s of headSections) {
    if (s.x < -0.24) continue;
    seamPts.push(new THREE.Vector3(s.x, s.cy - s.h * 0.06, s.w - seamR + 0.004));
  }
  if (seamPts.length > 2) {
    const seamCurve = new THREE.CatmullRomCurve3(seamPts);
    for (const side of [1, -1]) {
      const seamGeo = new THREE.TubeGeometry(seamCurve, hi ? 72 : 40, seamR, 8, false);
      const seam = new THREE.Mesh(seamGeo, seamMat);
      seam.name = 'serpent-mouthline-' + (side > 0 ? 'l' : 'r');
      seam.scale.z = side;
      head.add(seam);
    }
  }

  // 鼻孔：吻背两侧各一个小凹坑
  for (const side of [1, -1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), seamMat);
    nostril.name = 'serpent-nostril-' + (side > 0 ? 'l' : 'r');
    nostril.position.set(0.275, 0.014, 0.030 * side);
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
  const eyeX = 0.06;
  const eyeH = 0.0996;
  const eyeW = 0.1608;
  const eyeCy = -0.0092;
  const theta = 1.14;
  for (const side of [1, -1]) {
    const ey = eyeCy + Math.cos(theta) * eyeH;
    const ez = Math.sin(theta) * eyeW * side;
    const n = new THREE.Vector3(0, Math.cos(theta) / eyeH, (Math.sin(theta) / eyeW) * side).normalize();
    const pos = new THREE.Vector3(eyeX, ey, ez);

    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.048, 24, 18), socketMat);
    socket.name = 'serpent-eye-socket-' + (side > 0 ? 'l' : 'r');
    socket.position.copy(pos).addScaledVector(n, -0.016);
    head.add(socket);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 26, 20), eyeMat);
    eye.name = 'serpent-eye-' + (side > 0 ? 'l' : 'r');
    eye.position.copy(pos).addScaledVector(n, 0.006);
    head.add(eye);

    // 竖瞳：沿法线前移的扁椭球，给眼球一个明确的视觉中心
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 18, 14), socketMat);
    pupil.name = 'serpent-pupil-' + (side > 0 ? 'l' : 'r');
    pupil.position.copy(pos).addScaledVector(n, 0.030);
    pupil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    pupil.scale.set(1, 1.9, 0.5);
    head.add(pupil);

    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 12, 24, Math.PI * 1.15), lidMat);
    lid.name = 'serpent-eye-lid-' + (side > 0 ? 'l' : 'r');
    lid.position.copy(pos).addScaledVector(n, 0.010);
    // 把弧片缺口转到下方，读成上眼睑而不是整圈垫圈
    lid.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    lid.rotateZ(Math.PI * 0.925);
    head.add(lid);
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
    roughness: 0.26,
    metalness: 0.95,
    envMapIntensity: 3.4,
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
  tick.position.set(1.038, 0.0, 0.0);
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
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.028, hi ? 64 : 32), plinthMat);
  disc.rotation.x = Math.PI / 2;
  baseBadge.add(disc);
  const discInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.098, 0.03, hi ? 64 : 32),
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
  const tabletGeo = new THREE.BoxGeometry(0.24, 0.36, 0.03, 2, 2, 1);
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

  return { root, shell, kernel, serpent, axis, copperRing, baseBadge, tablet, stars, relief };
}

export function jadePartNames(parts: JadeParts): string[] {
  const names: string[] = [];
  parts.root.traverse((obj) => {
    if (obj.name) names.push(obj.name);
  });
  return names;
}