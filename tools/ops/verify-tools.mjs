// 工程计算器与独立 oracle 的一致性校验。
// 用法：node tools/ops/verify-tools.mjs [--json <输出路径>]
// 依赖：tools/verify/vectors.json（输入）、tools/verify/expected.json（由 oracle.py 生成）。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  convertUnit, dcVoltageDrop, upsRuntime, bendAllowance, supplyCurrent, cabinetThermal,
  acCableDrop,
  acCableSize,
} from '../../src/scripts/tools/logic.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const vectors = JSON.parse(readFileSync(join(root, 'tools/verify/vectors.json'), 'utf8'));
const oracle = JSON.parse(readFileSync(join(root, 'tools/verify/expected.json'), 'utf8'));
const expectedById = new Map(oracle.cases.map((item) => [item.id, item.expected]));

const num = (value) => (value === null ? undefined : Number(value));

function run(tool, args) {
  switch (tool) {
    case 'convertUnit': return { value: convertUnit(args[0], args[1], args[2], args[3]) };
    case 'dcVoltageDrop': return dcVoltageDrop({ voltage: args[0], current: args[1], length: args[2], area: args[3], rho: args[4], kind: args[5] });
    case 'upsRuntime': return upsRuntime({ capacity: args[0], voltage: args[1], dod: args[2], efficiency: args[3], load: args[4] });
    case 'bendAllowance': return bendAllowance({ thickness: args[0], radius: args[1], angle: args[2], k: args[3], legA: num(args[4]) === undefined ? undefined : args[4], legB: num(args[5]) === undefined ? undefined : args[5] });
    case 'supplyCurrent': return supplyCurrent({ phase: args[0], input: args[1], value: args[2], voltage: args[3], pf: args[4] });
    case 'cabinetThermal': return cabinetThermal({ loss: args[0], area: args[1], ambient: args[2], inside: args[3], k: args[4], safety: args[5] });
    case 'acCableSize': return acCableSize({ system: args[0], voltage: args[1], current: args[2], length: args[3], rho: args[4], pf: args[5], x: args[6], limit: args[7] });
  case 'acCableDrop': return acCableDrop({ system: args[0], voltage: args[1], current: args[2], length: args[3], area: args[4], rho: args[5], pf: args[6], x: args[7], limit: args[8] });
    default: throw new Error('未知工具 ' + tool);
  }
}

const compare = (a, b) => {
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  const diff = Math.abs(a - b);
  return diff <= vectors.tolerance.abs + vectors.tolerance.rel * Math.abs(b);
};

const rows = [];
let failures = 0;
for (const testCase of vectors.cases) {
  const want = expectedById.get(testCase.id);
  let got; let error = null;
  try { got = run(testCase.tool, testCase.args); } catch (err) { error = err instanceof Error ? err.message : String(err); }
  if (error) {
    failures += 1;
    rows.push({ id: testCase.id, tool: testCase.tool, status: 'ERROR', detail: error });
    continue;
  }
  const fields = Object.keys(want);
  const bad = fields.filter((field) => !compare(got[field], want[field]));
  if (bad.length) failures += 1;
  rows.push({
    id: testCase.id, tool: testCase.tool,
    status: bad.length ? 'FAIL' : 'PASS',
    values: Object.fromEntries(fields.map((field) => [field, got[field]])),
    detail: bad.length ? bad.map((field) => field + ': 期望 ' + want[field] + '，实际 ' + got[field]).join('；') : '',
  });
}

const errorRows = [];
let errorFailures = 0;
for (const testCase of vectors.errors) {
  let thrown = null;
  try { run(testCase.tool, testCase.args); } catch (err) { thrown = err instanceof Error ? err.message : String(err); }
  const ok = thrown !== null && thrown.includes(testCase.match);
  if (!ok) errorFailures += 1;
  errorRows.push({ id: testCase.id, tool: testCase.tool, status: ok ? 'PASS' : 'FAIL', message: thrown ?? '(未抛出)', match: testCase.match });
}

const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  totals: {
    cases: rows.length, casesPassed: rows.length - failures,
    errors: errorRows.length, errorsPassed: errorRows.length - errorFailures,
  },
  rows, errorRows,
};
const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex > -1 && process.argv[jsonIndex + 1]) writeFileSync(process.argv[jsonIndex + 1], JSON.stringify(report, null, 1));

for (const row of rows) console.log(row.status.padEnd(5), row.id.padEnd(4), row.detail);
for (const row of errorRows) if (row.status === 'FAIL') console.log('FAIL ', row.id, '期望报错包含「' + row.match + '」，实际：' + row.message);
console.log('数值用例 ' + report.totals.casesPassed + '/' + report.totals.cases + '，拒绝用例 ' + report.totals.errorsPassed + '/' + report.totals.errors);
if (failures + errorFailures) process.exitCode = 1;
