// 夜间任务运行器：检查点 + 断点续跑 + 有界重试
//
// 目的（用户 m06914 第 4/5/8 条）+ m17669 D 阶段修订：
// 1. 每一步执行完立刻把状态原子写回 checkpoint.json，进程被杀也不丢进度；
// 2. 断点续跑必须**核对输入指纹**——只认"同一份代码 + 同一份命令"的 done，代码变了就重跑；
// 3. 进程被信号杀掉（spawnSync status===null）一律判失败，不得当成成功；
// 4. 502/504/超时这类瞬时错误按指数退避 + 抖动重试，次数有上限；确定性错误立即失败；
// 5. --only 写了不存在的步骤必须报错退出（2），不能因为过滤为空就静默成功。
//
// 用法：
//   node tools/ops/night-runner.mjs                 # 按 checkpoint 继续
//   node tools/ops/night-runner.mjs --reset         # 清空进度重跑
//   node tools/ops/night-runner.mjs --only build    # 只跑指定步骤
//   node tools/ops/night-runner.mjs --plan          # 只打印计划
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// 默认落在站点仓库上一级的 _work/nova-night/，与夜间日志、截图证据放在一起
// 注意：**不要**用 checkpoint.json —— 那份是发布检查点（main/head/batches/releases），
// 混用会让 runner 的 steps 覆盖发布记录（2026-11-12 实测踩过：state.steps 为 undefined 直接崩）。
const STATE = process.env.NOVA_STATE || resolve(process.cwd(), '..', 'nova-night', 'night-state.json');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const value = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };

const STEPS = [
  { id: 'check', title: 'astro check 类型检查', cmd: 'node node_modules/astro/bin/astro.mjs check' },
  { id: 'build', title: 'astro build 静态构建', cmd: 'node node_modules/astro/bin/astro.mjs build' },
  { id: 'links', title: '站内链接与路由 200 核对', cmd: 'node tools/ops/check-links.mjs', inputs: ['dist'] },
  { id: 'shots', title: '桌面/手机首屏截图', cmd: 'node tools/ops/shots.mjs' },
];

function sh(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: 'pipe' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// 输入指纹：当前提交 + 工作区改动清单。任何源码变化都会让指纹变，避免"用旧 done 跳过"。
function codeFingerprint() {
  const head = sh('git rev-parse HEAD').out.trim();
  const dirty = sh('git status --porcelain').out.trim();
  // git status --porcelain 只列"哪些路径变了"，不含内容：同一文件被改第二次时清单文本不变，
  // 只哈希它会误判"输入没变"而跳过本应重跑的步骤（已被独立复核用隔离仓库复现）。
  // 因此把实际差异内容与未跟踪文件内容也纳入指纹。
  const diff = sh('git diff HEAD').out;
  const untracked = dirty
    .split('\n')
    .filter((l) => l.startsWith('??'))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
  let untrackedHash = '';
  for (const f of untracked) {
    try {
      untrackedHash += f + ':' + createHash('sha256').update(readFileSync(f)).digest('hex') + '\n';
    } catch {
      untrackedHash += f + ':unreadable\n';
    }
  }
  return createHash('sha256').update(head + '\n' + dirty + '\n' + diff + '\n' + untrackedHash).digest('hex').slice(0, 16);
}

const FP = codeFingerprint();
function stepFingerprint(step) {
  const extra = (step.inputs || []).map((p) => (existsSync(p) ? p + ':' + codeFingerprint() : p + ':missing')).join(',');
  return createHash('sha256').update(step.cmd + '|' + FP + '|' + extra).digest('hex').slice(0, 16);
}

function loadState() {
  if (flag('reset') || !existsSync(STATE)) return { version: 2, createdAt: new Date().toISOString(), steps: {} };
  let parsed;
  try { parsed = JSON.parse(readFileSync(STATE, 'utf8')); }
  catch (e) { console.error('STATE 文件不是合法 JSON，拒绝覆盖：' + STATE + ' — ' + e.message); process.exit(3); }
  if (!parsed || typeof parsed.steps !== 'object' || parsed.steps === null) {
    console.error('STATE 文件缺少 steps 字段，看起来不是 runner 状态，拒绝覆盖：' + STATE);
    process.exit(3);
  }
  return parsed;
}

function saveState(state) {
  mkdirSync(dirname(STATE), { recursive: true });
  const tmp = STATE + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, STATE); // 原子替换：断电/被杀也不会留下半个 JSON
}

const TRANSIENT_CODES = new Set([502, 503, 504]);
const TRANSIENT_RE = /\b(502|503|504)\b|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up/i;

function runStep(step, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const r = spawnSync(step.cmd, { shell: true, encoding: 'utf8', stdio: 'pipe' });
    // status === null 表示被信号终止（超时/被杀），绝不是成功
    const killed = r.status === null;
    const code = killed ? 'SIGNAL:' + (r.signal || 'unknown') : r.status;
    if (!killed && code === 0) return { ok: true, ms: Date.now() - started, attempt };
    const transient = !killed && (TRANSIENT_CODES.has(code) || TRANSIENT_RE.test((r.stderr || '') + (r.stdout || '')));
    if (!transient || attempt === maxAttempts) {
      return { ok: false, code, attempt, ms: Date.now() - started, stderr: (r.stderr || '').slice(-2000) };
    }
    const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 250;
    console.log(`  ! ${step.id} 第 ${attempt} 次失败（code=${code}），${Math.round(backoff)}ms 后重试`);
    const until = Date.now() + backoff;
    while (Date.now() < until) { /* 有界等待 */ }
  }
}

const state = loadState();
const only = value('only');
const steps = only ? STEPS.filter((s) => s.id === only) : STEPS;

if (only && steps.length === 0) {
  console.error(`未知步骤 --only ${only}；可用：${STEPS.map((s) => s.id).join(', ')}`);
  process.exit(2);
}

if (flag('plan')) {
  for (const s of steps) {
    const rec = state.steps[s.id];
    const fresh = rec?.status === 'done' && rec.fingerprint === stepFingerprint(s);
    console.log(`${fresh ? '[done]' : '[todo]'} ${s.id}  ${s.title}` + (rec?.status === 'done' && !fresh ? '  (输入已变，将重跑)' : ''));
  }
  process.exit(0);
}

console.log('STATE', STATE, 'FP', FP);
let failed = 0;
for (const step of steps) {
  const fp = stepFingerprint(step);
  const rec = state.steps[step.id];
  if (rec?.status === 'done' && rec.fingerprint === fp) {
    console.log(`skip ${step.id}（已完成 ${rec.at}，输入未变）`);
    continue;
  }
  if (rec?.status === 'done') console.log(`rerun ${step.id}（输入指纹变：${rec.fingerprint} → ${fp}）`);
  console.log(`run  ${step.id}  ${step.title}`);
  state.steps[step.id] = { status: 'running', at: new Date().toISOString(), fingerprint: fp };
  saveState(state); // 先落盘 running，崩溃后能看出断在哪里
  const res = runStep(step);
  state.steps[step.id] = res.ok
    ? { status: 'done', at: new Date().toISOString(), ms: res.ms, attempt: res.attempt, fingerprint: fp }
    : { status: 'failed', at: new Date().toISOString(), code: res.code, attempt: res.attempt, stderr: res.stderr, fingerprint: fp };
  saveState(state);
  if (!res.ok) { failed++; console.log(`FAIL ${step.id} code=${res.code}`); break; } // 依赖链：前一步失败不继续
  console.log(`ok   ${step.id}  ${res.ms}ms`);
}
process.exit(failed ? 1 : 0);
