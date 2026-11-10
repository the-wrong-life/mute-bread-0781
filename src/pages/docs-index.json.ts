import { docs } from '../data/docs';

// 构建期生成静态搜索索引：标题、摘要、类型、章节标题、正文、列表、表格与代码都会进入 text 字段，
// 前端首屏不加载本文件，只在用户开始输入时按需 fetch 一次（约 20–40 KB）。
export const GET = () => {
  const index = docs.map((doc) => {
    const body = doc.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.list ?? []),
      ...(section.table ? [...section.table.headers, ...section.table.rows.flat()] : []),
      section.code ?? ''
    ]);
    return {
      slug: doc.slug,
      title: doc.title,
      kind: doc.kind,
      updated: doc.updated,
      summary: doc.summary,
      text: [doc.title, doc.kind, doc.summary, ...body].join(' ').toLowerCase()
    };
  });
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
};
