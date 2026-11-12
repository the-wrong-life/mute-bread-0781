import { chromium } from 'playwright';

const BASE = 'https://www.token-xxo.cn';
const routes = ['/', '/docs/', '/tools/', '/projects/', '/blog/', '/about/', '/ai/', '/lab-material/', '/docs/release-ledger/'];
const out = { routes: [], issues: [], views: {} };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });

for (const r of routes) {
  const res = await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const status = res ? res.status() : 0;
  const metrics = await page.evaluate(() => ({
    mainCount: document.querySelectorAll('main').length,
    innerW: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
  }));
  out.routes.push({ r, status, ...metrics });
  if (status !== 200) out.issues.push(r + ' status ' + status);
  if (metrics.mainCount !== 1) out.issues.push(r + ' main=' + metrics.mainCount);
  if (metrics.scrollW > metrics.innerW) out.issues.push(r + ' overflow ' + (metrics.scrollW - metrics.innerW));
}

// back-link colour on project detail pages
const projRoutes = ['/projects/engineering-notes/', '/projects/engineering-toolbox/', '/projects/project-nova/', '/projects/yuheng-core/'];
out.backLinks = [];
for (const r of projRoutes) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const c = await page.evaluate(() => {
    const a = document.querySelector('.back');
    return a ? getComputedStyle(a).color : null;
  });
  out.backLinks.push({ r, color: c });
  if (c !== 'rgb(63, 96, 76)') out.issues.push(r + ' back colour ' + c);
}

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
await page.screenshot({ path: 'C:/Users/33126/Documents/DIY/_work/prod31-1440.png', fullPage: false });
const m390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p390 = await m390.newPage();
const errs390 = [];
p390.on('pageerror', e => errs390.push('pageerror: ' + e.message));
p390.on('console', m => { if (m.type() === 'error') errs390.push('console: ' + m.text().slice(0, 160)); });
await p390.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
const m = await p390.evaluate(() => ({ innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth }));
out.views['390'] = { ...m, errs: errs390 };
if (m.scrollW > m.innerW) out.issues.push('390 overflow ' + (m.scrollW - m.innerW));
await p390.screenshot({ path: 'C:/Users/33126/Documents/DIY/_work/prod31-390.png' });

out.consoleErrors = errs;
if (errs.length) out.issues.push('console errors ' + errs.length);
await browser.close();
console.log(JSON.stringify(out, null, 2));
