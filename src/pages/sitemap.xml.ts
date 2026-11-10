import type { APIRoute } from 'astro';
import { docs } from '../data/docs';
import { projects } from '../data/projects';

// 站点地图在构建期生成：路由清单来自与页面完全相同的数据源，
// 因此新增文档或项目后不需要再手工维护 sitemap。
const origin = 'https://www.token-xxo.cn';

const staticRoutes = [
  { path: '/' },
  { path: '/projects/' },
  { path: '/docs/' },
  { path: '/tools/' },
  { path: '/ai/' },
  { path: '/blog/' },
  { path: '/about/' },
  { path: '/marine/' },
  { path: '/mechanical/' }
];

interface Entry { path: string; lastmod?: string }

export const GET: APIRoute = () => {
  const entries: Entry[] = [...staticRoutes];
  for (const doc of docs) entries.push({ path: `/docs/${doc.slug}/`, lastmod: doc.updated });
  for (const project of projects) entries.push({ path: `/projects/${project.slug}/`, lastmod: project.updated });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${origin}${entry.path}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
        '  </url>'
      ].filter(Boolean).join('\n')
    ),
    '</urlset>',
    ''
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
