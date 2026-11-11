# NOVA 发布记录 · 工具箱与领域页批次（2026-11-11）

## 一、批次内容
| 类别 | 变更 |
|---|---|
| 工具 | `/tools` 新增「直流线路压降」（式 U=k·I·L·ρ/A，可切换单/两线制与铜/退火铜/铝/自定义 ρ）与「UPS 备用时间」（式 t=容量×电压×DoD×效率÷负载） |
| 工具脚本 | `src/scripts/tools/logic.ts` 增加 `upsRuntime()`；新增 `src/scripts/tools/ups.ts`、`src/scripts/tools/dc-drop.ts` |
| 页面 | 新增 `/marine`（船舶电气）、`/mechanical`（机械设计）两个领域页 |
| 项目中心 | `/projects` 增加领域筛选（`?domain=` 可分享）、修复 `.card[hidden]` 未生效、新增「按工程领域查看」入口 |
| 数据 | `src/data/projects.ts` 工程量具箱条目更新到 2026-11-11 的实测结果 |
| 构建配置 | `tsconfig.json` 由 `astro/tsconfigs/strict` 修正为 `astro/tsconfigs/strict.json`（旧写法解析失败，导致 24 个误报类型错误） |

明确**不含**：首页与玉衡主视觉（`src/pages/index.astro`、`src/components/YuhengArt.astro`、`public/yuheng/*`）、`src/scripts/jade/*`、`/lab` 与 `/lab-material` 开发预览页。

## 二、发布前验证（本机 Chrome，预览 http://127.0.0.1:4341/）
- `astro check`：27 文件 **0 errors / 0 warnings / 18 hints**
- `astro build`：**17 页**
- `tools/ops/test-tools.mjs`：**PASS 28 项断言**（换算 7、压降 6、UPS 8、JSON/文本 7）
- 路由审计 `nova-audit-release2.mjs`：**17 路由 × 4 视口 = 68 组，TOTAL 68 / ISSUES []**
- 点击回归 `nova-click-release3.mjs`：首页主按钮 `/projects`（220×50）；工具页 UPS 示例 → 「11.52 小时（691.2 分钟）」；压降示例 → 「0.7 V · 2.92%」；项目筛选 4 → 1 且 URL 带 `?domain=`；领域入口 → `/marine/`、`/mechanical/`；文档详情返回 `/docs/`；pageerror 0。

## 三、发布
- 生产提交：**c6737f1**（父提交 3ced6da）
- 回滚标签：`rollback-before-tools-20261111` → `3ced6da`（已推送远端）
- 推送方式：`git push origin HEAD:main` 快进（`merge-base --is-ancestor 3ced6da HEAD` = 0）
- ESA 重建确认：`/tools/` 的 `Last-Modified` 由 `Tue, 10 Nov 2026 14:05:12 GMT` 变为 `Tue, 10 Nov 2026 18:52:19 GMT`（UTC）= 本地 2026-11-11 02:52，页面正文已含「UPS 备用时间」。

## 四、线上验证（https://www.token-xxo.cn）
- 17 路由 × 2 视口（1440×900、390×844）：全部 200、`innerWidth==scrollWidth`、h1 存在、pageerror 0、requestfailed 0、无 BAD 行。
- 交互：线上 `/tools` UPS 示例输出「11.52 小时（691.2 分钟）」、压降示例「0.7 V · 2.92%」；线上 `/projects` 领域入口 → `/marine/`（h1「船舶电气」）；「首页 → 工具 → 返回首页」始终同一版本。
- 截图：`_work/nova-after-evidence/online-ups-1440x900.png`、`online-ups-390x844.png`、`online-marine-1440x900.png`、`online-projects-domain-390x844.png`。

## 五、回滚步骤
```
git checkout main
git reset --hard rollback-before-tools-20261111
git push --force-with-lease origin main
```
ESA 会在下一次构建时回退到 3ced6da 的内容；回滚后按同一脚本复验「首页 → 工具 → 返回首页」。

## 六、依赖与安全
- `package.json` 相对 3ced6da **无新增依赖**（`git diff 3ced6da -- package.json` 为空）；发布分支未包含 three（three 只在开发分支用于 /lab）。
- `src` 下无 api key / secret / password / Bearer 命中；工具全部在浏览器端计算，不上传输入。

## 七、仍未完成
- Safari / Firefox 跨引擎与读屏器实测。
- Lighthouse 性能、可访问性、SEO 实测（需在真实网络下跑，本轮未做）。
- 玉衡主视觉（首页）仍沿用上一版静态与循环素材，视觉候选留在开发预览。

## 八、线上复核补记（2026-11-11 02:58 本地时间）
- `/projects` 领域入口在线上实测：链接 `/marine/`、`/mechanical/`，点击后 h1「船舶电气」，无 pageerror，无横向滚动。
- 手机 390 视口线上截图：UPS 表单字段与结果卡片完整可读、按钮与输入框未溢出；项目页「按工程领域查看」双列入口在首屏下方连续排布。
