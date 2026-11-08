# PROJECT NOVA 发布验证补充记录

更新时间：2026-11-08（本机隔离候选复核）

## 本轮范围

对隔离候选 _work/project-nova-astro7-minimal 重新执行依赖树检查、审计、Astro 静态检查和生产构建。候选与正式仓库、main、生产站点保持隔离。

## 实测证据

- Node：v24.17.0；npm：11.13.0。
- npm ls --depth=0 --omit=optional 成功，直接依赖树无缺失。
- npm audit --package-lock-only --ignore-scripts：stderr 单独采集，退出码 0；漏洞总数 0（low/moderate/high/critical 均为 0）。
- npm exec -- astro check：20 个文件，0 errors、0 warnings、0 hints。
- npm run build：静态输出 7 个页面，退出码 0；路由为 /、/about/、/ai/、/blog/、/docs/、/projects/、/tools/。
- 候选 dist 的有限私密模式扫描未命中；这不是完整秘密审计。
- 本机 Edge 预览曾验证首页 1600×1042 和七路由 HTTP 200；截图 SHA256：91db3e0db6e87e3884430fd0145a8bd794f323a8478b3cab0d94f0dd763d9fef。
- 生产单点 HEAD：HTTPS 200、Server ESA；本次未观察 HSTS、CSP、X-Content-Type-Options、Referrer-Policy。该结果不是候选发布证据。

## 失败案例与边界

- 直接调用不存在的 node_modules/astro/astro.js 曾报 MODULE_NOT_FOUND；随后改用项目 npm 入口执行，Astro check/build 均通过。
- PowerShell 直接管道接收 npm stderr 的 side-effects-cache 警告曾将命令判为失败；将 stderr 单独重定向后，audit/build 退出码均为 0。
- 候选仍为 detached 工作树，包含修改后的 package 文件和本地缓存，未提交、未复制回正式仓库。

## 发布门禁结论

**整体 NO-GO。** 本机候选证据不能替代 ESA 非生产预览、ESA 构建环境核验、双锁治理、Firefox/WebKit、屏幕阅读器、Lighthouse、生产安全头处理和外部发布票据。正式分支、main、生产站点本轮均未修改。

## 回滚与安全边界

正式基线仍为 main 提交 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；如获外部批准，回滚应使用独立 worktree 恢复基线，不在当前工作树执行 git reset --hard。未申请新付费服务、未扩大系统权限、未接触凭据。
