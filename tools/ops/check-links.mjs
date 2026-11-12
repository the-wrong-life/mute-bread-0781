// 站内链接与路由核对：从 dist 实际产物枚举路由，再对预览服务逐个请求。
//
// 用户 m17669 明确要求（原实现被判定不合格）：
// 1) 必须记录**来源路由**（哪个页面引用了这个链接）；
// 2) 必须记录**最终状态码与重定向链**，3xx 不得直接算通过；
// 3) 必须校验 **URL 片段（#anchor）** 在目标页真实存在；
// 4) 路由清单必须来自本次构建产物，不能凭记忆写。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = process.env.NOVA_DIST || 'dist';
const BASE = process.env.NOVA_BASE || 'http://127.0.0.1:4340';
const MAX_ATTEMPTS = 3;
const MAX_HOPS = 8;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    // 404.html 是错误页产物，不是可导航路由（它的 404 状态是正确行为），不参与路由清单
    else if (name.endsWith('.html') && name !== '404.html') out.push(p);
  }
  return out;
}

function routeOf(file) {
  let r = '/' + relative(DIST, file).split('\\').join('/');
  r = r.replace(/index\.html$/, '');
  if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
  return r || '/';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 注意：必须把响应体读干净再放掉。Node 24 的 undici 在"响应未消费就结束 socket"时
// 会在 Parser.finish 抛 assert(!this.paused)（2026-11-12 site-audit 实测），不是我们代码的错但要规避。
async function fetchOnce(url) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'manual', headers: { connection: 'close' } });
      const location = res.headers.get('location');
      let body = '';
      try { body = await res.text(); } catch { body = ''; } // 读干净，释放连接
      if ((res.status === 502 || res.status === 504) && attempt < MAX_ATTEMPTS) { await sleep(400 * 2 ** (attempt - 1) + Math.random() * 200); continue; }
      return { status: res.status, location, body };
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) return { status: 'ERR:' + e.message, location: null, body: '' };
      await sleep(400 * 2 ** (attempt - 1));
    }
  }
}

// 手动跟随重定向，返回完整链与最终状态；3xx 只作为中间态
async function resolveChain(url) {
  const chain = [];
  let lastBody = '';
  let cur = url;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetchOnce(cur);
    lastBody = res.body;
    const loc = res.location;
    chain.push({ url: cur, status: res.status, location: loc });
    if (typeof res.status === 'number' && res.status >= 300 && res.status < 400 && loc) {
      cur = new URL(loc, cur).toString();
      continue;
    }
    return { chain, body: res.body };
  }
  chain.push({ url: cur, status: 'TOO_MANY_REDIRECTS', location: null });
  return { chain, body: lastBody };
}

if (!existsSync(DIST)) { console.log('NO DIST — 先构建'); process.exit(1); }

const files = walk(DIST);
const routes = [...new Set(files.map(routeOf))].sort();
const fileByRoute = new Map();
for (const f of files) fileByRoute.set(routeOf(f), f);

const problems = [];
const checks = [];

async function checkOne(target, sourceRoute, kind, frag) {
  const resolved = await resolveChain(BASE + target);
  const chain = resolved.chain;
  const final = chain[chain.length - 1];
  const okStatus = final.status === 200;
  let anchorOk = true;
  let anchorDetail = '';
  if (okStatus && frag) {
    // 片段校验：优先读本地构建产物，避免依赖服务端行为的差异
    const local = fileByRoute.get(target) || fileByRoute.get(target.replace(/\/$/, ''));
    let html = '';
    if (local) html = readFileSync(local, 'utf8');
    else html = resolved.body || '';
    const idRe = new RegExp('(id|name)=["\']' + frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']');
    anchorOk = idRe.test(html);
    anchorDetail = anchorOk ? 'anchor-ok' : 'anchor-missing';
    if (!anchorOk) problems.push({ target, source: sourceRoute, kind: kind + ':anchor', frag, chain });
  }
  const ok = okStatus && anchorOk;
  checks.push({ target, source: sourceRoute, kind, ok, finalStatus: final.status, hops: chain.length - 1, chain });
  console.log((ok ? 'ok  ' : 'BAD ') + String(final.status).padEnd(6) + target +
    (chain.length > 1 ? '  (' + (chain.length - 1) + ' redirect)' : '') +
    (kind === 'link' ? '   (来自 ' + sourceRoute + ')' : '') +
    (frag ? '  #' + frag + ' ' + anchorDetail : ''));
  if (!okStatus) problems.push({ target, source: sourceRoute, kind, finalStatus: final.status, chain });
}

for (const route of routes) await checkOne(route, '(route)', 'route', null);

// 页面内引用：必须带来源路由 + 片段校验
const refs = new Map(); // href -> Set(sourceRoute)
for (const f of files) {
  const sourceRoute = routeOf(f);
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"?#]*)(?:\?[^"#]*)?(?:#([^"]*))?"/g)) {
    const path = m[1].replace(/\/$/, '') || '/';
    const frag = m[2] || null;
    const key = path + (frag ? '#' + frag : '');
    if (!refs.has(key)) refs.set(key, new Set());
    refs.get(key).add(sourceRoute);
  }
}

const routeKey = (r) => (r.replace(/\/$/, '') || '/');
for (const key of [...refs.keys()].sort()) {
  const [target, frag] = key.split('#');
  const sourceRoutes = [...refs.get(key)].sort().slice(0, 3).join(',');
  if (!frag) {
    if (routes.some((r) => routeKey(r) === target)) continue;
    await checkOne(target, sourceRoutes, 'link', null);
  } else {
    // 带片段的链接即使目标路由存在也要校验锚点
    await checkOne(target, sourceRoutes, 'link', frag);
  }
}

const redirects = checks.filter((c) => c.hops > 0).length;
console.log('ROUTES ' + routes.length + '  LINKS ' + refs.size + '  REDIRECTED ' + redirects + '  PROBLEMS ' + problems.length);
if (problems.length) {
  // 只打印定位问题所需的字段；不要把整页 HTML 倒进日志（2026-11-12 踩过：body 曾随 chain 落盘）
  console.log(JSON.stringify(problems.slice(0, 20).map((p) => ({ target: p.target, source: p.source, kind: p.kind, status: p.finalStatus ?? p.chain?.[p.chain.length - 1]?.status, frag: p.frag, chain: p.chain?.map((c) => c.status + (c.location ? '->' + c.location : '')).join(' | ') })), null, 1));
  process.exit(1);
}
