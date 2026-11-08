PROJECT NOVA 生产与源码基线
采集时间: 2026-11-08T13:21:18.6954486+08:00
仓库: https://github.com/the-wrong-life/mute-bread-0781
基线提交: 3c9faeca80fa8ef6255bfca681510dd8cd3be9be
线上: https://www.token-xxo.cn/ 返回 200；HTTP 明文未重定向（待 ESA 规则修复）
线上标题: ESA Pages - Deploy Faster Than Ever
回滚准备（不切换当前分支）：确认目标目录不存在后，执行 git worktree add --detach ../project-nova-rollback 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；在隔离工作树构建并预览。生产恢复须先核对 ESA 当前关联及独立审批，再通过已验证发布流程执行；基线提交尚未证实对应线上版本。禁止对当前工作树执行 git reset --hard。

本轮构建与依赖审计（2026-11-08）：
- 当时开发分支 nova/v1-foundation 提交 0f58ece8352db521824be3b9339d2590cb145130，工作树干净，已推送远程；当前版本以 git log 和远程分支为准。2026-11-08 17:47 本地核对：工作树干净，远程 nova/v1-foundation=`57034ecad955e7770289b626af512d3cf7eb08fe`，远程 main=`3c9faeca80fa8ef6255bfca681510dd8cd3be9be`；两锁文件仍同时存在。
- pnpm run build 已实测通过：Astro check 20 files，0 errors、0 warnings、0 hints，静态生成 7 页。
- 当时 npm ci --ignore-scripts --dry-run --audit=false 已实测退出 0；此后完成下述隔离 npm 构建，但 ESA 生产环境可复现性仍待验证。
- 隔离安全升级探针（未改开发分支）：npm registry 元数据确认 `astro@7.2.8` engines 为 Node >=22.12.0、npm >=9.6.5；`@astrojs/check@0.9.12` 支持 TypeScript ^5/^6；当前 `@astrojs/tailwind@6.0.2` peer 仅支持 Astro ^3/^4/^5。尝试在独立 `_work/project-nova-upgrade-check` 以 exact 版本解析 Astro 7.2.8 + 集成时，npm 正确拒绝并报 `ERESOLVE`：`@astrojs/tailwind@6.0.2` 与 Astro 7 peer 不兼容。未使用 force/legacy-peer-deps，未改开发分支；需另行评估 Astro 7 的官方 Tailwind 集成替代方案或选择受支持的较低升级目标。
- pnpm-lock.yaml 与 package-lock.json 存在依赖版本漂移：TypeScript 5.9.3/5.9.2、Tailwind 3.4.19/3.4.17、autoprefixer 10.6.2/10.4.21、postcss 8.5.32/8.5.6。发布前必须统一包管理器和唯一锁文件。
- package-lock.json 含多个 registry.npmmirror.com 下载源；发布前需确认镜像来源可信，避免在未审查情况下切换生产安装源。
- npm audit --package-lock-only --ignore-scripts 报告 68 项（5 低、33 中、29 高、1 严重）；目前未判定均可利用，需按公告、依赖路径和构建/运行边界逐项复核。
- 本轮未修改生产站点，未合并 main，未部署；以上审计项是发布阻断条件。

隔离 npm 构建复核（2026-11-08）：
- 独立工作树 project-nova-npm-check 基于提交 f50ac1635aa2784fd036468293e456264da21915，使用本机 Node 及 npm 11.13.0，以工作树内缓存执行 npm ci --ignore-scripts --no-audit --no-fund，安装 490 个包。
- 首次 npm run build 的 Astro check 为 20 文件、0 errors、0 warnings、0 hints，但构建因系统临时目录 node-jiti 写入 EPERM 失败。将 TEMP、TMP 和 TMPDIR 指向独立工作树内临时目录后，npm run build 通过并生成 7 页。此结果不等于 ESA 生产构建验证；安装未运行生命周期脚本。
- 原开发工作树曾因工作目录误用执行 npm ci，遇到 node_modules unlink EPERM；后续 pnpm 依赖恢复亦遇到 Rollup 文件 EPERM，原工作树目前不能重新构建。源码提交保持不变；不得将仍在运行的旧预览服务视为依赖已恢复。
- 独立工作树内的 .npm-cache 和 .tmp 为本机验证临时产物，不应提交。依赖安全审计、锁文件统一、移动端与发布门禁仍未完成。

单位换算修复复核（2026-11-08）：
- 开发分支提交 4a6fa724e2fb98a393127d461f6e95acea8de01c 已推送。工具补充绝对温标与温差区别、有符号数、精度说明，关联输入提示，无效单位清除旧结果。后续增加 aria-invalid 输入状态；2026-11-08 在隔离工作树 Astro check 20 文件零错误、零警告、零提示并生成 7 页，屏幕阅读器与新改动的浏览器验证待完成。
- 隔离工作树基于 f50ac16，仅同步该工具页面的源码改动，执行 Astro check：20 文件、零错误警告和提示；Astro build 静态生成 7 页通过。依赖安装仍是 --ignore-scripts，不代表 ESA 生产构建。
- Edge 对隔离预览工具页抽测：25.4 mm = 2.54 cm；切换温度后 −300 °C 被拒绝。浏览器真实移动视口、控制台、键盘及屏幕阅读器尚待验证。
- 预览地址 http://127.0.0.1:4328/ 为本机临时进程；不是 ESA 预览部署。main 未合并，生产未改动。
- 依赖独立审查确认 package-lock.json 与 pnpm-lock.yaml 解析图存在版本漂移，Astro AVIF 公告仍需按实际构建链复核；在统一唯一锁文件、干净隔离安装、公告例外台账和 ESA 预览验证前，发布门禁保持阻断。
- 2026-11-08：导航当前项增加 aria-current="page"；隔离 npm 工作树同步后 Astro check 20 文件零错误、零警告、零提示，Astro build 生成 7 页成功。该结果不代表移动端交互、屏幕阅读器或 ESA 已验证。
- 第10轮复核：隔离 npm audit --package-lock-only 仍报告 68 项（低5、中33、高29、严重1），严重项为直接依赖 astro；静态产物 7 个路由均存在 title。审计非零退出符合漏洞发现，未执行自动修复。
- 第10轮有限敏感信息扫描：对匹配 astro、ts、js、json、md、yml、yaml、env 扩展名的可搜索文件检查私钥标记、AWS Access Key 格式及常见凭据关键词；返回命中为依赖名称和公开 URL。此扫描未覆盖全部文件类型、Git 历史或所有凭据格式，不能证明无泄漏。
- 发布攻坚复核：npm 审计直接依赖暴露 GHSA-26w7-cxv4-gfx2（Astro AVIF，CVSS 9.8，<7.2.8）、GHSA-6g55-p6wh-862q 与 GHSA-r28c-9q8g-f849（PostCSS source map 路径，均影响当前 8.5.6）；Rollup 与 Sharp 也有构建链公告。静态输出降低访客运行时可达性，但构建供应链风险仍在，依赖门禁不通过。
- 隔离 Playwright/Edge 回归：4 个视口（360、390、768、1280）×7 路由共 28 次导航均 HTTP 200、无 pageerror；仅发现 768px 首页初版横向溢出 31px，已将平板网格改为 minmax(0,1fr)，修复版本已通过 Astro check/build，待重新浏览器回归。360px 首页有 4 条 WebGL GPU stall warning（ReadPixels），需性能观察，不是功能错误；工具 25.4 mm→2.54 cm、−300°C 拒绝及 aria-invalid=true 均通过。
- 修复后最小回归（隔离 Edge 157.0.4341.42 + Playwright）：768×900 首页 HTTP 200，documentElement scrollWidth/clientWidth=768/768；360×800 首页 HTTP 200，等待1.5秒 console/pageerror 均为0；/、/about、/ai、/blog、/docs、/projects、/tools 均 HTTP 200、无重定向。该结果未覆盖 Firefox/WebKit、Lighthouse、屏幕阅读器。追加完整 Edge 回归（隔离 Edge 157.0.4341.42 + Playwright）：360、390、768、1280 四视口×7路由共28次导航全部 HTTP 200；所有页面 scrollWidth=clientWidth，console warning/error 与 pageerror 均为空。/tools/ 温度 −300°C 拒绝，aria-invalid=true，绝对零度提示显示。追加桌面回归（隔离 Edge + Playwright）：1440×900 与 1920×1080 各覆盖7路由，共14次导航全部 HTTP 200；所有页面 scrollWidth=clientWidth；有效页面 pageerror 为空。补充观察：1440 首页出现一次 Edge `GPU stall due to ReadPixels` warning，1920 未重现；该性能项仍待优化。测试中额外探测的 `/dashboard`、`/agents`、`/skills`、`/settings` 为404，不属于当前7页发布范围。Firefox/WebKit 执行文件及 Playwright缓存未确认，未下载或安装。