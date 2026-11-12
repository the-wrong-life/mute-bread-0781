import { conduitFill } from './logic';

/** 电缆穿管填充率计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountConduitFill() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const diameter = el<HTMLInputElement>('cfill-diameter');
  const diaA = el<HTMLInputElement>('cfill-dia-a');
  const countA = el<HTMLInputElement>('cfill-count-a');
  const diaB = el<HTMLInputElement>('cfill-dia-b');
  const countB = el<HTMLInputElement>('cfill-count-b');
  const status = el<HTMLElement>('cfill-status');
  const result = el<HTMLElement>('cfill-result');
  const detail = el<HTMLElement>('cfill-detail');
  const copy = el<HTMLButtonElement>('cfill-copy');
  const example = el<HTMLButtonElement>('cfill-example');
  const copyStatus = el<HTMLElement>('cfill-copy-status');
  if (!diameter || !diaA || !countA || !diaB || !countB || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 2) => n.toFixed(digits).replace(/\.?0+$/, '') || '0';

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    const inputs = [diameter, diaA, countA, diaB, countB];
    inputs.forEach((input) => input.setAttribute('aria-invalid', 'false'));
    const blank = !diameter.value.trim() && !diaA.value.trim() && !countA.value.trim();
    if (blank) { status.textContent = '等待输入'; return; }
    try {
      const r = conduitFill({
        diameter: diameter.value, diaA: diaA.value, countA: countA.value,
        diaB: diaB.value, countB: countB.value,
      });
      const verdict = r.pass ? '通过' : '超过上限';
      result.textContent = `${fmt(r.fillPercent)}% · ${verdict}`;
      detail.textContent = `管内净截面 ${fmt(r.tubeArea, 2)} mm²；电缆占用 ${fmt(r.cableArea, 2)} mm²；剩余 ${fmt(r.spareArea, 2)} mm²；共 ${r.total} 根，上限 ${r.limitPercent}%；按上限同外径最多 ${r.maxCount} 根。`;
      status.textContent = r.pass ? '计算完成，填充率在上限内' : '计算完成，填充率超过上限，建议加大管径或分流';
      text = `填充率 ${fmt(r.fillPercent)}%（${verdict}），${r.total} 根，上限 ${r.limitPercent}%`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /第二组电缆外径/.test(message) ? diaB
        : /未填|第二组电缆根数/.test(message) ? countB
        : /电缆外径/.test(message) ? diaA
        : /根数/.test(message) ? countA
        : /管内径/.test(message) ? diameter : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [diameter, diaA, countA, diaB, countB].forEach((input) => input.addEventListener('input', compute));
  example.addEventListener('click', () => {
    diameter.value = '50'; diaA.value = '14'; countA.value = '3'; diaB.value = ''; countB.value = '';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  compute();
}
