// 站内链接与路由核对：从 dist 实际产物枚举路由，再对预览服务逐个请求。
// 目的（用户 m06914 第 6 条）：路由清单必须来自构建产物，不能凭记忆写；
// 404 自动报出（含来源页面），502/504 允许有界重试。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = process.env.NOVA_DIST || 'dist';
const BASE = process.env.NOVA_BASE || 'http://127.0.0.1:4340';
const MAX_ATTEMPTS = 3;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function routeOf(file) {
  let r = '/' + relative(DIST, file).split('\\').join('/');
  r = r.replace(/index\.html$/, '');
  if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
  return r || '/';
}

async function fetchRetry(url) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status === 502 || res.status === 504) {
        if (attempt === MAX_ATTEMPTS) return res.status;
        await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1) + Math.random() * 200));
        continue;
      }
      return res.status;
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) return 'ERR:' + e.message;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
    }
  }
}

if (!existsSync(DIST)) { console.log('NO DIST — 先构建'); process.exit(1); }

const files = walk(DIST);
const routes = [...new Set(files.map(routeOf))].sort();
const problems = [];

for (const route of routes) {
  const status = await fetchRetry(BASE + route);
  const ok = status === 200 || status === 301 || status === 302 || status === 308;
  if (!ok) problems.push({ route, status, kind: 'route' });
  console.log((ok ? 'ok  ' : 'BAD ') + String(status).padEnd(6) + route);
}

// 页面里出现的站内链接也要能打开，避免死链
const internal = new Set();
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) internal.add(m[1].replace(/\/$/, '') || '/');
}
for (const href of [...internal].sort()) {
  if (routes.includes(href)) continue;
  const status = await fetchRetry(BASE + href);
  const ok = status === 200 || status === 301 || status === 302 || status === 308;
  if (!ok) problems.push({ route: href, status, kind: 'link' });
  console.log((ok ? 'ok  ' : 'BAD ') + String(status).padEnd(6) + href + '   (页面内链接)');
}

console.log('ROUTES ' + routes.length + '  LINKS ' + internal.size + '  PROBLEMS ' + problems.length);
if (problems.length) { console.log(JSON.stringify(problems, null, 1)); process.exit(1); }
