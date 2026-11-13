import { cableDerate, type InsulationType } from './logic';

/** 电缆载流量温度/成组修正计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountCarryDerate() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const insulation = el<HTMLSelectElement>('carry-insulation');
  const iz0 = el<HTMLInputElement>('carry-iz0');
  const ambient = el<HTMLInputElement>('carry-ambient');
  const ref = el<HTMLInputElement>('carry-ref');
  const group = el<HTMLInputElement>('carry-group');
  const status = el<HTMLElement>('carry-status');
  const result = el<HTMLElement>('carry-result');
  const detail = el<HTMLElement>('carry-detail');
  const copy = el<HTMLButtonElement>('carry-copy');
  const example = el<HTMLButtonElement>('carry-example');
  const copyStatus = el<HTMLElement>('carry-copy-status');
  if (!insulation || !iz0 || !ambient || !ref || !group || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  let copyToken = 0;
  const fmt = (n: number, digits = 2) => n.toFixed(digits).replace(/\.?0+$/, '') || '0';

  function compute() {
    copyToken += 1;
    copyStatus.textContent = '';
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    [iz0, ambient, ref, group].forEach((input) => input.setAttribute('aria-invalid', 'false'));
    if (!iz0.value.trim() && !ambient.value.trim()) { status.textContent = '等待输入'; return; }
    try {
      const r = cableDerate({
        insulation: insulation.value as InsulationType,
        iz0: iz0.value, ambient: ambient.value, ref: ref.value, group: group.value,
      });
      result.textContent = fmt(r.iz) + ' A';
      const change = r.deratePercent >= 0
        ? '降额 ' + fmt(r.deratePercent, 1) + '%'
        : '系数大于 1，环境温度低于基准温度，请按标准表核对';
      detail.textContent = '温度修正 ' + r.kTemp.toFixed(4) + ' × 成组与敷设 ' + fmt(Number(group.value), 3)
        + ' = ' + r.k.toFixed(4) + '；基准载流量 ' + fmt(Number(iz0.value), 1) + ' A → 修正后 ' + fmt(r.iz) + ' A；'
        + change + '；导体最高 ' + r.tMax + ' ℃，基准环境 ' + fmt(Number(ref.value), 1) + ' ℃，实际环境 '
        + fmt(Number(ambient.value), 1) + ' ℃。';
      status.textContent = r.belowRef
        ? '计算完成：环境温度低于基准温度，公式给出大于 1 的系数，请按标准表核对'
        : '计算完成，修正后载流量 ' + fmt(r.iz) + ' A';
      text = '修正后载流量 ' + fmt(r.iz) + ' A（温度修正 ' + r.kTemp.toFixed(4) + '，综合系数 ' + r.k.toFixed(4)
        + '，' + change + '）';
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /基准载流量/.test(message) ? iz0
        : /成组与敷设/.test(message) ? group
        : /基准环境温度/.test(message) ? ref
        : /环境温度/.test(message) ? ambient : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [iz0, ambient, ref, group].forEach((input) => input.addEventListener('input', compute));
  insulation.addEventListener('change', compute);
  example.addEventListener('click', () => {
    insulation.value = 'pvc'; iz0.value = '41'; ambient.value = '40'; ref.value = '30'; group.value = '1';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    const pending = ++copyToken;
    const snapshot = text;
    copyStatus.textContent = '复制中…';
    let note = '已复制。';
    try { await navigator.clipboard.writeText(snapshot); }
    catch { note = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
    if (pending !== copyToken) return;
    copyStatus.textContent = note;
  });
  compute();
}
