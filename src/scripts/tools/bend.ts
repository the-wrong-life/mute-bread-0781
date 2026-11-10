import { bendAllowance } from './logic';

/** 钣金折弯展开计算器：输入即算，错误就地提示；不写入任何存储。 */
export function mountBend() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const thickness = el<HTMLInputElement>('bend-thickness');
  const radius = el<HTMLInputElement>('bend-radius');
  const angle = el<HTMLInputElement>('bend-angle');
  const k = el<HTMLInputElement>('bend-k');
  const legA = el<HTMLInputElement>('bend-leg-a');
  const legB = el<HTMLInputElement>('bend-leg-b');
  const status = el<HTMLElement>('bend-status');
  const result = el<HTMLElement>('bend-result');
  const detail = el<HTMLElement>('bend-detail');
  const copy = el<HTMLButtonElement>('bend-copy');
  const example = el<HTMLButtonElement>('bend-example');
  const copyStatus = el<HTMLElement>('bend-copy-status');
  if (!thickness || !radius || !angle || !k || !legA || !legB || !status || !result || !detail || !copy || !example || !copyStatus) return;

  let text = '';
  const fmt = (n: number, digits = 4) => Number(n.toPrecision(digits)).toString();

  function compute() {
    text = '';
    result.textContent = '—';
    detail.textContent = '';
    [thickness, radius, angle, k, legA, legB].forEach((i) => i.setAttribute('aria-invalid', 'false'));
    if (!thickness.value.trim() && !radius.value.trim() && !angle.value.trim() && !k.value.trim()) {
      status.textContent = '等待输入';
      return;
    }
    try {
      const r = bendAllowance({
        thickness: thickness.value,
        radius: radius.value,
        angle: angle.value,
        k: k.value,
        legA: legA.value,
        legB: legB.value,
      });
      const main = r.flat > 0 ? `展开长度 ${fmt(r.flat, 5)} mm` : `折弯扣除 ${fmt(r.deduction, 5)} mm`;
      result.textContent = main;
      detail.textContent = `中性层弧长 ${fmt(r.allowance, 5)} mm；单侧外侧退让 ${fmt(r.setback, 5)} mm；折弯扣除 ${fmt(r.deduction, 5)} mm${r.flat > 0 ? `；两边之和 ${fmt(r.legs, 5)} mm` : ''}。`;
      status.textContent = '计算完成';
      text = r.flat > 0
        ? `展开长度 ${fmt(r.flat, 5)} mm（BA ${fmt(r.allowance, 5)}，BD ${fmt(r.deduction, 5)}）`
        : `折弯扣除 ${fmt(r.deduction, 5)} mm（BA ${fmt(r.allowance, 5)}，OSSB ${fmt(r.setback, 5)}）`;
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法计算';
      status.textContent = message;
      const target = /料厚/.test(message) ? thickness
        : /半径/.test(message) ? radius
        : /折弯角|余角/.test(message) ? angle
        : /中性层系数/.test(message) ? k
        : /边 A|边 B|两边/.test(message) ? legA
        : null;
      target?.setAttribute('aria-invalid', 'true');
    }
  }

  [thickness, radius, angle, k, legA, legB].forEach((i) => i.addEventListener('input', compute));
  example.addEventListener('click', () => {
    thickness.value = '2';
    radius.value = '2';
    angle.value = '90';
    k.value = '0.44';
    legA.value = '40';
    legB.value = '30';
    compute();
  });
  copy.addEventListener('click', async () => {
    if (!text) {
      copyStatus.textContent = '没有可复制的结果。';
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = '已复制。';
    } catch {
      copyStatus.textContent = '浏览器拒绝访问剪贴板，请手动选择结果。';
    }
  });
  compute();
}
