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
  const figure = el<HTMLButtonElement>('bend-figure');
  const copyStatus = el<HTMLElement>('bend-copy-status');
  if (!thickness || !radius || !angle || !k || !legA || !legB || !status || !result || !detail || !copy || !example || !figure || !copyStatus) return;

  let text = '';
  // 统一口径：定点 4 位小数再去尾零，与 /docs/bend-allowance 与案例中的写作精度一致。
  const fmt = (n: number) => n.toFixed(4).replace(/\.?0+$/, '') || '0';

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
      const main = r.flat > 0 ? `展开长度 ${fmt(r.flat)} mm` : `折弯扣除 ${fmt(r.deduction)} mm`;
      result.textContent = main;
      detail.textContent = `中性层弧长 ${fmt(r.allowance)} mm；单侧外侧退让 ${fmt(r.setback)} mm；折弯扣除 ${fmt(r.deduction)} mm${r.flat > 0 ? `；两边之和 ${fmt(r.legs)} mm` : ''}。`;
      status.textContent = '计算完成';
      text = r.flat > 0
        ? `展开长度 ${fmt(r.flat)} mm（BA ${fmt(r.allowance)}，BD ${fmt(r.deduction)}）`
        : `折弯扣除 ${fmt(r.deduction)} mm（BA ${fmt(r.allowance)}，OSSB ${fmt(r.setback)}）`;
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
  // 与 /docs/bend-allowance 截面图同一组参数：T=20、R=60、θ=90°、K=0.44，两边留空。
  figure.addEventListener('click', () => {
    thickness.value = '20';
    radius.value = '60';
    angle.value = '90';
    k.value = '0.44';
    legA.value = '';
    legB.value = '';
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
