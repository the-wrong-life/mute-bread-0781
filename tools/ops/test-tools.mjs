// 工具箱纯函数测试：不启动浏览器，直接用 Node 的类型剥离运行 TS 源文件。
import base from 'node:assert/strict';
import { convertUnit, dcVoltageDrop, upsRuntime, cabinetThermal, tidyLines, parseJson } from '../../src/scripts/tools/logic.ts';

let pass = 0;
// 断言计数改为真实统计：每次断言调用加一，避免手写数字与实际条数脱节。
const assert = new Proxy(base, {
  get(target, key) {
    const value = target[key];
    if (typeof value !== 'function') return value;
    return (...args) => { pass += 1; return value.apply(target, args); };
  },
});
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `期望 ${b}，实际 ${a}`);
const throws = (fn, re) => assert.throws(fn, re);

// 1. 单位换算边界
near(convertUnit('25.4', 'length', 'mm', 'in'), 1);
near(convertUnit('-40', 'temperature', '°C', '°F'), -40);
near(convertUnit('1', 'power', 'hp', 'W'), 745.6998715822702);
throws(() => convertUnit('', 'length', 'mm', 'in'), /请输入数值/);
throws(() => convertUnit('abc', 'length', 'mm', 'in'), /有效的十进制数字/);
throws(() => convertUnit('-300', 'temperature', '°C', 'K'), /绝对零度/);
throws(() => convertUnit('1e20', 'length', 'mm', 'in'), /绝对值/);

// 2. 直流压降：文档算例 24 V / 5 A / 10 m / 2.5 mm² / ρ 0.0175 → 0.70 V、2.9167%
const two = dcVoltageDrop({ voltage: '24', current: '5', length: '10', area: '2.5', rho: '0.0175', kind: 'dc2' });
near(two.drop, 0.7, 1e-12); near(two.percent, 2.9166666666666665, 1e-9);
near(two.endVoltage, 23.3, 1e-12); near(two.resistance, 0.14, 1e-12); near(two.loopLength, 20, 1e-12);
const one = dcVoltageDrop({ voltage: '24', current: '5', length: '10', area: '2.5', rho: '0.0175', kind: 'dc1' });
near(one.drop, 0.35, 1e-12); near(one.loopLength, 10, 1e-12);
const zero = dcVoltageDrop({ voltage: '12', current: '0', length: '5', area: '1', rho: '0.0175', kind: 'dc2' });
near(zero.drop, 0, 1e-12);
throws(() => dcVoltageDrop({ voltage: '', current: '5', length: '10', area: '2.5', rho: '0.0175', kind: 'dc2' }), /请填写电源电压/);
throws(() => dcVoltageDrop({ voltage: '0', current: '5', length: '10', area: '2.5', rho: '0.0175', kind: 'dc2' }), /必须大于 0/);
throws(() => dcVoltageDrop({ voltage: '24', current: '-1', length: '10', area: '2.5', rho: '0.0175', kind: 'dc2' }), /不能为负数/);
throws(() => dcVoltageDrop({ voltage: '24', current: '5', length: '200000', area: '2.5', rho: '0.0175', kind: 'dc2' }), /100 km/);
throws(() => dcVoltageDrop({ voltage: '24', current: '5', length: '10', area: '2000', rho: '0.0175', kind: 'dc2' }), /mm²/);
throws(() => dcVoltageDrop({ voltage: '1', current: '100', length: '10', area: '0.5', rho: '0.0175', kind: 'dc2' }), /超过电源电压/);

// 3. UPS 备用时间：100 Ah × 24 V × 80% DoD × 90% 效率 ÷ 150 W
const ups = upsRuntime({ capacity: '100', voltage: '24', dod: '80', efficiency: '90', load: '150' });
near(ups.nominalWh, 2400);
near(ups.usableWh, 1920);
near(ups.deliveredWh, 1728);
near(ups.minutes, 691.2);
throws(() => upsRuntime({ capacity: '0', voltage: '24', dod: '80', efficiency: '90', load: '150' }), /容量/);
throws(() => upsRuntime({ capacity: '100', voltage: '24', dod: '120', efficiency: '90', load: '150' }), /放电深度/);
throws(() => upsRuntime({ capacity: '100', voltage: '24', dod: '80', efficiency: '0', load: '150' }), /效率/);
throws(() => upsRuntime({ capacity: '100', voltage: '24', dod: '80', efficiency: '90', load: '0' }), /功率/);

// 4. 文本与 JSON
assert.equal(tidyLines('a\n\na \nb', true, false).text, 'a\nb');
assert.equal(tidyLines('b\na', true, true).text, 'a\nb');
assert.equal(parseJson('{"a":1}').ok, true);
assert.equal(parseJson('{a:1}').ok, false);

// 5. 机柜散热：与 tools/verify/expected.json 的 c5–c9 同输入，数值必须与独立实现一致
const cab = (a, b, c, d, e, f) => cabinetThermal({ loss: a, area: b, ambient: c, inside: d, k: e, safety: f });
const main = cab('500', '3.0', '35', '45', '5.5', '1.25');
near(main.deltaT, 10); near(main.natural, 165); near(main.airflowBase, 156); near(main.airflow, 195);
assert.equal(main.passiveOk, false);
const edge = cab('165', '3.0', '35', '45', '5.5', '1.25');
assert.equal(edge.passiveOk, true); near(edge.airflow, 64.35, 1e-9);
const wide = cab('500', '9.1', '35', '45', '5.5', '1.25');
near(wide.natural, 500.5, 1e-12); assert.equal(wide.passiveOk, true);
near(cab('500', '3.0', '35', '55', '5.5', '1.25').airflow, 97.5, 1e-12);
throws(() => cab('500', '3.0', '45', '45', '5.5', '1.25'), /必须高于环境温度/);
throws(() => cab('500', '3.0', '35', '45', '0.5', '1.25'), /换热系数/);
throws(() => cab('500', '3.0', '35', '45', '5.5', '4'), /安全系数/);
throws(() => cab('300000', '3.0', '35', '45', '5.5', '1.25'), /200 kW/);

console.log(`PASS ${pass} 项断言`);
