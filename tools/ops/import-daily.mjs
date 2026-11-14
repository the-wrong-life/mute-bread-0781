#!/usr/bin/env node
/**
 * 每日更新导入器：把 DSH 创意日报（daily-ideas-agent/reports/*.json）中
 * 「当天新增、实际可公开」的条目转成网站数据。
 * 公开字段白名单：name / what / can_do / difficulty.level / cost.free / confidence / risks / worth_further.yes（只取布尔）
 * 排除：value_to_me、payer、how_to_use、author_claims、commercial_score、dims、usage、asset_hits、cost.note、worth_further.why
 * 幂等：date 为期刊键、date+slug 为条目键；同日重跑只补充或修订，内容未变则跳过，变更记入 revisions。
 * 账本：tools/ops/daily-ledger.json（去重与修订记录的真实来源，随仓库提交）
 * 产物：src/data/daily.ts（站点只读这一个 TS 模块）
 * 用法：node tools/ops/import-daily.mjs <仓库根> [报告目录] [--check]
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.argv[2];
const argDir = process.argv[3] && process.argv[3].slice(0, 2) !== '--' ? process.argv[3] : 'C:/Users/33126/Documents/DIY/daily-ideas-agent/reports';
const checkOnly = process.argv.includes('--check');
if (!repoRoot) { console.error('用法: node tools/ops/import-daily.mjs <repoRoot> [reportsDir] [--check]'); process.exit(2); }
const ledgerFile = path.join(repoRoot, 'tools', 'ops', 'daily-ledger.json');
const outFile = path.join(repoRoot, 'src', 'data', 'daily.ts');

const CAT_FOLLOW = '待跟进';
const CAT_RESEARCH = '资料与研究';
const PRIVATE_MARKERS = ['value_to_me', 'payer', '预算不设限', 'asset_hits', 'how_to_use', 'author_claims', 'commercial_score'];
const ELL = String.fromCharCode(8230);

function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function trim(s, n) { const t = clean(s); return t.length > n ? t.slice(0, n - 1) + ELL : t; }
function slugOf(s) { return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48); }
function repoUrl(name) { return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(name) ? 'https://github.com/' + name : ''; }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
function bjtNow() { return new Date(Date.now() + 28800000).toISOString().replace('Z', '').slice(0, 19) + '+08:00'; }

function toItems(date, raw) {
  const out = [];
  const list = Array.isArray(raw.items) ? raw.items : [];
  for (const it of list) {
    const inner = it.item || {};
    const name = clean(inner.name || it.name || '');
    if (!name) continue;
    const follow = !!(inner.worth_further && inner.worth_further.yes);
    const short = name.indexOf('/') >= 0 ? name.split('/').pop() : name;
    out.push({
      id: date + '-' + (slugOf(short) || 'item'),
      category: follow ? CAT_FOLLOW : CAT_RESEARCH,
      title: name,
      summary: trim(inner.what, 220),
      detail: trim(inner.can_do, 320),
      project: name.indexOf('/') >= 0 ? name.split('/')[0] : 'GitHub',
      status: follow ? '值得跟进' : '仅记录',
      link: repoUrl(name),
      difficulty: inner.difficulty && typeof inner.difficulty.level === 'number' ? inner.difficulty.level : null,
      free: inner.cost && typeof inner.cost.free === 'boolean' ? inner.cost.free : null,
      confidence: trim(inner.confidence, 40),
      risks: trim(inner.risks, 240)
    });
  }
  return out;
}

function overviewOf(raw) {
  const parts = String(raw.overview == null ? '' : raw.overview).split(/\r?\n+/).map(function (s) { return clean(s.replace(/^-\s*/, '')); }).filter(Boolean);
  return { lead: parts[0] || '', note: parts[1] || '' };
}

function scanPrivate(items) {
  const hits = [];
  for (const it of items) {
    const blob = [it.title, it.summary, it.detail, it.risks, it.confidence, it.status].join(' ');
    for (const m of PRIVATE_MARKERS) if (blob.indexOf(m) >= 0) hits.push(it.id + ' -> ' + m);
  }
  return hits;
}

const T_ITEM = 'export interface DailyItem { id: string; category: string; title: string; summary: string; detail: string; project: string; status: string; link: string; difficulty: number | null; free: boolean | null; confidence: string; risks: string }';
const T_REV = 'export interface DailyRevision { at: string; note: string }';
const T_ISSUE = 'export interface DailyIssue { date: string; updatedAt: string; source: string; overview: string; overviewNote: string; items: DailyItem[]; revisions: DailyRevision[] }';
function renderTs(book) {
  const head = '/** 由 tools/ops/import-daily.mjs 自动生成，请勿手改。数据来源：daily-ideas-agent 日报的公开字段白名单；账本 tools/ops/daily-ledger.json；生成 ' + book.generatedAt + ' */';
  return [head, T_REV, T_ITEM, T_ISSUE, '', 'export const dailyIssues: DailyIssue[] = ' + JSON.stringify(book.issues, null, 1) + ';', ''].join('\n');
}

if (!fs.existsSync(argDir)) { console.error('报告目录不存在: ' + argDir); process.exit(2); }
const files = fs.readdirSync(argDir).filter(function (f) { return /^DAILY-DIY-IDEAS-\d{4}-\d{2}-\d{2}\.json$/.test(f); }).sort();
if (!files.length) { console.error('没有找到日报 JSON'); process.exit(2); }

let book = { generatedAt: '', source: 'daily-ideas-agent', issues: [] };
if (fs.existsSync(ledgerFile)) {
  try { book = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch (e) { console.error('账本解析失败，将重建: ' + e.message); }
  if (!Array.isArray(book.issues)) book.issues = [];
}
const byDate = new Map();
for (const i of book.issues) byDate.set(i.date, i);

const now = bjtNow();
let addedIssues = 0, addedItems = 0, revisedItems = 0, skipped = 0;
const privateHits = [];

for (const f of files) {
  const m = f.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) continue;
  const date = m[1];
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(argDir, f), 'utf8')); } catch (e) { console.error('跳过无法解析的 ' + f + ': ' + e.message); continue; }
  const items = toItems(date, raw);
  if (!items.length) { skipped++; continue; }
  for (const h of scanPrivate(items)) privateHits.push(h);
  const ov = overviewOf(raw);
  const existing = byDate.get(date);
  if (!existing) {
    byDate.set(date, { date: date, updatedAt: now, source: f, overview: ov.lead, overviewNote: ov.note, items: items, revisions: [{ at: now, note: '首次导入 ' + items.length + ' 条' }] });
    addedIssues++;
    addedItems += items.length;
    continue;
  }
  const seen = new Map();
  for (const i of existing.items) seen.set(i.id, i);
  let touched = false;
  for (const it of items) {
    const prev = seen.get(it.id);
    if (!prev) { existing.items.push(it); seen.set(it.id, it); addedItems++; touched = true; continue; }
    if (hash(JSON.stringify(prev)) === hash(JSON.stringify(it))) continue;
    Object.assign(prev, it);
    existing.revisions.push({ at: now, note: '修订条目 ' + it.id });
    revisedItems++; touched = true;
  }
  if (touched) { existing.updatedAt = now; if (ov.lead) existing.overview = ov.lead; if (ov.note) existing.overviewNote = ov.note; }
}

book.issues = Array.from(byDate.values()).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
book.generatedAt = now;
book.source = 'daily-ideas-agent';
const stats = { issues: book.issues.length, items: book.issues.reduce(function (n, i) { return n + i.items.length; }, 0), addedIssues: addedIssues, addedItems: addedItems, revisedItems: revisedItems, skipped: skipped };

if (privateHits.length) { console.error('拒绝导入：发现内部口径字段内容 -> ' + privateHits.slice(0, 5).join('; ')); process.exit(3); }
const changed = addedIssues + addedItems + revisedItems > 0;
if (checkOnly) { console.log('CHECK ' + JSON.stringify(stats) + (changed ? ' CHANGED' : ' CLEAN')); process.exit(changed ? 1 : 0); }
if (!changed && fs.existsSync(outFile)) { console.log('SKIP 无变化 ' + JSON.stringify(stats)); process.exit(0); }
fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
fs.writeFileSync(ledgerFile, JSON.stringify(book, null, 1) + '\n', 'utf8');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, renderTs(book), 'utf8');
console.log('OK ' + JSON.stringify(stats));
console.log('LEDGER ' + ledgerFile);
console.log('OUT ' + outFile);