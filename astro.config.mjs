import { defineConfig } from 'astro/config';

// site 用于 canonical、sitemap 与绝对 URL；必须与线上主机名一致（含 www）。
export default defineConfig({
  site: 'https://www.token-xxo.cn',
  output: 'static',
  build: { assets: 'assets' }
});
