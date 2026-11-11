import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** 蛇鳞：叠瓦图案，palette 决定鳞片配色（绿翡翠 / 金色青铜） */
export function createScaleTextures(palette: 'jade' | 'gold' = 'jade'): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 512;
  const P = palette === 'gold'
    ? { base: '#a37f3c', hi: '#ecd49a', mid: '#cfa663', lo: '#7a5a28', line: 'rgba(255,242,206,0.92)' }
    : { base: '#2b5f4e', hi: '#7dbfa1', mid: '#3d7f68', lo: '#1e4a3d', line: 'rgba(24,62,52,0.55)' };
  const color = canvas(size);
  const cctx = color.getContext('2d')!;
  const bump = canvas(size);
  const bctx = bump.getContext('2d')!;

  cctx.fillStyle = P.base;
  cctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  const cols = palette === 'gold' ? 9 : 11;
  const rows = palette === 'gold' ? 11 : 14;
  const w = size / cols;
  const h = size / rows;

  for (let r = -1; r < rows + 1; r += 1) {
    for (let c = -1; c < cols + 1; c += 1) {
      const offset = r % 2 === 0 ? 0 : w / 2;
      const x = c * w + offset + w / 2;
      const y = r * h + h / 2;
      const grad = cctx.createRadialGradient(x - w * 0.18, y - h * 0.3, 1, x, y, w * 0.62);
      grad.addColorStop(0, P.hi);
      grad.addColorStop(0.55, P.mid);
      grad.addColorStop(1, P.lo);
      cctx.fillStyle = grad;
      cctx.beginPath();
      cctx.ellipse(x, y, w * 0.52, h * 0.6, 0, 0, Math.PI * 2);
      cctx.fill();
      cctx.strokeStyle = P.line;
      cctx.lineWidth = 1.6;
      cctx.stroke();

      // 金鳞中心嵌青玉甲片：参考图的蛇是金铜底 + 小块青玉，不是整条绿蛇
      if (palette === 'gold' && (r * 3 + c) % 3 === 0) {
        const s = w * 0.22;
        cctx.fillStyle = '#8ed3b2';
        cctx.beginPath();
        cctx.roundRect(x - s / 2, y - s * 0.44, s, s * 0.88, s * 0.22);
        cctx.fill();
        cctx.strokeStyle = 'rgba(255,240,205,0.7)';
        cctx.lineWidth = 1.2;
        cctx.stroke();
      }

      const bgrad = bctx.createRadialGradient(x - w * 0.15, y - h * 0.28, 1, x, y, w * 0.6);
      bgrad.addColorStop(0, '#ffffff');
      bgrad.addColorStop(0.6, '#9a9a9a');
      bgrad.addColorStop(1, '#3a3a3a');
      bctx.fillStyle = bgrad;
      bctx.beginPath();
      bctx.ellipse(x, y, w * 0.5, h * 0.58, 0, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(color);
  const bmp = new THREE.CanvasTexture(bump);
  for (const t of [map, bmp]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
  }
  bmp.colorSpace = THREE.NoColorSpace;
  return { map, bump: bmp };
}

/** 青玉内部絮状纹样，用作球壳的粗糙度/颜色扰动 */
export function createJadeVeins(): THREE.CanvasTexture {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8f3ea';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 40 + Math.random() * 130;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, 'rgba(120,190,160,0.5)');
    g.addColorStop(1, 'rgba(120,190,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 16; i += 1) {
    ctx.beginPath();
    let px = Math.random() * size;
    let py = Math.random() * size;
    ctx.moveTo(px, py);
    for (let s = 0; s < 6; s += 1) {
      px += (Math.random() - 0.5) * 90;
      py += (Math.random() - 0.5) * 90;
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 玉牌文字：辛巳与刻纹 */
export function createTabletTexture(gan: string, zhi: string): THREE.CanvasTexture {
  const w = 256;
  const h = 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#e7f0dc');
  g.addColorStop(0.5, '#c9dcc4');
  g.addColorStop(1, '#a8c2ae');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b48b52';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.strokeStyle = 'rgba(90,120,100,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  ctx.fillStyle = '#a5321f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 96px "Songti SC", serif';
  ctx.fillText(gan, w / 2, h * 0.36);
  ctx.fillText(zhi, w / 2, h * 0.66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}