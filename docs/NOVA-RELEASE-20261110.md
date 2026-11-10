# 内容与工具批次发布记录（2026-11-10）

本文件记录 PROJECT NOVA 内容批次从构建、验证到线上部署的实际结果。所有数字均来自本机实测，未由用户复核。

## 一、批次构成

| 项目 | 值 |
|---|---|
| 发布分支 | `release/content-20261110` |
| 发布提交 | `3ced6da` |
| 基线（合并前生产） | `87b722c` |
| 回滚标签 | `rollback-before-content-20261110` → `87b722c` |
| 合并方式 | 快进（`merge-base --is-ancestor` 返回 0），无合并提交 |
| 线上宿主 | 阿里云 ESA Pages，生产分支 main 自动构建 |

### 包含内容

- 工程知识库 4 篇正文：`/docs/unit-conversion`、`/docs/reusable-archives`、`/docs/calculation-record`、`/docs/static-site-deployment`
- 项目中心 4 篇详情：`/projects/project-nova`、`/projects/yuheng-core`、`/projects/engineering-toolbox`、`/projects/engineering-notes`
- 工程工具箱 3 项：单位换算、JSON 校验与格式化、文本整理（去重/排序/修剪）
- 壳层统一（`NovaShell`）、AI 页、关于页、札记页

### 明确排除

- `/lab`、`/lab-material` 开发预览页
- 玉衡三维模型新结构与渲染候选（视觉门禁未通过，只留在 `nova/v1-foundation` 开发分支）
- 首页视觉：`src/pages/index.astro` 与 `src/components/NovaCore.astro` 与生产逐字节一致（`git diff origin/main` 为 0 行），线上首页未发生变化

## 二、发布前验证（本机）

- `node node_modules/astro/bin/astro.mjs check`：**0 errors / 0 warnings**（26 文件）
- `node node_modules/astro/bin/astro.mjs build`：**15 页**
- 路由审计 `nova-audit-release.mjs`：15 路由 × 4 视口（1440/768/390/320）= **60 组**，全部 200、`innerWidth == scrollWidth`、h1 存在、pageerror 0、requestfailed 0，`ISSUES []`
- 点击回归 `nova-click-release2.mjs`（注意：生产版首页主按钮类是 `.enter`，开发版才是 `.button.primary`）：
  - 首页主入口 → `/projects`，落地 h1「把想法，变成可验证的工作。」
  - 领域入口 `["/projects","/projects","/ai","/tools"]`
  - 快捷入口 `["/projects","/docs","/tools"]`
  - 项目详情 4 条，返回链接可用
  - 文档 4 篇，正文 h1 正常
  - 工具页输入框 `["unit-value","text-trim","text-sort"]`，页面含 `#json-input` 文本域
  - 运行时错误 0
- 依赖与安全：`git diff origin/main -- package.json pnpm-lock.yaml astro.config.mjs esa.jsonc` 为空（零新增依赖、配置未变）；`src` 下无 apiKey/secret/password/Bearer 命中

## 三、线上验证（部署后实测）

- `origin/main` = `3ced6da`（推送成功）
- `https://www.token-xxo.cn/tools` 的 `Last-Modified` 由 `Sun, 08 Nov 2026 14:51:24 GMT` 变为 `Tue, 10 Nov 2026 14:05:12 GMT`，页面已含「JSON 校验与格式化」
- 正式域名 15 路由 × 2 视口（1440×900 / 390×844）：全部 200、无横向溢出、h1 存在、pageerror 0、requestfailed 0
- 「首页 → 工程工具 → 返回首页」在同一新版内完成：工具页 h1「让细节有据可循。」、JSON 工具存在、返回后首页领域入口正常
- 证据截图：`_work/nova-after-evidence/online-{tools,docs,projects,doc-detail}-{1440x900,390x844}.png`

## 四、回滚方式

```
git checkout main
git reset --hard rollback-before-content-20261110   # = 87b722c
git push --force-with-lease origin main
```

ESA 会在推送后重新构建。上一稳定版本的提交、标签、以及 `release/production-before-nova-20261108` 分支均保留。

## 五、未做的事（避免误读）

- 未做 Lighthouse 实测，因此不引用任何性能分数。
- 未做 Safari 实测（本机无 Safari），跨引擎与辅助技术仍待验证。
- 未添加安全响应头（CSP/HSTS），此项仍在待办。
- 玉衡主视觉未更新，线上仍是上一版 WebP。
