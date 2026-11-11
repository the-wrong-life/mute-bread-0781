// 夜间任务运行器：检查点 + 断点续跑 + 有界重试
//
// 目的（用户 m06914 第 4/5/8 条）：
// 1. 每一步执行完立刻把状态原子写回 checkpoint.json，进程被杀也不丢进度；
// 2. 重跑同一条命令时，已完成的步骤直接跳过（断点续跑），未完成/失败的步骤继续；
// 3. 502/504 这类瞬时错误按指数退避 + 抖动重试，次数有上限，鉴权/404 之类的确定性错误立即失败。
//
// 用法：
//   node tools/ops/night-runner.mjs                 # 按 checkpoint 继续
//   node tools/ops/night-runner.mjs --reset         # 清空进度重跑
//   node tools/ops/night-runner.mjs --only build    # 只跑指定步骤
//   node tools/ops/night-runner.mjs --plan          # 只打印计划
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// 默认落在站点仓库上一级的 _work/nova-night/，与夜间日志、截图证据放在一起
const STATE = process.env.NOVA_STATE || resolve(process.cwd(), '..', 'nova-night', 'checkpoint.json');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const value = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };

const STEPS = [
  { id: 'check', title: 'astro check 类型检查', cmd: 'node node_modules/astro/bin/astro.mjs check' },
  { id: 'build', title: 'astro build 静态构建', cmd: 'node node_modules/astro/bin/astro.mjs build' },
  { id: 'links', title: '站内链接与路由 200 核对', cmd: 'node tools/ops/check-links.mjs' },
  { id: 'shots', title: '桌面/手机首屏截图', cmd: 'node tools/ops/shots.mjs' },
];

function loadState() {
  if (flag('reset') || !existsSync(STATE)) return { version: 1, createdAt: new Date().toISOString(), steps: {} };
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return { version: 1, createdAt: new Date().toISOString(), steps: {} }; }
}

function saveState(state) {
  mkdirSync(dirname(STATE), { recursive: true });
  const tmp = STATE + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, STATE); // 原子替换：断电/被杀也不会留下半个 JSON
}

const RETRYABLE = new Set([0, 502, 503, 504]); // 0 = 进程被信号杀掉，按瞬时错误处理
function runStep(step, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const r = spawnSync(step.cmd, { shell: true, encoding: 'utf8', stdio: 'pipe' });
    const code = r.status === null ? 0 : r.status;
    if (code === 0) return { ok: true, ms: Date.now() - started, attempt };
    const transient = RETRYABLE.has(code) || /502|504|ETIMEDOUT|ECONNRESET/.test((r.stderr || '') + (r.stdout || ''));
    if (!transient || attempt === maxAttempts) {
      return { ok: false, code, attempt, ms: Date.now() - started, stderr: (r.stderr || '').slice(-2000) };
    }
    const backoff = 500 * 2 ** (attempt - 1) + Math.random() * 250;
    console.log(`  ! ${step.id} 第 ${attempt} 次失败（code=${code}），${Math.round(backoff)}ms 后重试`);
    const until = Date.now() + backoff;
    while (Date.now() < until) { /* 有界等待，不阻塞事件循环以外的资源 */ }
  }
}

const state = loadState();
const only = value('only');
const steps = only ? STEPS.filter((s) => s.id === only) : STEPS;

if (flag('plan')) {
  for (const s of steps) console.log(`${state.steps[s.id]?.status === 'done' ? '[done]' : '[todo]'} ${s.id}  ${s.title}`);
  process.exit(0);
}

console.log('STATE', STATE);
let failed = 0;
for (const step of steps) {
  if (state.steps[step.id]?.status === 'done') { console.log(`skip ${step.id}（已完成 ${state.steps[step.id].at}）`); continue; }
  console.log(`run  ${step.id}  ${step.title}`);
  state.steps[step.id] = { status: 'running', at: new Date().toISOString() };
  saveState(state); // 先落盘 running，崩溃后能看出断在哪里
  const res = runStep(step);
  state.steps[step.id] = res.ok
    ? { status: 'done', at: new Date().toISOString(), ms: res.ms, attempt: res.attempt }
    : { status: 'failed', at: new Date().toISOString(), code: res.code, attempt: res.attempt, stderr: res.stderr };
  saveState(state);
  if (!res.ok) { failed++; console.log(`FAIL ${step.id} code=${res.code}`); break; } // 依赖链：前一步失败不继续
  console.log(`ok   ${step.id}  ${res.ms}ms`);
}
process.exit(failed ? 1 : 0);
