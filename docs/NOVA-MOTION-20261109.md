# NOVA 玉衡动态候选 · 2026-11-09

## 范围与状态
- 用户要求按新中式参考完善首页，让球体动起来。本轮仅开发分支 nova/v1-foundation，不合并 main、不部署 ESA、不新增依赖或付费服务。
- 开发起点 16865a93b5227a8643b50521e8202304521c068c；本轮实际读取远程 main=87b722c006197b1e9c95b82947c39eb83cf78460。本地 origin/main 旧缓存为3c9faeca80fa8ef6255bfca681510dd8cd3be9be，不可再声称远端未变。
- 参考特征：暖白、格物致知/造物有成、青玉球、铜金斜星轨、衔尾蛇、辛巳牌与远山。图像读取接口本轮不支持，未做逐像素或主观视觉验收。

## 实现
- 原生 WebGL 球面法线、漫反射/镜面/菲涅耳与流动玉纹；SVG工业装置和文字保持可编辑。此为混合渲染候选，不是完整写实3D模型。
- 8秒轻微悬浮、10秒星轨摆动，不整球快速旋转；按钮可暂停/继续，减少动态偏好关闭动态；DPR上限1.25，绘制30fps上限，低帧降15fps（实际低性能硬件未测）。
- WebGL不可用/编译失败使用静态SVG且不空转；隐藏/离屏暂停，context loss恢复，pagehide释放资源。往返缓存同DOM保留暂停选择。
- 修复桌面CTA右栏/领域落第二行、平板标题掉到下方；桌面左介绍与CTA、中核心、右领域，手机单列。加低对比远山SVG。

## 真实验证
- Windows本机无头Chrome：1920、1440、1100、768、390、360、320宽。innerWidth等于scrollWidth，1个main，pageerror均0。
- Edge：1440、768、390、320宽均无横向溢出、pageerror 0；其余6条路由均HTTP200。
- 390×844：核心画布290px宽，x=50居中；CTA bottom约740px、触控高度48px，首屏完整；320核心256px宽。蛇环可见宽按SVG几何估算约239px（390视口），不是视觉实测。
- Chrome：运行画面像素变化；暂停后CSS动画currentTime冻结，drawArrays计数58→58，最终截图像素一致；继续后running。
- reduce→reduced；离屏→offscreen；WEBGL_lose_context真实丢失后恢复running/webgl；CTA点击实际到/projects/。
- 故障注入null context与shader compile failure均static/svg、无data-active、CSS paused、按钮disabled；无JS时SVG可见、无效按钮隐藏。
- 合成pagehide/pageshow persisted后保留暂停；document.hidden覆盖加事件验证隐藏暂停及恢复。两项属于模拟生命周期，不等同真实导航进入BFCache或真实切后台。
- Astro check 18文件0错误/警告/hints，静态7页build成功，git diff --check通过。
- 独立只读审查task-14发现fallback空转、按钮语义与缓存暂停偏好，Lead已修并复测；静态有条件通过，非视觉放行。

## 证据与重跑
- 工作区_work/nova-motion-evidence下保存geometry.json、animation.json、lifecycle.json、edge.json、各宽截图与真实帧GIF。工作区根_work/nova-motion-audit-20261109.mjs、nova-animation-test-20261109.mjs、nova-lifecycle-test-20261109.mjs、nova-edge-test-20261109.mjs为验收脚本，不进入生产。
- 使用现有项目依赖与系统Chrome/Edge，无新安装。运行脚本前将TEMP/TMP设为可写工作区_work；系统Temp曾出现EPERM。首次locator.screenshot因悬浮不稳定超时，改固定clip采帧，不作为网页失败。
- 初次暂停截图偶有GPU合成像素差异，进一步用CSS currentTime与drawArrays计数验证，最终复测稳定；不以单张截图推断动画状态。

## 未通过门禁
- 参考图相似度、写实材质美术验收；Safari/Firefox/WebKit/屏幕阅读器、Lighthouse与真实用户INP、GPU性能/泄漏长期测试、真实BFCache与后台切换均待验证。
- ESA运行版本、部署预览、安全头与外部发布审批缺口未闭合，生产NO-GO。
- 预览仅127.0.0.1:4337，当前会话管理后台任务；不是常驻服务或系统定时任务，不保证跨重启继续运行。
- 回退本轮开发修改：对本轮提交git revert；不reset或覆盖main，不以旧origin/main强推远端。

## 团队
- 两个独立写域实现任务+一个依赖后只读审查任务，均收到结果；无API批处理。工具未提供精确并发峰值和Token统计，不宣称提速或费用数据。
