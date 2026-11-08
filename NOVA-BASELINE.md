PROJECT NOVA 生产与源码基线
采集时间: 2026-11-08T13:21:18.6954486+08:00
仓库: https://github.com/the-wrong-life/mute-bread-0781
基线提交: 3c9faeca80fa8ef6255bfca681510dd8cd3be9be
线上: https://www.token-xxo.cn/ 返回 200；HTTP 明文未重定向（待 ESA 规则修复）
线上标题: ESA Pages - Deploy Faster Than Ever
回滚（无破坏）：git switch main；git worktree add ../project-nova-rollback 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；先在隔离工作树构建与预览验证，确认后按 ESA/GitHub 发布流程恢复。禁止对当前工作树执行 git reset --hard。

本轮构建与依赖审计（2026-11-08）：
- 开发分支 nova/v1-foundation 最新提交 0f58ece8352db521824be3b9339d2590cb145130，工作树干净，已推送远程。
- pnpm run build 已实测通过：Astro check 20 files，0 errors、0 warnings、0 hints，静态生成 7 页。
- npm ci --ignore-scripts --dry-run --audit=false 已实测退出 0；未运行生产 npm 构建，因此 npm 构建可复现性仍待验证。
- pnpm-lock.yaml 与 package-lock.json 存在依赖版本漂移：TypeScript 5.9.3/5.9.2、Tailwind 3.4.19/3.4.17、autoprefixer 10.6.2/10.4.21、postcss 8.5.32/8.5.6。发布前必须统一包管理器和唯一锁文件。
- package-lock.json 含多个 registry.npmmirror.com 下载源；发布前需确认镜像来源可信，避免在未审查情况下切换生产安装源。
- npm audit --package-lock-only --ignore-scripts 报告 68 项（5 低、33 中、29 高、1 严重）；目前未判定均可利用，需按公告、依赖路径和构建/运行边界逐项复核。
- 本轮未修改生产站点，未合并 main，未部署；以上审计项是发布阻断条件。