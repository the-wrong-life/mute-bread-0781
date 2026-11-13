import { supplyCurrent, type SupplyBasis, type SupplyInput, type SupplyPhase } from './logic';

/** 电源容量与电流：输入即算，错误就地提示；不写入存储、不外发请求。
 *  支持两种输入基准：电网侧有功（默认）与机械轴功率（按效率折算），避免同一台电机在不同页面算出两个电流。 */
export function mountSupply() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const phase = el<HTMLSelectElement>('supply-phase');
  const inputMode = el<HTMLSelectElement>('supply-input');
  const basis = el<HTMLSelectElement>('supply-basis');
  const value = el<HTMLInputElement>('supply-value');
  const valueLabel = el<HTMLElement>('supply-value-label');
  const voltage = el<HTMLInputElement>('supply-voltage');
  const pf = el<HTMLInputElement>('supply-pf');
  const eff = el<HTMLInputElement>('supply-eff');
  const effWrap = el<HTMLElement>('supply-eff-wrap');
  const status = el<HTMLElement>('supply-status');
  const result = el<HTMLElement>('supply-result');
  const detail = el<HTMLElement>('supply-detail');
  const copy = el<HTMLButtonElement>('supply-copy');
  const example = el<HTMLButtonElement>('supply-example');
  const copyStatus = el<HTMLElement>('supply-copy-status');
  if (!phase || !inputMode || !basis || !value || !valueLabel || !voltage || !pf || !eff || !effWrap || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  /** 轴功率基准下功率类型被强制为 kW；切回电网侧时恢复用户原先选的 kVA，避免单位静默改变。 */
  let lineMode: SupplyInput = 'kw';
  /** 异步复制的令牌：重算或再次复制都会让它自增，旧 promise 的回调据此丢弃。 */
  let copyToken = 0;
  function refreshLabel() {
    const shaft = basis.value === 'shaft';
    effWrap.hidden = !shaft;
    inputMode.disabled = shaft;
    if (shaft) {
      if (inputMode.value !== 'kw') lineMode = inputMode.value as SupplyInput;
      inputMode.value = 'kw';
    } else if (lineMode === 'kva') {
      inputMode.value = 'kva';
    }
    valueLabel.textContent = shaft
      ? '轴功率 P_out kW'
      : inputMode.value === 'kva' ? '视在功率 S kVA' : '有功功率 P kW';
  }

  function compute() {
    text = '';
    copyStatus.textContent = '';
    copyToken += 1;
    result.textContent = '—';
    detail.textContent = '';
    [value, voltage, pf, eff].forEach((i) => i.setAttribute('aria-invalid', 'false'));
    if (!value.value.trim()) { status.textContent = '等待输入'; return; }
    try {
      const shaft = basis.value === 'shaft';
      const r = supplyCurrent({
        phase: phase.value as SupplyPhase,
        input: inputMode.value as SupplyInput,
        value: value.value,
        voltage: voltage.value,
        pf: pf.value,
        basis: basis.value as SupplyBasis,
        efficiency: shaft ? eff.value : undefined,
      });
      const amps = fmt(r.current, 4) + ' A';
      result.textContent = '线电流 ' + amps;
      const phaseText = phase.value === 'three' ? '三相' : '单相';
      const shaftNote = shaft
        ? '轴功率 ' + fmt(Number(value.value), 5) + ' kW，效率 ' + fmt(Number(eff.value), 4) + '%，折算到电网侧 '
          + fmt(r.active, 5) + ' kW；'
        : '';
      detail.textContent = shaftNote + phaseText + ' ' + fmt(r.apparent, 5) + ' kVA，有功 ' + fmt(r.active, 5)
        + ' kW，无功 ' + fmt(r.reactive, 5) + ' kvar（线电压 ' + fmt(Number(voltage.value), 5) + ' V，cosφ '
        + fmt(Number(pf.value), 3) + '）。';
      status.textContent = '计算完成';
      text = '线电流 ' + amps + '；视在功率 ' + fmt(r.apparent, 5) + ' kVA；有功 ' + fmt(r.active, 5) + ' kW；无功 '
        + fmt(r.reactive, 5) + ' kvar';
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /效率/.test(message) ? eff
        : /电压/.test(message) ? voltage
        : /功率因数/.test(message) ? pf
        : /功率|视在|轴功率/.test(message) ? value : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  phase.addEventListener('change', compute);
  basis.addEventListener('change', () => { refreshLabel(); compute(); });
  inputMode.addEventListener('change', () => {
    if (basis.value !== 'shaft') lineMode = inputMode.value as SupplyInput;
    refreshLabel();
    compute();
  });
  [value, voltage, pf, eff].forEach((i) => i.addEventListener('input', compute));
  example.addEventListener('click', () => {
    phase.value = 'three'; basis.value = 'line'; lineMode = 'kw'; inputMode.value = 'kw';
    value.value = '15'; voltage.value = '380'; pf.value = '0.85'; eff.value = '88.8';
    refreshLabel(); compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    const pending = ++copyToken;
    const snapshot = text;
    // 先清掉上一次的「已复制」，避免第二次请求未完成时仍显示上次的成功提示。
    copyStatus.textContent = '复制中…';
    try {
      await navigator.clipboard.writeText(snapshot);
      // 复制是异步的：期间用户可能改输入触发重算，此时不再回写旧提示。
      if (pending === copyToken) copyStatus.textContent = '已复制。';
    } catch {
      if (pending === copyToken) copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。';
    }
  });
  refreshLabel();
  compute();
}
