import * as THREE from 'three';
import { createScaleTextures, createJadeVeins, createTabletTexture } from './procedural-textures';

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
      uvs.push(t * 14, (j / radialSegments) * 2.5);
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

/** 蛇身路径：半径 1.44 的圆，末端向蛇头收拢，形成衔尾 */
function serpentCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const R = 1.12;
  // 从右上（蛇首）顺时针绕行近一圈，尾尖回到 0.5 rad 处，留出咬合缺口。
  const start = 1.12;
  const sweep = Math.PI * 2 - 0.34;
  const steps = 72;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = start - sweep * t;
    const wobble = Math.sin(a * 3) * 0.02;
    pts.push(new THREE.Vector3(Math.cos(a) * (R + wobble), Math.sin(a) * (R + wobble), Math.sin(a * 2) * 0.06 + 0.03));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}

export function buildJadeModel(options: { quality?: 'high' | 'low' } = {}): JadeParts {
  const quality = options.quality ?? 'high';
  const hi = quality === 'high';
  const root = new THREE.Group();
  root.name = 'jade-heng';

  const scaleTex = createScaleTextures();
  const veinTex = createJadeVeins();

  // 1. 青玉球壳
  const shellGeo = new THREE.SphereGeometry(1, hi ? 128 : 64, hi ? 96 : 48);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3f7561'),
    map: veinTex,
    roughness: 0.42,
    metalness: 0.0,
    transmission: 0.58,
    thickness: 2.2,
    ior: 1.46,
    clearcoat: 0.4,
    clearcoatRoughness: 0.5,
    attenuationColor: new THREE.Color('#1f5343'),
    attenuationDistance: 1.15,
    sheen: 0.6,
    sheenColor: new THREE.Color('#bfdcc9'),
    envMapIntensity: 0.55,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.name = 'jade-shell';
  shell.castShadow = true;
  root.add(shell);

  // 2. 暖白内核
  const kernelGeo = new THREE.SphereGeometry(0.62, hi ? 64 : 32, hi ? 48 : 24);
  const kernelMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fff1d4'),
    emissive: new THREE.Color('#ffdd9c'),
    emissiveIntensity: 1.5,
    roughness: 0.55,
    metalness: 0,
    transmission: 0.18,
    thickness: 0.5,
  });
  const kernel = new THREE.Mesh(kernelGeo, kernelMat);
  kernel.name = 'default-kernel';
  root.add(kernel);

  // 3. 衔尾蛇
  const serpent = new THREE.Group();
  serpent.name = 'ouroboros';
  const curve = serpentCurve();
  const bodyGeo = taperedTube(curve, (t) => 0.112 - 0.046 * Math.pow(t, 1.4), hi ? 280 : 150, hi ? 26 : 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#406b58'),
    map: scaleTex.map,
    bumpMap: scaleTex.bump,
    bumpScale: 0.16,
    roughness: 0.52,
    metalness: 0.08,
    envMapIntensity: 0.7,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'serpent-body';
  serpent.add(body);

  // 腹鳞：沿内侧的一条薄带
  const bellyCurvePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 30; i += 1) {
    const t = 0.25 + (0.72 * i) / 30;
    const p = curve.getPointAt(t);
    bellyCurvePts.push(p.clone().multiplyScalar(0.985).setZ(p.z + 0.055));
  }
  const bellyCurve = new THREE.CatmullRomCurve3(bellyCurvePts);
  const bellyGeo = taperedTube(bellyCurve, (t) => 0.028 * (1 - 0.4 * t), 60, 10);
  const bellyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6d3a6'),
    roughness: 0.42,
    metalness: 0.08,
    emissive: new THREE.Color('#6a5230'),
    emissiveIntensity: 0.12,
  });
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.name = 'serpent-belly';
  serpent.add(belly);

  // 蛇头
  const head = new THREE.Group();
  head.name = 'serpent-head';
  const tip = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0).normalize().negate();
  head.position.copy(tip);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);

  const skullGeo = new THREE.SphereGeometry(0.134, hi ? 48 : 24, hi ? 36 : 18);
  const skull = new THREE.Mesh(skullGeo, bodyMat);
  skull.scale.set(1.45, 0.86, 1.0);
  skull.name = 'serpent-skull';
  head.add(skull);

  const jawGeo = new THREE.SphereGeometry(0.085, 32, 20, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const jawMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8c49a'), roughness: 0.5, metalness: 0.06 });
  const jaw = new THREE.Mesh(jawGeo, jawMat);
  jaw.position.set(0.04, -0.03, 0);
  jaw.name = 'serpent-jaw';
  head.add(jaw);

  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#7cf2b0'),
    emissive: new THREE.Color('#38d98a'),
    emissiveIntensity: 1.4,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
  });
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 16), eyeMat);
    eye.name = 'serpent-eye-' + (side > 0 ? 'l' : 'r');
    eye.position.set(0.075, 0.035, 0.052 * side);
    head.add(eye);
    const socket = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.008, 10, 24),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#b8874a'), roughness: 0.3, metalness: 0.9 }),
    );
    socket.name = 'serpent-eye-ring-' + (side > 0 ? 'l' : 'r');
    socket.position.copy(eye.position);
    socket.rotation.y = Math.PI / 2;
    head.add(socket);
  }
  serpent.add(head);
  root.add(serpent);

  // 4. 竖直玉轴
  const axis = new THREE.Group();
  axis.name = 'jade-axis';
  const shaftGeo = new THREE.CylinderGeometry(0.052, 0.052, 2.32, hi ? 32 : 16);
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dfeee1'),
    roughness: 0.2,
    transmission: 0.5,
    thickness: 0.4,
    ior: 1.5,
    metalness: 0,
    clearcoat: 1,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.name = 'axis-shaft';
  axis.add(shaft);
  const goldMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c9a05e'),
    roughness: 0.26,
    metalness: 1,
    envMapIntensity: 1.6,
  });
  for (const y of [1.2, -1.2]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.075, hi ? 32 : 16), goldMat);
    collar.name = 'axis-collar-' + (y > 0 ? 'top' : 'bottom');
    collar.position.y = y;
    axis.add(collar);
    for (let i = 0; i < 2; i += 1) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.008, 8, hi ? 48 : 24), goldMat);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = y + (i === 0 ? -0.022 : 0.022);
      axis.add(groove);
    }
  }
  root.add(axis);

  // 5. 倾斜铜环（绕到球体背后）
  const ringGeo = new THREE.TorusGeometry(1.34, 0.048, hi ? 28 : 14, hi ? 260 : 140);
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c08b45'),
    roughness: 0.3,
    metalness: 1,
    envMapIntensity: 1.35,
  });
  const copperRing = new THREE.Mesh(ringGeo, ringMat);
  copperRing.name = 'copper-ring';
  copperRing.rotation.set(1.02, 0.0, -0.1);
  copperRing.castShadow = true;
  root.add(copperRing);

  // 环面刻度：细齿沿圆周分布，形成测量环语汇
  const tickMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e2c084'), roughness: 0.34, metalness: 0.95 });
  const tickGeo = new THREE.BoxGeometry(0.02, 0.075, 0.012);
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 6 === 0;
    const t = new THREE.Mesh(tickGeo, tickMat);
    t.name = 'ring-tick-' + i;
    t.position.set(Math.cos(a) * 1.34, Math.sin(a) * 1.34, 0.046);
    t.scale.set(1, long ? 1.5 : 0.7, 1);
    t.rotation.z = a - Math.PI / 2;
    copperRing.add(t);
  }

  // 刻度块：沿铜环的游标
  const tick = new THREE.Group();
  tick.name = 'copper-vernier';
  const tickBlock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), goldMat);
  tick.add(tickBlock);
  const tickFace = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#3f6d5c'), roughness: 0.35, metalness: 0.4 }),
  );
  tickFace.position.z = 0.055;
  tick.add(tickFace);
  tick.position.set(0.62, 0.84, 0.5);
  copperRing.add(tick);

  // 6. 底部徽章
  const baseBadge = new THREE.Group();
  baseBadge.name = 'base-badge';
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.06, hi ? 64 : 32), goldMat);
  disc.rotation.x = Math.PI / 2;
  baseBadge.add(disc);
  const discInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.245, 0.065, hi ? 64 : 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9915e'), roughness: 0.34, metalness: 0.95 }),
  );
  discInner.rotation.x = Math.PI / 2;
  baseBadge.add(discInner);
  const emblem = new THREE.Mesh(
    new THREE.TorusGeometry(0.132, 0.02, 12, hi ? 64 : 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8d3a4'), roughness: 0.3, metalness: 0.9 }),
  );
  baseBadge.add(emblem);
  baseBadge.position.set(0, -1.3, 0.02);
  baseBadge.rotation.x = -0.24;
  root.add(baseBadge);

  // 7. 右侧辛巳玉牌
  const tabletGeo = new THREE.BoxGeometry(0.3, 0.46, 0.045, 2, 2, 1);
  const tabletMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dfeee0'),
    map: createTabletTexture('辛', '巳'),
    roughness: 0.22,
    transmission: 0.28,
    thickness: 0.3,
    clearcoat: 1,
    ior: 1.5,
  });
  const tablet = new THREE.Mesh(tabletGeo, tabletMat);
  tablet.name = 'xin-si-tablet';
  tablet.position.set(1.16, -0.95, 0.52);
  tablet.rotation.set(-0.1, -0.38, 0.12);
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
    color: new THREE.Color('#fff6d8'),
    emissive: new THREE.Color('#ffd9a0'),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.2,
  });
  bigDipper.forEach(([u, v], i) => {
    const dir = new THREE.Vector3(u, v, Math.sqrt(Math.max(0.04, 1 - u * u - v * v))).normalize();
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.019 + (i === 3 ? 0.006 : 0), 16, 12), starMat);
    star.name = 'star-' + (i + 1);
    star.position.copy(dir.multiplyScalar(1.005));
    stars.add(star);
  });
  root.add(stars);

  // 9. 武曲浮雕（贴在球壳右上的一枚小浮雕盘）
  const reliefGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, hi ? 48 : 24);
  const reliefMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9c391'),
    roughness: 0.3,
    metalness: 0.92,
  });
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
