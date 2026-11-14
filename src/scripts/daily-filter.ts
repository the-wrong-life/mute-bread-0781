/**
 * 每日更新页的分类筛选。
 * 只用 aria-pressed 与 hidden 做状态，不隐藏整块列表：没有匹配项时显示一句说明，
 * 避免出现"点了按钮页面什么都不剩"的空屏。
 */
export function mountDailyFilter(): void {
  const bar = document.querySelector<HTMLElement>('[data-daily-filters], .filter-bar');
  const list = document.querySelector<HTMLElement>('[data-daily-list]');
  const empty = document.querySelector<HTMLElement>('[data-daily-empty]');
  if (!bar || !list) return;
  const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('button[data-cat]'));
  const entries = Array.from(list.querySelectorAll<HTMLElement>('[data-category]'));
  if (!buttons.length) return;

  const apply = (cat: string) => {
    let shown = 0;
    for (const entry of entries) {
      const hit = cat === '全部' || entry.dataset.category === cat;
      entry.hidden = !hit;
      if (hit) shown += 1;
    }
    for (const btn of buttons) btn.setAttribute('aria-pressed', String(btn.dataset.cat === cat));
    if (empty) empty.hidden = shown !== 0;
    list.hidden = shown === 0;
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => apply(btn.dataset.cat || '全部'));
  }
  apply('全部');
}
