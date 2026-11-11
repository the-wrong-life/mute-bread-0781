// 札记列表的分类与关键词过滤：全部在页面内完成，不请求索引。
// 条目文字预先渲染在页面里，因此首屏无网络请求，键盘与读屏器都能拿到真实链接。
export function mountPostFinder(): void {
  const query = document.getElementById('post-query') as HTMLInputElement | null;
  const kindSelect = document.getElementById('post-kind') as HTMLSelectElement | null;
  const counter = document.getElementById('post-count');
  const emptyHint = document.getElementById('post-empty');
  const entries = Array.from(document.querySelectorAll<HTMLElement>('#post-list article.entry'));
  if (entries.length === 0) return;

  const textOf = new Map<HTMLElement, string>();
  for (const el of entries) textOf.set(el, (el.textContent ?? '').toLowerCase());

  function apply(): void {
    const raw = (query?.value ?? '').trim().toLowerCase();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const wanted = kindSelect?.value ?? '';
    let shown = 0;
    for (const el of entries) {
      const kindOk = !wanted || el.dataset.category === wanted;
      const textOk = tokens.every((token) => (textOf.get(el) ?? '').includes(token));
      const visible = kindOk && textOk;
      el.hidden = !visible;
      if (visible) shown += 1;
    }
    if (counter) {
      counter.textContent =
        tokens.length || wanted ? '显示 ' + shown + ' / 共 ' + entries.length + ' 篇' : entries.length + ' 篇札记';
    }
    if (emptyHint) emptyHint.hidden = shown !== 0;
  }

  if (query) query.addEventListener('input', apply);
  if (kindSelect) kindSelect.addEventListener('change', apply);
  apply();
}
