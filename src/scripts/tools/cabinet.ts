import { cabinetThermal } from './logic';

/** 电气柜热损耗与散热：输入即算，错误就地提示；不外发请求。 */
export function mountCabinet() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const loss = el<HTMLInputElement>('cabinet-loss');
  const area = el<HTMLInputElement>('cabinet-area');
  const ambient = el<HTMLInputElement>('cabinet-ambient');
  const inside = el<HTMLInputElement>('cabinet-inside');
  const k = el<HTMLSelectElement>('cabinet-k');
  const safety = el<HTMLSelectElement>('cabinet-safety');
  const status = el<HTMLElement>('cabinet-status');
  const result = el<HTMLElement>('cabinet-result');
  const detail = el<HTMLElement>('cabinet-detail');
  const copy = el<HTMLButtonElement>('cabinet-copy');
  const example = el<HTMLButtonElement>('cabinet-example');
  const copyStatus = el<HTMLElement>('cabinet-copy-status');
  if (!loss || !area || !ambient || !inside || !k || !safety || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    [loss, area, ambient, inside].forEach((i) => i.setAttribute('aria-invalid', 'false'));
    if (!loss.value.trim() || !area.value.trim()) { status.textContent = '等待输入'; return; }
    try {
      const r = cabinetThermal({
        loss: loss.value,
        area: area.value,
        ambient: ambient.value,
        inside: inside.value,
        k: k.value,
        safety: safety.value,
      });
      if (r.passiveOk) {
        const margin = r.natural - Number(loss.value);
        result.textContent = '自然散热足够';
        detail.textContent = '温升 ' + fmt(r.deltaT, 3) + ' K；表面积 ' + fmt(r.area, 4) + ' m² 的自然散热能力约 ' + fmt(r.natural, 4) + ' W，余量 ' + fmt(margin, 4) + ' W。柜体需保持进出风空间，不得被遮挡。';
        status.textContent = '计算完成';
        text = '自然散热足够：能力 ' + fmt(r.natural, 4) + ' W，余量 ' + fmt(margin, 4) + ' W，温升 ' + fmt(r.deltaT, 3) + ' K';
      } else {
        result.textContent = '需强制通风 ' + fmt(r.airflow, 3) + ' m³/h';
        detail.textContent = '温升 ' + fmt(r.deltaT, 3) + ' K；自然散热能力约 ' + fmt(r.natural, 4) + ' W，不足 ' + fmt(Number(loss.value) - r.natural, 4) + ' W；理论风量 ' + fmt(r.airflowBase, 4) + ' m³/h，含安全系数后 ' + fmt(r.airflow, 4) + ' m³/h。';
        status.textContent = '计算完成';
        text = '需强制通风 ' + fmt(r.airflow, 3) + ' m³/h（理论 ' + fmt(r.airflowBase, 4) + ' m³/h，温升 ' + fmt(r.deltaT, 3) + ' K，自然散热 ' + fmt(r.natural, 4) + ' W）';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /损耗/.test(message) ? loss : /面积/.test(message) ? area
        : /环境温度/.test(message) ? ambient : /柜内|温升/.test(message) ? inside
        : /换热/.test(message) ? k : /安全系数/.test(message) ? safety : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [loss, area, ambient, inside].forEach((i) => i.addEventListener('input', compute));
  [k, safety].forEach((s) => s.addEventListener('change', compute));
  example.addEventListener('click', () => {
    loss.value = '500'; area.value = '3.0'; ambient.value = '35'; inside.value = '45';
    k.value = '5.5'; safety.value = '1.25';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) { copyStatus.textContent = '没有可复制的结果。'; return; }
    try { await navigator.clipboard.writeText(text); copyStatus.textContent = '已复制。'; }
    catch { copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。'; }
  });
  compute();
}
