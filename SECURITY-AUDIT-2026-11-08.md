# PROJECT NOVA 依赖安全审计

采集时间：2026-11-08（本地开发分支）

## 结果

`npm audit --package-lock-only --ignore-scripts --json` 返回退出码 1，共 68 项：低危 5、中危 33、高危 29、严重 1；依赖总数 553（生产 474、开发 6、可选 74）。该结果来自 npm 锁文件审计，不等同于线上运行时漏洞证明。

## 直接依赖风险

- `astro`：审计树包含多个传递依赖问题；当前项目使用 Astro 4，需单独评估升级兼容性，不能直接强制升级到最新版。
- `autoprefixer`：标记为高危，当前锁树显示无可用自动修复。
- `postcss`：标记为高危，当前锁树显示无可用自动修复；涉及构建期 CSS 处理与 source map 路径，不应未经测试直接升级。
- `tailwindcss`：标记为高危，当前锁树显示无可用自动修复，需与 Astro/Tailwind 集成版本一起验证。

## 重要传递依赖

审计列出 `vite`、`rollup`、`sharp`、`devalue`、`fast-uri`、`source-map-js`、`zod` 等问题；部分可修复，部分当前无自动修复。多数属于构建工具、开发服务器、解析器或图片处理链，不能仅依据数量判断生产可利用性。

## 严重告警定位

唯一严重级别直接依赖为 `astro`，报告中的关键条目是 `Astro: Remote code execution through AVIF image optimization`（影响范围 `<7.2.8`）。当前配置 `astro.config.mjs` 明确使用 `output: static`，未配置图像优化集成、服务端适配器或 AVIF 处理入口；这降低了该特定路径在当前站点的适用性，但不能替代升级和供应链复核。该结论仅基于当前源码配置与 npm 审计报告，不能推断 ESA 构建环境绝对不受影响。

## 发布决策

当前不执行自动 `npm audit fix`，不升级依赖，不删除任一锁文件。原因：项目同时存在 `package-lock.json` 与 `pnpm-lock.yaml`，且二者版本漂移；自动修复可能改变 Astro 4 构建行为。发布前必须先选定一个包管理器、统一唯一锁文件，在隔离工作树完成干净安装、构建、审计和回归测试。

## 安全边界

本项目当前为 Astro 静态站点，未发现运行时服务端 API；但正式结论仍需结合 ESA Pages 构建环境和实际部署链路复核。当前生产站点未修改。