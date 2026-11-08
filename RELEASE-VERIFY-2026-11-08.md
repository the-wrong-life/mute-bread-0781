# PROJECT NOVA 发布验证补充记录

## 22:13 七路由移动端浏览器抽查（隔离候选）

- 在全新副本 C:/Users/33126/Documents/DIY/_work/nova-clean-20261108-2203 的 Astro 7.4.7 预览（127.0.0.1:4340）运行系统 Chrome headless，视口390×844。
- `/`、`/projects`、`/docs`、`/tools`、`/ai`、`/blog`、`/about` 全部 HTTP 200；每页 1 个 main；document scrollWidth=390；pageerror=[]；requestfailed=[]；页面标题和 h1 均存在；内部链接均为站内绝对路径。
- 这是 Chromium 移动视口抽查，不等同于 Firefox/WebKit、屏幕阅读器或 Lighthouse 验收；预览任务已停止。

## 22:10 生产只读健康抽查

- 通过 Invoke-WebRequest -UseBasicParsing 对 https://www.token-xxo.cn/ 发出 HTTPS HEAD：HTTP 200，Server ESA。远程 main 仍为 3c9faeca80fa8ef6255bfca681510dd8cd3be9be。
- 本次 HEAD 响应未观察到 Strict-Transport-Security、Content-Security-Policy、X-Content-Type-Options、Referrer-Policy；不推断其他响应或全站策略。未改生产配置。
- 工具失败记录：网页抓取服务 /fetch 返回 HTTP 404；普通 Invoke-WebRequest 在非交互环境失败，增加基础解析参数后成功。不修改任何插件端点或凭证。

## 22:07 依赖迁移已提交开发分支（发布仍 NO-GO）

- 五个依赖迁移文件已独立提交并推送：5559ce5e4ca815a54258bf27bbf6ba24786f0eca，分支 nova/v1-foundation；未包含 _work/、缓存或本记录。
- 本地 main 仍为 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；未执行合并或生产部署。依赖迁移回退方式：在开发分支 git revert 5559ce5e4ca815a54258bf27bbf6ba24786f0eca。
- 当前唯一 npm 锁已纳入版本控制；旧工作树安装残留问题未修复。后续验证继续使用已核验的干净副本，或新建干净检出。

## 22:03 当前源码干净副本验证（独立审核有条件通过）

- 全新目录：C:/Users/33126/Documents/DIY/_work/nova-clean-20261108-2203，从正式工作树当前跟踪且存在的文件复制，不复用旧 node_modules。
- Node v24.16.0、npm 11.13.0；npm ci --ignore-scripts 安装268包成功；npm ls --depth=0 成功；npm audit --package-lock-only --ignore-scripts 0漏洞；npm run build退出0，check20文件零诊断，静态7页。
- package.json、package-lock.json、astro.config.mjs、首页、壳层、核心SVG及生命周期脚本均与正式树逐文件SHA256一致。该结果验证当前源码在干净副本可构建，不声称旧依赖目录已修复。
- 独立只读审查结论：可作为开发分支候选提交，不构成上线批准。锁文件含 registry.npmjs.org 321项与 registry.npmmirror.com 21项，均有 integrity；发布前需确认并验证 CI registry 策略。anymatch → picomatch 2.3.2 override 的公告及兼容性依据待补充。旧 global.css 无活动页面入口，保留待后续单独清理。
- ESA Node/预览、跨引擎、辅助技术、Lighthouse、安全头与发布票据仍未完成。生产/main不动。

## 22:01 依赖迁移工作树状态（历史失败记录）

已将隔离候选 package.json、package-lock.json、astro.config.mjs 同步至正式开发树；删除旧 pnpm-lock.yaml 和 tailwind.config.mjs，形成唯一 npm 锁候选。锁版本3，根dependencies与package.json一致，Astro7.4.7要求Node>=22.23.4/npm>=9.6.5。正式树 npm ci --ignore-scripts 失败：EPERM unlink node_modules/.pnpm/acorn@8.19.0/node_modules/acorn/CHANGELOG.md。安装未完成，后续依赖树/审计命令未执行，不能声称正式树通过。未修改权限或提权。五个依赖配置变更保留未提交，下轮应在新隔离目录用当前正式源码和唯一锁干净安装验证，成功并独立审查后才提交；生产/main不动。


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

## 2026-11-08 21:57 最终字号复验

- 候选预览：`http://127.0.0.1:4334/`，Astro 7.4.7；测试脚本 C:/Users/33126/Documents/DIY/_work/nova-v13-audit.mjs。
- 系统 Chrome 无头实测 1440、768、390、360、320；五种视口均 scrollWidth 等于视口宽，pageErrors=[]。
- 1440/768：每页一个 `main`，桌面六项导航可见，CTA 高度 50px。
- 390/360/320：每页一个 `main`，移动菜单开闭均成功，CTA 高度 44px，footer gap 4px，四领域和三快捷入口存在。
- 最终截图 SHA256：390=`088ea4efee7df21137c35ffaf2b8191a34b97aba146cb707dabd757045c4bf2f`；320=`6b0474e51a0a2ca97a9488a00f54e5ed1fac0900cd7b9f673c706b617c75d1c6`。截图位于候选 `.tmp/v13/`。
- 复验结束后已停止临时预览；该证据仍仅覆盖本机 Chrome，不替代 ESA、Firefox/WebKit、屏幕阅读器或 Lighthouse。

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
