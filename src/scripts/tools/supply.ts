import { supplyCurrent, type SupplyInput, type SupplyPhase } from './logic';

/** 电源容量与电流：输入即算，错误就地提示；不写入存储、不外发请求。 */
export function mountSupply() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const phase = el<HTMLSelectElement>('supply-phase');
  const inputMode = el<HTMLSelectElement>('supply-input');
  const value = el<HTMLInputElement>('supply-value');
  const valueLabel = el<HTMLElement>('supply-value-label');
  const voltage = el<HTMLInputElement>('supply-voltage');
  const pf = el<HTMLInputElement>('supply-pf');
  const status = el<HTMLElement>('supply-status');
  const result = el<HTMLElement>('supply-result');
  const detail = el<HTMLElement>('supply-detail');
  const copy = el<HTMLButtonElement>('supply-copy');
  const example = el<HTMLButtonElement>('supply-example');
  const copyStatus = el<HTMLElement>('supply-copy-status');
  if (!phase || !inputMode || !value || !valueLabel || !voltage || !pf || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function refreshLabel() {
    valueLabel.textContent = inputMode.value === 'kva' ? '视在功率 S kVA' : '有功功率 P kW';
  }

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    [value, voltage, pf].forEach((i) => i.setAttribute('aria-invalid', 'false'));
    if (!value.value.trim()) { status.textContent = '等待输入'; return; }
    try {
      const r = supplyCurrent({
        phase: phase.value as SupplyPhase,
        input: inputMode.value as SupplyInput,
        value: value.value,
        voltage: voltage.value,
        pf: pf.value,
      });
      const amps = fmt(r.current, 4) + ' A';
      result.textContent = '线电流 ' + amps;
      const phaseText = phase.value === 'three' ? '三相' : '单相';
      detail.textContent = phaseText + ' ' + fmt(r.apparent, 5) + ' kVA，有功 ' + fmt(r.active, 5) + ' kW，无功 ' + fmt(r.reactive, 5) + ' kvar（线电压 ' + fmt(Number(voltage.value), 5) + ' V，cosφ ' + fmt(Number(pf.value), 3) + '）。';
      status.textContent = '计算完成';
      text = '线电流 ' + amps + '；视在功率 ' + fmt(r.apparent, 5) + ' kVA；有功 ' + fmt(r.active, 5) + ' kW；无功 ' + fmt(r.reactive, 5) + ' kvar';
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /电压/.test(message) ? voltage : /功率因数/.test(message) ? pf : /功率|视在/.test(message) ? value : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  phase.addEventListener('change', compute);
  inputMode.addEventListener('change', () => { refreshLabel(); compute(); });
  [value, voltage, pf].forEach((i) => i.addEventListener('input', compute));
  example.addEventListener('click', () => {
    phase.value = 'three'; inputMode.value = 'kw'; refreshLabel();
    value.value = '15'; voltage.value = '380'; pf.value = '0.85';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  refreshLabel();
  compute();
}
