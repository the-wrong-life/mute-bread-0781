import { acCableSize, type AcSystem } from './logic';

/** 按允许压降反算最小截面：输入即算，错误就地提示；不写入任何存储。 */
export function mountAcSize() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const system = el<HTMLSelectElement>('asz-system');
  const voltage = el<HTMLInputElement>('asz-voltage');
  const current = el<HTMLInputElement>('asz-current');
  const length = el<HTMLInputElement>('asz-length');
  const rho = el<HTMLSelectElement>('asz-rho');
  const pf = el<HTMLInputElement>('asz-pf');
  const x = el<HTMLInputElement>('asz-x');
  const limit = el<HTMLSelectElement>('asz-limit');
  const status = el<HTMLElement>('asz-status');
  const result = el<HTMLElement>('asz-result');
  const detail = el<HTMLElement>('asz-detail');
  const copy = el<HTMLButtonElement>('asz-copy');
  const example = el<HTMLButtonElement>('asz-example');
  const copyStatus = el<HTMLElement>('asz-copy-status');
  if (!system || !voltage || !current || !length || !rho || !pf || !x || !limit || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    const inputs = [voltage, current, length, pf, x];
    inputs.forEach((input) => input.setAttribute('aria-invalid', 'false'));
    const blank = !voltage.value.trim() && !current.value.trim() && !length.value.trim();
    if (blank) { status.textContent = '等待输入'; return; }
    try {
      const r = acCableSize({
        system: system.value as AcSystem, voltage: voltage.value, current: current.value,
        length: length.value, rho: rho.value, pf: pf.value, x: x.value, limit: limit.value,
      });
      const base = `允许 ${fmt(r.limitVolts, 4)} V（${fmt(r.limitPercent, 3)}%）；电抗分量 ${fmt(r.reactiveDrop, 4)} V；k ${fmt(r.factor, 5)}`;
      if (r.reactiveLimited) {
        result.textContent = `无解 · 电抗分量 ${fmt(r.reactiveDrop, 3)} V 已超允许值`;
        detail.textContent = `${base}。X′ 与截面无关，加粗导体不会降低这部分压降；需降低电流、缩短线路或提高电压。`;
        status.textContent = '计算完成，但电抗分量单独超限，没有可满足的标准截面';
        text = `无解：电抗分量 ${fmt(r.reactiveDrop, 4)} V 已超过允许压降 ${fmt(r.limitVolts, 4)} V`;
        return;
      }
      if (r.selected === null) {
        result.textContent = `需 ${fmt(r.required, 4)} mm² · 超出常用序列`;
        detail.textContent = `${base}。所需截面大于 630 mm²，建议改多根并联、缩短线路或提高电压等级。`;
        status.textContent = '计算完成，所需截面超出常用单根电缆序列';
        text = `所需最小截面 ${fmt(r.required, 4)} mm²，超出 630 mm² 常用序列`;
        return;
      }
      const verdict = r.percent <= r.limitPercent ? '通过' : '仍超标';
      result.textContent = `需 ${fmt(r.required, 3)} mm² → 选用 ${r.selected} mm² · ${fmt(r.drop, 4)} V · ${fmt(r.percent, 3)}% · ${verdict}`;
      detail.textContent = `${base}；R′ ${fmt(r.rKm, 4)} Ω/km；选用截面压降 ${fmt(r.drop, 4)} V，占 ${fmt(r.percent, 3)}%（限值 ${fmt(r.limitPercent, 3)}%）。`;
      status.textContent = r.percent <= r.limitPercent ? '计算完成，所选标准截面满足允许压降' : '计算完成，所选截面仍超过允许压降，请复核输入';
      text = `最小截面 ${fmt(r.required, 3)} mm²，选用 ${r.selected} mm²，压降 ${fmt(r.drop, 4)} V（${fmt(r.percent, 3)}%，${verdict}）`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /线电压/.test(message) ? voltage : /负载电流/.test(message) ? current
        : /线长/.test(message) ? length
        : /功率因数/.test(message) ? pf : /电抗/.test(message) ? x : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [voltage, current, length, pf, x].forEach((input) => input.addEventListener('input', compute));
  [system, rho, limit].forEach((sel) => sel.addEventListener('change', compute));
  example.addEventListener('click', () => {
    system.value = 'ac3'; rho.value = '0.0175'; limit.value = '5';
    voltage.value = '400'; current.value = '100'; length.value = '50';
    pf.value = '0.85'; x.value = '0.08';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  compute();
}
