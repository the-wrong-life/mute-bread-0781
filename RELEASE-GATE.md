# PROJECT NOVA 发布门禁记录

更新时间：2026-11-08
站点：`www.token-xxo.cn`
开发分支：`nova/v1-foundation`

## 当前结论

**NO-GO：不得合并 `main`，不得向 ESA Pages 发布。**

本记录只描述已取得的本地、隔离环境和线上单点证据；不代表 ESA 预览或生产部署已经完成。

## 已通过或部分通过

- 开发分支远程提交：`c906ae603696106fead104b043e60feb10f8da89`。
- 生产基线 main：`3c9faeca80fa8ef6255bfca681510dd8cd3be9be`。
- 隔离 npm 构建：`astro check` 20 文件、0 errors/warnings/hints；静态生成 7 页。
- Astro 5 隔离候选：`astro@5.18.2`，check 21 文件无错误，静态生成 7 页。
- Edge/Playwright 已取得的本地矩阵：360、390、768、1280、1440、1920；目标 7 路由 HTTP 200；已记录的运行中 console/pageerror 为空；768 首页横向溢出已修复。
- 工具页已实测单位换算、绝对零度拒绝和动态 `aria-invalid`。
- 生产单点 HTTPS 观察为 HTTP 200、Server ESA；生产仍为旧模板。

## 阻断项

1. 原正式锁树审计为 68 项（低5、中33、高29、严重1），直接 Astro 仍命中 AVIF 优化 RCE 公告；Astro 5 候选审计仍为 17 项且保留严重项。Astro 7.4.7 + Tailwind 4.1.17 的隔离候选已将审计降为5项（低0、中3、高2、严重0），并通过 21 文件检查及7页静态构建；但其中 Rollup 4.0.0–4.58.0 与 Vite <=6.4.3 高危传递依赖尚未完成干净锁文件重建、补丁版本确认、预览回归和ESA构建复现。因此依赖治理和发布证据仍未闭环，不能直接发布。
2. `package-lock.json` 与 `pnpm-lock.yaml` 并存且解析版本漂移；尚未选定唯一包管理器、删除/保留锁文件并完成干净重建和复核。
3. ESA GitHub 关联、非生产预览和真实发布回执尚未取得；控制台停在登录页，未输入凭据。
4. Firefox/WebKit 未安装或未验证；屏幕阅读器与 Lighthouse 实测证据缺失。
5. 生产未观察到 HSTS、CSP、X-Content-Type-Options、Referrer-Policy；安全头需要在 ESA 能力和预览环境中验证后再处理。
6. 外部生产变更票据未取得；不得通过模型或脚本伪造票据。

## 解锁顺序

1. 由站点负责人在蓝色边框浏览器完成 ESA 登录，并确认项目 `mute-bread-0781` 的 GitHub 关联、构建命令和预览目标。
2. 在发布候选分支选择唯一锁文件和安装器，使用隔离工作树执行干净安装、构建、审计；对每个严重/高危公告记录受影响路径、是否进入构建链、修复版本和残余风险。
3. 取得非生产预览 URL 后，执行目标路由、响应式、键盘、辅助技术、控制台、性能与安全头验收。
4. 只有依赖严重项有明确处置、预览回归通过、外部票据有效且回滚点可复现时，才允许合并 main 和发布 ESA。
5. 发布后重新检查 HTTPS、内容、导航、动画、移动端、控制台与提交哈希；失败时按 `NOVA-BASELINE.md` 的 worktree 回滚流程恢复，禁止在当前工作树执行 `git reset --hard`。

## 证据边界

- 本记录不声称已部署、已通过 Lighthouse、已完成 Firefox/WebKit 或屏幕阅读器测试。
- 生产站点未修改，`main` 未合并。
- 不执行自动 `npm audit fix`、不使用 `--force`/`--legacy-peer-deps`，不新增付费服务，不扩大系统权限。
