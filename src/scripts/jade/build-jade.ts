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

/**
 * 蛇身路径：贴着球面绕行一整圈（衔尾），纬度基本恒定在赤道附近并缓慢起伏，
 * 使正面看成一条完整闭合的环，而不是散成两段螺旋。
 */
function serpentCurve(): THREE.CatmullRomCurve3 {
  // 蛇身是绕球的「外圈轮廓」：环面基本面向相机（XY 平面），半径明显大于球（1.26 > 1.0），
  // 这样主相机能看到一圈完整的外环，而不是横穿球体的横杆。
  // 前后起伏用 z 的正弦给出，让下半圈绕到球体背后，保留空间关系。
  const pts: THREE.Vector3[] = [];
  const steps = 320;
  const gap = 0.38; // 咬合缺口，蛇头咬住尾尖
  const sweep = Math.PI * 2 - gap;
  const R = 1.26;
  const squashY = 0.965;
  const zAmp = 0.24;
  const endAngle = Math.PI * 0.25; // 蛇头落在画面右上 45°
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = endAngle - sweep * (1 - t);
    const z = Math.sin(a - 0.45) * zAmp;
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
  const kernelGeo = new THREE.SphereGeometry(0.48, hi ? 72 : 36, hi ? 56 : 28);
  const kernelMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffdf6'),
    emissive: new THREE.Color('#ffe6b8'),
    emissiveIntensity: 2.4,
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

  // 3. 衔尾蛇
  const serpent = new THREE.Group();
  serpent.name = 'ouroboros';
  serpent.rotation.set(0.0, 0.0, 0.0);
  const curve = serpentCurve();
  const bodyGeo = taperedTube(curve, (t) => 0.132 - 0.038 * Math.pow(t, 2.0), hi ? 460 : 230, hi ? 44 : 26);
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

  // 蛇头
  const head = new THREE.Group();
  head.name = 'serpent-head';
  const tip = curve.getPointAt(1);
  const fwd = curve.getTangentAt(1).normalize();
  // 以球面外法线作"上"，让蛇头平贴在球面上，只朝切线方向前瞻，
  // 否则 setFromUnitVectors 只对齐 X 轴，头会随机翻滚躺平。
  const up = tip.clone().normalize();
  const sideV = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const upV = new THREE.Vector3().crossVectors(fwd, sideV).normalize();
  head.position.copy(tip);
  head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, upV, sideV));

  const skullGeo = new THREE.SphereGeometry(0.152, hi ? 48 : 24, hi ? 36 : 18);
  const skull = new THREE.Mesh(skullGeo, bodyMat);
  // 蛇头不能是扁球：横向再拉长、竖向压薄、宽度收窄，吻部才有探出感
  skull.scale.set(1.85, 0.86, 0.98);
  skull.name = 'serpent-skull';
  head.add(skull);

  // 吻部：向前拉出的锥体，让头有"咬合"指向而不是圆球
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.086, 0.40, hi ? 32 : 18), bodyMat);
  snout.name = 'serpent-snout';
  snout.position.set(0.245, -0.004, 0);
  snout.rotation.z = -Math.PI / 2;
  snout.scale.set(1, 1, 0.72);
  head.add(snout);

  // 头冠：金铜脊片
  const crestMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9b06a'),
    roughness: 0.24,
    metalness: 0.95,
    envMapIntensity: 2.4,
  });
  crestMat.name = 'mat-serpent-crest';
  for (let i = 0; i < 3; i += 1) {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.034, 0.014 + i * 0.008), crestMat);
    crest.name = 'serpent-crest-' + i;
    crest.position.set(-0.02 - i * 0.05, 0.072, 0);
    crest.rotation.z = 0.24;
    head.add(crest);
  }

  const jawGeo = new THREE.SphereGeometry(0.095, 32, 20, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const jawMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8c49a'), roughness: 0.5, metalness: 0.06 });
  jawMat.name = 'mat-serpent-jaw';
  const jaw = new THREE.Mesh(jawGeo, jawMat);
  jaw.position.set(0.04, -0.03, 0);
  jaw.name = 'serpent-jaw';
  head.add(jaw);

  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8ffdd'),
    emissive: new THREE.Color('#1fae6a'),
    emissiveIntensity: 2.6,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
  });
  eyeMat.name = 'mat-eye';
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 16), eyeMat);
    eye.name = 'serpent-eye-' + (side > 0 ? 'l' : 'r');
    eye.position.set(0.150, 0.022, 0.112 * side);
    head.add(eye);
    const socket = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.013, 10, 24),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#b8874a'), roughness: 0.3, metalness: 0.9 }),
    );
    socket.name = 'serpent-eye-ring-' + (side > 0 ? 'l' : 'r');
    socket.position.copy(eye.position).multiplyScalar(1.02);
    socket.rotation.y = Math.PI / 2;
    head.add(socket);
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
  const ringProfile = [
    new THREE.Vector2(1.238, -0.042),
    new THREE.Vector2(1.302, -0.042),
    new THREE.Vector2(1.302, 0.042),
    new THREE.Vector2(1.238, 0.042),
    new THREE.Vector2(1.238, -0.042),
  ];
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
  // 环面法线倾出视线约 49°，正面投影成清楚的斜向椭圆，
  // 与基本正对相机的蛇环（R=1.26）形成交叉关系，两者不再挤成一团。
  copperRing.rotation.set(Math.PI / 2 - 0.86, 0.0, -0.2);
  copperRing.scale.set(1, 1, 1);
  copperRing.castShadow = true;
  root.add(copperRing);

  // 环面刻度：细齿沿圆周分布，形成测量环语汇
  const tickMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0d3a0'), roughness: 0.16, metalness: 1, envMapIntensity: 2.2 });
  tickMat.name = 'mat-copper-tick';
  const tickGeo = new THREE.BoxGeometry(0.009, 0.042, 0.008);

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
  tick.position.set(1.27, 0.0, 0.052);
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
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.017 + (i === 3 ? 0.004 : 0), 14, 10), starMat);
    star.name = 'star-' + (i + 1);
    star.position.copy(dir.multiplyScalar(1.028));
    stars.add(star);
  });
  root.add(stars);

  // 9. 武曲浮雕（贴在球壳右上的一枚小浮雕盘）
  const reliefGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.022, hi ? 48 : 24);
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