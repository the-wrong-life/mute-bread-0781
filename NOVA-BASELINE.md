PROJECT NOVA 生产与源码基线
采集时间: 2026-11-08T13:21:18.6954486+08:00
仓库: https://github.com/the-wrong-life/mute-bread-0781
基线提交: 3c9faeca80fa8ef6255bfca681510dd8cd3be9be
线上: https://www.token-xxo.cn/ 返回 200；HTTP 明文未重定向（待 ESA 规则修复）
线上标题: ESA Pages - Deploy Faster Than Ever
回滚: git switch main; git reset --hard 3c9faeca80fa8ef6255bfca681510dd8cd3be9be（仅本地恢复，发布前需确认）
