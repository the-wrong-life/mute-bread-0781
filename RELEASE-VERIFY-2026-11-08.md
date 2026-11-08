# PROJECT NOVA 发布验证补充记录

## 2026-11-08 21:53 最新状态（下方记录均为历史）

- 开发分支 nova/v1-foundation 已提交并推送 8b245539195ead890ee91d458910abdb79731945；main和生产未修改。
- 首页两行标题、透明青玉铜金SVG装置、四领域和三快捷入口已返工；仍为插画近似，写实三维目标未完成。
- 独立审查发现桌面details隐藏导航、嵌套main、手机CTA不足44px；现已修复。Chrome无头实测1440/768/390/360/320：无水平溢出，pageErrors=[]，每页一个main，桌面六项导航可见，手机菜单开闭正常、CTA高44px、footer gap为4px。
- 五视口截图位于隔离候选 .tmp/v13/。随后提升图注/快捷入口/小屏辅助文字字号；该最后字号调整已构建验证，尚待重新截图。不能将先前截图当作最终提交完整截图证据。
- 最后构建于21:51：Node v24.16.0/npm11.13.0，Astro check20文件0错误/警告/提示，静态7页构建退出0。仅候选安装了Astro7最小依赖；正式树仍需依赖治理，不能声称开发分支可独立复现候选环境。
- 构建曾误在正式树执行，报 astro is not recognized；切换隔离候选目录后成功。npm.ps1受执行策略限制，使用npm.cmd，不修改系统执行策略。
- 本轮临时预览任务pwsh-e835eff3150a4302已停止并收取结果。
- 发布仍NO-GO：ESA关联/预览及Node环境、唯一锁治理、Firefox/WebKit、屏幕阅读器、Lighthouse、安全头、发布票据未完成。下一步继续最终字号截图及依赖治理，不得合并main或发布。
- 视觉提交回退可用git revert 8b245539195ead890ee91d458910abdb79731945；生产稳定基线仍3c9faeca80fa8ef6255bfca681510dd8cd3be9be。

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

**整体 NO-GO。** 本机候选证据不能替代 ESA 非生产预览、ESA 构建环境核验、双锁治理、Firefox/WebKit、屏幕阅读器、Lighthouse、生产安全头处理和外部发布票据。正式开发分支 `nova/v1-foundation` 已推送新中式视觉提交 `e52ab935fcf9d157a28131ada01e3df1a4c23456`；`origin/main` 仍为 `3c9faeca80fa8ef6255bfca681510dd8cd3be9be`，生产站点未修改。

## V1.3 视觉实测补充

- 将首页主标题改为“格物 / 致知 / 造物有成”，英文仅作辅助标语；玉衡核心 SVG保留青玉、铜环、刻度、衔尾蛇形线、榫卯方连接、“辛巳”牌与星点。
- 同步后的隔离候选构建：Astro check 20文件、0 errors/warnings/hints，静态生成7路由，退出码0；产物核对包含中文主标题与辛巳牌，旧英文主标题已消失。
- Edge 内部浏览器标签在 `http://127.0.0.1:4330/?nova=jade-20261108-b` 重新加载后无障碍树显示新标题、四入口与核心图像替代文本；1600×1042 浏览器截图 SHA256：`b1d0ab6a15b46b745b67a748c9e05d1d664d34e7bd09a799dd3a7d61d3d93016`。
- 尝试 Playwright 1.60 headless 多视口回归未通过环境启动：先报临时目录 `EPERM`，改用候选 `.tmp` 后发现本机缺少 `chromium_headless_shell-1223`。未下载浏览器、未扩大权限；360/390/768/1280/1440/1920 自动矩阵与控制台零错误仍待验证。

## 回滚与安全边界

正式基线仍为 main 提交 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；如获外部批准，回滚应使用独立 worktree 恢复基线，不在当前工作树执行 git reset --hard。未申请新付费服务、未扩大系统权限、未接触凭据。

## 2026-11-08 后续候选核验

- 开发分支远程最新为 `fec9b537d44d9d64a9ac8b0c2e3db94d5aa45b7d`；`origin/main` 仍为 `3c9faeca80fa8ef6255bfca681510dd8cd3be9be`，正式工作树仅保留未跟踪 `_work/` 审核资料。
- 4330 候选预览七路由均返回 HTTP 200；首页 UTF-8 响应包含“格物”和“辛巳”，不含旧主标题，包含 `data-nova-core`。
- 该核验确认本机候选服务响应，不代表 ESA 预览或生产发布。ESA 预览、跨浏览器、辅助技术、Lighthouse、安全响应头和外部票据仍是 NO-GO 阻断。

## 2026-11-08 系统 Edge 无头截图补充

- 使用本机已安装 Microsoft Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`），未下载 Playwright 浏览器、未提权。
- 候选 Astro 7.4.7 预览 `http://127.0.0.1:4330/` 已启动并返回就绪。
- 1600×1042 截图：`.tmp/edge-viewport/desktop.png`，SHA-256 `49b4c6530789affab4feb6f1647c79ec7827cd67b3de5eed1e67b64320824a21`，文件219055字节。
- 390×844 截图：`.tmp/edge-viewport/mobile.png`，SHA-256 `755df8dc7220971a34273bad119c11e24cf4b7bf1491fc8b66541f67a8e97f0d`，文件114759字节。
- 截图显示桌面三列新中式布局；手机首屏品牌、主文案、进入实验室入口和玉衡核心连续可见。该证据仅覆盖系统 Edge 截图，不替代Firefox/WebKit、屏幕阅读器、Lighthouse或ESA验证。
