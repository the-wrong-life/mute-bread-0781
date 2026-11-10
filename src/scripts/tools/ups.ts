import { upsRuntime } from './logic';

/** UPS 备用时间计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountUps() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const capacity = el<HTMLInputElement>('ups-capacity');
  const voltage = el<HTMLSelectElement>('ups-voltage');
  const voltageCustom = el<HTMLInputElement>('ups-voltage-custom');
  const dod = el<HTMLInputElement>('ups-dod');
  const efficiency = el<HTMLInputElement>('ups-efficiency');
  const load = el<HTMLInputElement>('ups-load');
  const status = el<HTMLElement>('ups-status');
  const result = el<HTMLElement>('ups-result');
  const detail = el<HTMLElement>('ups-detail');
  const copy = el<HTMLButtonElement>('ups-copy');
  const example = el<HTMLButtonElement>('ups-example');
  const copyStatus = el<HTMLElement>('ups-copy-status');
  if (!capacity || !voltage || !voltageCustom || !dod || !efficiency || !load || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function refreshVoltageField() {
    voltageCustom.disabled = voltage.value !== 'custom';
    if (voltageCustom.disabled) voltageCustom.setAttribute('aria-disabled', 'true');
    else voltageCustom.removeAttribute('aria-disabled');
  }

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    [capacity, voltageCustom, dod, efficiency, load].forEach((i) => i.setAttribute('aria-invalid', 'false'));
    if (!capacity.value.trim() && !voltageCustom.value.trim() && !load.value.trim()) { status.textContent = '等待输入'; return; }
    const v = voltage.value === 'custom' ? voltageCustom.value : voltage.value;
    try {
      const r = upsRuntime({ capacity: capacity.value, voltage: v, dod: dod.value, efficiency: efficiency.value, load: load.value });
      const minutes = r.minutes;
      const human = minutes >= 120 ? `${fmt(r.hours, 5)} 小时（${fmt(minutes, 5)} 分钟）` : `${fmt(minutes, 4)} 分钟`;
      result.textContent = human;
      detail.textContent = `电池标称能量 ${fmt(r.nominalWh, 4)} Wh；计入放电深度后可用 ${fmt(r.usableWh, 4)} Wh；再计逆变效率后实际可送出 ${fmt(r.deliveredWh, 4)} Wh。`;
      status.textContent = '计算完成';
      text = `备用时间 ${human}，可用能量 ${fmt(r.deliveredWh, 4)} Wh`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /容量/.test(message) ? capacity : /电压/.test(message) ? voltageCustom
        : /放电深度/.test(message) ? dod : /效率/.test(message) ? efficiency : /功率/.test(message) ? load : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  voltage.addEventListener('change', () => { refreshVoltageField(); compute(); });
  [capacity, voltageCustom, dod, efficiency, load].forEach((i) => i.addEventListener('input', compute));
  example.addEventListener('click', () => {
    voltage.value = '24'; refreshVoltageField();
    capacity.value = '100'; dod.value = '80'; efficiency.value = '90'; load.value = '150';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  refreshVoltageField();
  compute();
}
