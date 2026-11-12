// 首屏截图：桌面与手机，并检查横向溢出与控制台错误。
// 依赖解析顺序（用户 m17669 D 阶段：测试依赖与输出参数必须纳入项目，不得绑定个人机器路径）：
//   1) 环境变量 NOVA_PLAYWRIGHT（指向 playwright 的 index.mjs 或包名）
//   2) 项目内依赖 'playwright'
//   3) 上一级工作区依赖（本机 DIY 工作区的既有安装，仅作回退并在输出里标注来源）
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CANDIDATES = [
  process.env.NOVA_PLAYWRIGHT,
  'playwright',
  'file:///C:/Users/33126/Documents/DIY/node_modules/playwright/index.mjs',
].filter(Boolean);

let chromium = null;
let source = '';
for (const spec of CANDIDATES) {
  try {
    const mod = await import(spec);
    if (mod.chromium) { chromium = mod.chromium; source = spec; break; }
  } catch { /* 继续尝试下一个来源 */ }
}
if (!chromium) {
  console.error('NO PLAYWRIGHT — 设置 NOVA_PLAYWRIGHT 指向 playwright/index.mjs，或在项目内安装 playwright');
  process.exit(2);
}

const BASE = process.env.NOVA_BASE || 'http://127.0.0.1:4340';
const OUT = resolve(process.env.NOVA_SHOT_DIR || '.shots');
const VIEWPORTS = (process.env.NOVA_VIEWPORTS || '1585x992,1440x900,390x844,360x800')
  .split(',')
  .map((s) => s.split('x').map(Number));
const ROUTES = (process.env.NOVA_ROUTES || '/').split(',').map((s) => s.trim()).filter(Boolean);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.NOVA_CHANNEL || 'chrome' });
const errors = [];
let failures = 0;

for (const route of ROUTES) {
  for (const [w, h] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push(`${w}x${h} ${route} pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`${w}x${h} ${route} failed: ${r.url()}`));
    try {
      await page.goto(BASE + route, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const geo = await page.evaluate(() => ({
        iw: innerWidth,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      const slug = (route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9-]+/gi, '-'));
      await page.screenshot({ path: `${OUT}/${slug}-${w}x${h}.png` });
      const overflow = geo.iw !== geo.sw;
      if (overflow) failures++;
      console.log(`${w}x${h} ${route} ${JSON.stringify(geo)} ${overflow ? 'OVERFLOW' : 'ok'}`);
    } catch (e) {
      failures++;
      errors.push(`${w}x${h} ${route} goto: ${e.message}`);
      console.log(`${w}x${h} ${route} GOTO-FAIL ${e.message}`);
    } finally {
      await page.close();
    }
  }
}
await browser.close();
console.log('PLAYWRIGHT_SOURCE ' + source);
console.log('OUT ' + OUT);
console.log('ERRORS ' + errors.length + (errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''));
if (errors.length || failures) process.exit(1);
