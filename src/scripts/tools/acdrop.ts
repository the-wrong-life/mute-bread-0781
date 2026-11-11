import { acCableDrop, type AcSystem } from './logic';

/** 交流电缆压降计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountAcDrop() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const system = el<HTMLSelectElement>('ac-system');
  const voltage = el<HTMLInputElement>('ac-voltage');
  const current = el<HTMLInputElement>('ac-current');
  const length = el<HTMLInputElement>('ac-length');
  const area = el<HTMLInputElement>('ac-area');
  const rho = el<HTMLSelectElement>('ac-rho');
  const pf = el<HTMLInputElement>('ac-pf');
  const x = el<HTMLInputElement>('ac-x');
  const limit = el<HTMLSelectElement>('ac-limit');
  const status = el<HTMLElement>('ac-status');
  const result = el<HTMLElement>('ac-result');
  const detail = el<HTMLElement>('ac-detail');
  const copy = el<HTMLButtonElement>('ac-copy');
  const example = el<HTMLButtonElement>('ac-example');
  const copyStatus = el<HTMLElement>('ac-copy-status');
  if (!system || !voltage || !current || !length || !area || !rho || !pf || !x || !limit || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    const inputs = [voltage, current, length, area, pf, x];
    inputs.forEach((input) => input.setAttribute('aria-invalid', 'false'));
    const blank = !voltage.value.trim() && !current.value.trim() && !length.value.trim() && !area.value.trim();
    if (blank) { status.textContent = '等待输入'; return; }
    try {
      const r = acCableDrop({
        system: system.value as AcSystem, voltage: voltage.value, current: current.value,
        length: length.value, area: area.value, rho: rho.value, pf: pf.value, x: x.value, limit: limit.value,
      });
      const verdict = r.pass ? '通过' : '超过允许值';
      result.textContent = `${fmt(r.drop, 4)} V · ${fmt(r.percent, 3)}% · ${verdict}`;
      detail.textContent = `负载端 ${fmt(r.endVoltage, 5)} V；R′ ${fmt(r.rKm, 4)} Ω/km；X′ ${fmt(r.xKm, 3)} Ω/km；sinφ ${fmt(r.sinPhi, 4)}；判定基准 ${fmt(r.limitPercent, 3)}%。`;
      status.textContent = r.pass ? '计算完成，满足允许压降' : '计算完成，超过允许压降，建议加粗导体或缩短线路';
      text = `压降 ${fmt(r.drop, 4)} V（${fmt(r.percent, 3)}%，${verdict}），负载端 ${fmt(r.endVoltage, 5)} V`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /线电压/.test(message) ? voltage : /负载电流/.test(message) ? current
        : /线长/.test(message) ? length : /截面积/.test(message) ? area
        : /功率因数/.test(message) ? pf : /电抗/.test(message) ? x : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [voltage, current, length, area, pf, x].forEach((input) => input.addEventListener('input', compute));
  [system, rho, limit].forEach((sel) => sel.addEventListener('change', compute));
  example.addEventListener('click', () => {
    system.value = 'ac3'; rho.value = '0.0175'; limit.value = '5';
    voltage.value = '400'; current.value = '100'; length.value = '50'; area.value = '25';
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
