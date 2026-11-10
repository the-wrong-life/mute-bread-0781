import { dcVoltageDrop, type DropKind } from './logic';

/** 直流线路压降计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountDcDrop() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const voltage = el<HTMLInputElement>('dc-voltage');
  const current = el<HTMLInputElement>('dc-current');
  const length = el<HTMLInputElement>('dc-length');
  const area = el<HTMLInputElement>('dc-area');
  const rhoSel = el<HTMLSelectElement>('dc-rho');
  const rhoCustom = el<HTMLInputElement>('dc-rho-custom');
  const kind = el<HTMLSelectElement>('dc-kind');
  const status = el<HTMLElement>('dc-status');
  const result = el<HTMLElement>('dc-result');
  const detail = el<HTMLElement>('dc-detail');
  const copy = el<HTMLButtonElement>('dc-copy');
  const example = el<HTMLButtonElement>('dc-example');
  const copyStatus = el<HTMLElement>('dc-copy-status');
  if (!voltage || !current || !length || !area || !rhoSel || !rhoCustom || !kind || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function refreshRhoField() {
    rhoCustom.disabled = rhoSel.value !== 'custom';
    if (rhoCustom.disabled) rhoCustom.setAttribute('aria-disabled', 'true');
    else rhoCustom.removeAttribute('aria-disabled');
  }

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    const inputs = [voltage, current, length, area, rhoCustom];
    inputs.forEach((input) => input.setAttribute('aria-invalid', 'false'));
    const blank = !voltage.value.trim() && !current.value.trim() && !length.value.trim() && !area.value.trim();
    if (blank) { status.textContent = '等待输入'; return; }
    const rho = rhoSel.value === 'custom' ? rhoCustom.value : rhoSel.value;
    try {
      const r = dcVoltageDrop({
        voltage: voltage.value, current: current.value, length: length.value,
        area: area.value, rho, kind: kind.value as DropKind,
      });
      const warn = r.percent > 10 ? '（超过 10%，建议加粗导体或缩短线路后再核算）' : r.percent > 5 ? '（超过常用 5% 参考值，请复核）' : '';
      result.textContent = `${fmt(r.drop, 4)} V · ${fmt(r.percent, 3)}%`;
      detail.textContent = `负载端 ${fmt(r.endVoltage, 5)} V；回路总长 ${fmt(r.loopLength, 4)} m；回路电阻 ${fmt(r.resistance, 4)} Ω。${warn}`;
      status.textContent = '计算完成';
      text = `压降 ${fmt(r.drop, 4)} V（${fmt(r.percent, 3)}%），负载端 ${fmt(r.endVoltage, 5)} V`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /电源电压/.test(message) ? voltage : /负载电流/.test(message) ? current
        : /线长/.test(message) ? length : /截面积/.test(message) ? area
        : /电阻率/.test(message) ? rhoCustom : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  rhoSel.addEventListener('change', () => { refreshRhoField(); compute(); });
  [voltage, current, length, area, rhoCustom].forEach((input) => input.addEventListener('input', compute));
  kind.addEventListener('change', compute);
  example.addEventListener('click', () => {
    kind.value = 'dc2'; rhoSel.value = '0.0175'; refreshRhoField();
    voltage.value = '24'; current.value = '5'; length.value = '10'; area.value = '2.5';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  refreshRhoField();
  compute();
}
