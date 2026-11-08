PROJECT NOVA 生产与源码基线
采集时间: 2026-11-08T13:21:18.6954486+08:00
仓库: https://github.com/the-wrong-life/mute-bread-0781
基线提交: 3c9faeca80fa8ef6255bfca681510dd8cd3be9be
线上: https://www.token-xxo.cn/ 返回 200；HTTP 明文未重定向（待 ESA 规则修复）
线上标题: ESA Pages - Deploy Faster Than Ever
回滚（无破坏）：git switch main；git worktree add ../project-nova-rollback 3c9faeca80fa8ef6255bfca681510dd8cd3be9be；先在隔离工作树构建与预览验证，确认后按 ESA/GitHub 发布流程恢复。禁止对当前工作树执行 git reset --hard。
