// 首屏截图：桌面 1585x992 与手机 390x844，并检查横向溢出与控制台错误。
import { chromium } from 'file:///C:/Users/33126/Documents/DIY/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const BASE = process.env.NOVA_BASE || 'http://127.0.0.1:4340';
const OUT = process.env.NOVA_SHOT_DIR || 'C:/Users/33126/Documents/DIY/_work/nova-night/shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
for (const [w, h] of [[1585, 992], [1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(w + ': ' + e.message));
  page.on('requestfailed', (r) => errors.push(w + ' failed: ' + r.url()));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const geo = await page.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth }));
  await page.screenshot({ path: OUT + '/home-' + w + 'x' + h + '.png' });
  console.log(w + 'x' + h, JSON.stringify(geo), geo.iw === geo.sw ? 'ok' : 'OVERFLOW');
  await page.close();
}
await browser.close();
console.log('ERRORS', errors.length, errors.slice(0, 5).join(' | '));
if (errors.length) process.exit(1);
