# NOVA 玉衡动态候选 · 2026-11-09

## 范围与状态
- 用户要求按新中式参考重做首页与核心，并让球体动起来。本轮仅开发分支 nova/v1-foundation，不合并 main、不部署 ESA、不新增依赖或付费服务。
- 开发起点 16865a93b5227a8643b50521e8202304521c068c；本轮读取远程 main=87b722c006197b1e9c95b82947c39eb83cf78460。本地 origin/main 旧缓存为3c9faeca80fa8ef6255bfca681510dd8cd3be9be，不可声称远端未变。
- 参考图特征：1585×992，暖白；左侧两行中文大标题、英文斜体、短文案和朱砂CTA；中间大青玉球与带鳞片的衔尾蛇、中央光珠/竖轴/轴承、铜金斜测量环与仪表；右侧四领域；淡墨山和底部快捷链接。禁止把整张图作背景。
- 当前核心图是SVG工业仪器与WebGL玉球混合渲染，不是完整写实3D模型。实际截图仍显示较明显矢量插画感、球体桌面480px而参考约560px、垂直留白较多；不宣称达到参考图质感。图片相似度/美术门禁未通过。

## 实现
- 原生WebGL球面法线、漫反射/镜面/菲涅耳与流动玉纹；SVG工业装置、鳞片蛇身、金环和文字可编辑。
- 8秒轻微悬浮、10秒星轨摆动，不整球快速旋转；按钮可暂停/继续，减少动态偏好关闭动态；DPR上限1.25，绘制30fps上限，低帧降15fps（真实低性能硬件未测）。
- WebGL不可用/编译失败静态SVG降级且不空转；隐藏/离屏暂停，context loss恢复，pagehide释放资源。往返缓存同DOM保留暂停选择。
- 桌面布局左介绍与CTA、中核心、右领域；平板两列与横排领域。手机先前CSS Grid隐式轨道造成quick-links插入hero底部视觉区域，虽DOM顺序存在但内容像重叠；本轮改hero为单列flex内容流。手机介绍/核心/领域均设全宽。
- 本轮修改代码仅 src/pages/index.astro；现场复核源码看到原先移动断点已有grid-template-rows:auto但截图仍观察到排版异常，最终切flex内容流避免Grid区域/隐式行问题。桌面min-height由734px改700px；实际hero仍872px，因为自然内容高度比最小高度大，故没有显著压缩桌面。

## 真实验证
- Windows本机Chrome156无头真实浏览器，视口1920×1080、1585×992、1440×900、768×1024、390×844、360×800、320×568。所有innerWidth==scrollWidth，pageerror=0。
- 最新量测（CSS视口）：桌面hero y89–961，核心480×504、quick y961；1440 hero837px；768 hero685px、domains y645–732；390核心290×305 x50居中，CTA y707–755，领域全宽y779–1003，quick y1023；360核心276×290、CTA y675–723；320核心256×269、CTA y654–702、领域y726–950、quick y970。390及320完整流程自然排列、未重叠，但页面很长且quick-links不在首屏。头部菜单链接实际导航可用性沿用之前测试，本轮尚未重做打开/关闭回归。
- 之前测试：Edge157视口1440、768、390、320无溢出/pageerror0，其他六路由HTTP200。Chrome核心动画变化、暂停后CSS动画currentTime冻结且drawArrays计数58→58；继续后running。reduce、离屏、context loss恢复、CTA到/projects以及WebGL失败静态降级曾验证。模拟pagehide/pageshow不等于真实BFCache/真实后台切换。
- 本轮Astro check 18文件0错误/警告/hints；静态build 7页成功；构建后截图/几何复测成功。git diff --check成功（仅看到CRLF转换提示）。

## 证据与重跑
- 上轮工作区 _work/nova-motion-evidence 下原有geometry.json、animation.json、lifecycle.json、edge.json、各宽截图与真实帧GIF；本轮截图 final-fix-{1920,1585,1440,768,390,360,320}.png 同目录。390最新截图仍待最终视觉读取确认。
- 记录与素材为工作区本地，不进入生产。Playwright来自 C:/Users/33126/Documents/DIY/node_modules/playwright；Astro CLI来自 C:/Users/33126/Documents/DIY/_work/project-nova-astro7-minimal/node_modules/.bin/astro.cmd。预览服务 http://127.0.0.1:4338/ 通过Python3.14 PID11532提供dist，为本机临时预览，不是持续服务。
- 回退本轮开发修改：针对index.astro进行git revert；不reset或覆盖main，不以旧origin/main强推远端。

## 未通过门禁
- 参考图相似度、球体写实材质、桌面高度/构图未达标；不是生产候选放行。
- Safari/Firefox/WebKit/屏幕阅读器、Lighthouse与真实用户INP、GPU性能/泄漏长期测试、真实BFCache和后台切换待验证。
- ESA运行版本、部署预览、安全头与外部发布审批缺口未闭合，生产NO-GO。
- 仓库当前分支 nova/v1-foundation；本轮index.astro变更已创建并构建/浏览器验证，但未提交推送。工作树另有已有NovaCore.astro修改及未跟踪 _work/，Lead未回滚或改动其他工作域。
