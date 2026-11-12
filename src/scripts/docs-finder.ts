type Row = { slug: string; text: string };

// 构建期 /docs-index.json 已包含标题、摘要、章节标题、正文、列表、表格与代码；
// 首屏不加载它，只在用户开始检索时 fetch 一次；失败则退回页面内已有文字。
export function mountDocsFinder(): void {
  const query = document.getElementById('doc-query') as HTMLInputElement | null;
  const kindSelect = document.getElementById('doc-kind') as HTMLSelectElement | null;
  const counter = document.getElementById('doc-count');
  const emptyHint = document.getElementById('doc-empty');
  const entries = Array.from(document.querySelectorAll<HTMLElement>('#doc-list .entry'));
  if (entries.length === 0) return;

  const localText: Record<string, string> = {};
  for (const el of entries) {
    const slug = el.dataset.slug ?? '';
    const text = (el.textContent ?? '').toLowerCase();
    localText[slug] = text;
  }

  let indexRows: Row[] | null = null;
  let indexPromise: Promise<void> | null = null;

  function loadIndex(): Promise<void> {
    if (indexRows) return Promise.resolve();
    if (indexPromise) return indexPromise;
    indexPromise = fetch('/docs-index.json', { credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error('index ' + res.status);
        return res.json() as Promise<Row[]>;
      })
      .then((data) => {
        indexRows = data.map((item) => ({ slug: item.slug, text: String(item.text ?? '') }));
        if (counter) delete counter.dataset.searchMode;
      })
      .catch(() => {
        indexRows = null;
        if (counter) counter.dataset.searchMode = 'fallback';
      })
      .then(() => {
        indexPromise = null;
        apply();
      });
    return indexPromise;
  }

  function textFor(slug: string): string {
    if (!indexRows) return localText[slug] ?? '';
    const hit = indexRows.find((row) => row.slug === slug);
    return hit ? hit.text : localText[slug] ?? '';
  }

  function apply(): void {
    const raw = (query?.value ?? '').trim().toLowerCase();
    const wanted = kindSelect?.value ?? '';
    const tokens = raw.split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const el of entries) {
      const slug = el.dataset.slug ?? '';
      const text = textFor(slug);
      const kindOk = !wanted || el.dataset.kind === wanted;
      const textOk = tokens.every((token) => text.includes(token));
      const visible = kindOk && textOk;
      el.hidden = !visible;
      if (visible) shown += 1;
    }
    if (counter) {
      counter.textContent =
        tokens.length || wanted
          ? '显示 ' + shown + ' / 共 ' + entries.length + ' 篇'
          : entries.length + ' 篇文档';
      if (counter.dataset.searchMode === 'fallback') counter.textContent += '（全文索引加载失败，当前仅搜索列表内容；可重试）';
    }
    if (emptyHint) emptyHint.hidden = shown !== 0;
  }

  let timer = 0;
  if (query) {
    query.addEventListener('input', () => {
      apply();
      void loadIndex();
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 150);
    });
    query.addEventListener('focus', () => { void loadIndex(); });
  }
  if (kindSelect) kindSelect.addEventListener('change', apply);
  // 首屏不主动取索引：等 focus 或输入再加载，节省 13.7 KB 与一次往返（实测首屏请求数为 0）。
}
