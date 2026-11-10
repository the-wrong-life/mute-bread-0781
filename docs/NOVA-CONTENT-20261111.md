# PROJECT NOVA 内容批次发布记录（2026-11-11）

记录对象：内容与知识库的两次独立发布。两次都只改文档数据与项目事实，不含首页主视觉、不含三维代码，可单独回滚。

## 批次 2：UPS 备用时间文章

- 分支：release/content2-20261111
- 生产提交：dd1c6fb（父提交 c6737f1）
- 回滚标签：rollback-before-content2-20261111 → c6737f1
- 发布标签：published-content2-20261111 → dd1c6fb
- 改动：src/data/docs.ts 新增 /docs/ups-runtime
- 发布前验证：astro check 0 errors（18 hints）、build 15 页、18 路由 × 4 视口（1440/768/390/320）= 72 组全部 200 且无横向溢出、无 pageerror/requestfailed
- 线上验证：/docs/ups-runtime 由 404 变 200；1440 与 390 均无横向溢出；正文相关链接 /tools#ups 存在且工具页确有 id="ups" 锚点

## 批次 3：性能现场读数文章 + 玉衡事实更新

- 分支：release/content3-20261111
- 生产提交：dd51df4（父提交 dd1c6fb）
- 回滚标签：rollback-before-content3-20261111 → dd1c6fb
- 发布标签：published-content3-20261111 → dd51df4
- 改动：src/data/docs.ts 新增 /docs/perf-field-readings；src/data/projects.ts 更新玉衡条目事实（甲片实验与未达标结论）
- 发布前验证：astro check 0 errors（18 hints）、build 19 页、19 路由 × 4 视口 = 76 组 ISSUES []
- 线上验证：/docs/perf-field-readings 由 404 变 200（约 40 秒后生效）；1440 下 h1 正确、正文 14 段、相关链接两条；390 下 innerWidth==scrollWidth==390、pageerror 0

## 回滚方法（任一批次）

```powershell
git checkout main
git reset --hard rollback-before-content3-20261111   # 回到批次 2 之后
git push --force-with-lease origin main
```

ESA Pages 会按新提交重新构建；回滚后必须重新核对 /docs 列表与文章详情，不能只看首页。

## 未做与待验证

- 未跑 Lighthouse 分数（只做了 PerformanceObserver 原始读数，见 /docs/perf-field-readings）
- 未在 Safari / Firefox 复测
- 未配置 CSP/HSTS
- 首页主视觉仍是 87b722c 的图形版玉衡；开发分支的 Blender 渲染版未发布，原因见 docs/NOVA-YUHENG-20261110.md 十三章

## 复现命令

```powershell
node node_modules/astro/bin/astro.mjs check
node node_modules/astro/bin/astro.mjs build
node tools/ops/check-links.mjs
```
