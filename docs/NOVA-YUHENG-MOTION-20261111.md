# 玉衡动态化与循环动画实录（2026-11-11）

本轮对应指令：m06914 / m06916 九条；执行方式为单机 Lead 串行（Agent 团队在本会话不可用），
全部数据来自本机实测，未标注"待验证"的条目均已有对应命令输出或截图。

## 一、内部层次恢复（指令第 1 条）

### 1.1 先定位是谁挡住了玉球内部

同一帧（t=0）、同一机位（web 机位，相机 (0,-10,0.35)，lens 92）、同一曝光，只改隐藏对象：

| 组 | 隐藏对象 | 结果 |
|---|---|---|
| A | 无（基准） | 只有雾状玉肉，看不到暖白内珠与玉轴 |
| B | `kernel-glow` | 与 A 几乎一致 → 加法光晕球不是遮挡源 |
| C | `jade-inner-core` | 内部出现浅色区与竖直玉轴轮廓，仍无明确内珠 |
| D | 两者都隐藏 | **暖白内珠清晰出现，玉轴可见** |

结论：`jade-inner-core`（半径 0.74 的内层球）是遮挡源。它是 WebGL 侧为了在暖白页面上
"撑住玉肉"而加的内层壳，在 Blender 里与真实内核（半径 0.16 的自发光球）叠加，直接把内核吃掉。

处理：离线渲染统一 `NOVA_HIDE="kernel-glow,jade-inner-core,serpent-scales-sample"`，
即渲染时跳过这两个 WebGL 专用的辅助件，保留真实几何（GLB 仍是同一个模型，未做分档）。

### 1.2 内核亮度

同机位、隐藏同上，只改内核自发光：

| 参数 | 结果 |
|---|---|
| `NOVA_KERNEL=7` | 内珠偏小偏暗 |
| `NOVA_KERNEL=14` | 内珠亮度与直径接近参考图，边缘仍柔（AgX 未出现硬边白斑） |
| `NOVA_AXIS_EMIT=0.5` | 竖直玉轴在球内可见，且不抢内珠主次 |

采用 `NOVA_KERNEL=14`、`NOVA_AXIS_EMIT=0.5`。

## 二、几何修正（本轮实际落盘）

| 部位 | 旧值 | 新值 | 原因 |
|---|---|---|---|
| 蛇身半径 | `0.022 + 0.086·min(u·1.7,1)^0.65` | `0.020 + 0.090·u^0.62` | 旧式在 u>0.59 之后恒为 0.108，四成身长等粗，正向看就是一根塑料管/呼啦圈 |
| 颈套筒 | `CylinderGeometry(0.086, 0.080, 0.20, 28)` | `(0.113, 0.104, 0.20, 28)` | 与新颈部半径 0.110 对齐，消除台阶 |
| 辛巳玉牌 | `BoxGeometry(0.24, 0.36, 0.03)` | `ExtrudeGeometry`：圆角矩形 0.115×0.175、圆角 0.026、depth 0.026、bevel 0.008/0.007 | 方盒在画面里读成"绿色卡片" |
| 底座托片 | `CylinderGeometry(0.13, 0.16, 0.028)` | `(0.112, 0.134, 0.024)` | 与金盘 0.082 一起缩小，减轻"螺丝"观感 |
| 铜环游标 | `(1.038, 0, 0)` | `(-0.90, -0.52, 0)` | 原位置紧贴右上蛇头，读成漂浮的小金疙瘩 |

### 2.1 玉牌颜色

GLB 里玉牌带 `createTabletTexture('辛','巳')` 贴图。Blender 侧若直接把贴图接到 Base Color，
白底会把牌子渲成一块白牌（第一版就是这样）；若丢掉贴图，字口又完全消失。
最终做法：贴图 × 青色（`Mix(MULTIPLY, factor=1, base×3.2)`），牌子是青玉，字口深色可辨。

## 三、循环动画素材

### 3.1 帧序列怎么来的

`_work/nova-export-frames.mjs` 在单个 Playwright 会话里循环：`setPaused(true)` → `poseAt(t)` → `exportGLB()`，
t = 8 秒循环的第 i/48 帧。实测 **48 帧共 6990 ms（约 146 ms/帧）**，产物 `_work/nova-loop/glb/frame-000..047.glb`。

### 3.2 离线渲染

`tools/blender/render-loop.py`（新增，仓库内）：

- 每帧：`read_factory_settings(use_empty=True)` → 导入 GLB → `NOVA_HIDE` 过滤 → 重写 14 套材质 → 相机 (0,-10,0.35) lens 92 → DISK 四灯（key 1050/12、rim 900/10、back 700/9、fill 320/10）→ 世界 (0.92,0.93,0.88)/0.55 → Cycles CPU、采样数由 `NOVA_SAMPLES` 控、`film_transparent`、AgX Medium High Contrast。
- 环境变量：`NOVA_FRAMES`、`NOVA_OUT`、`NOVA_RES`、`NOVA_SAMPLES`、`NOVA_HIDE`、`NOVA_KERNEL`、`NOVA_SSS`、`NOVA_TRANS`、`NOVA_AXIS_EMIT`、`NOVA_SHELL_BASE`。
- 实测：720² / 24 samples 约 10 s/帧，48 帧约 8 分钟（Cycles CPU）。

### 3.3 编码与体积

| 版本 | 尺寸 | 帧数/帧率 | 体积 |
|---|---|---|---|
| 560² 48 帧 6fps q76 | 560 | 48 / 6fps | 963 712 B（过大，未采用） |
| 560² 48 帧 6fps q60 | 560 | 48 / 6fps | 865 956 B |
| 480² 48 帧 6fps q66 | 480 | 48 / 6fps | 740 306 B |
| **480² 24 帧 4fps q72（采用）** | 480 | 24 / 4fps | **383 702 B** |
| 400² 24 帧 4fps q70 | 400 | 24 / 4fps | 304 736 B |

采用 480²/24 帧：8 秒循环下 4fps，动作本身是缓慢呼吸与摆转，4fps 不出现明显跳动。
首页静态主视觉同时重渲（1400² / 40 samples）并生成 1040²（92 546 B）与 520²（39 130 B）。

### 3.4 首页播放策略

- 首屏仍是静态 WebP（`fetchpriority="high"`），LCP 不被动画拖慢。
- `requestIdleCallback`（回退 1.2 s）预载 `yuheng-loop.webp`，加载完成后把 `img.src` 换成动画，同时停掉 CSS 浮动动画，避免两种运动叠加。
- 暂停按钮 44px 高、`aria-pressed` 同步、状态写入 `localStorage['yuheng-motion']`，刷新后保持。
- `prefers-reduced-motion: reduce` 时按钮不出现且不预载；`navigator.connection.saveData` 或 2G 网络同样不启用。

实测（Chrome，1440×900，预览 http://127.0.0.1:4340/）：

- 换源成功：`currentSrc=yuheng-loop.webp`，`transferSize=384 002`；静态 92 846；
- 播放中两帧像素差 mean_abs (5.21, 3.95, 4.59)、max 约 199（确实在动）；
- 点暂停 → `src=yuheng-core.webp`、文案「播放动作」、`aria-pressed=false`、`localStorage=paused`；
- 刷新后仍是静态且文案为「播放动作」（首次实现漏了这一步，按钮文案与状态不一致，已修）；
- `reducedMotion: 'reduce'` 上下文下按钮 `hidden=true`、`animationName=none`、不发起动画请求。

七视口布局（1920/1585/1440/768/390/360/320）全部 `innerWidth==scrollWidth`、`pageerror 0`；
390×844 首屏内玉衡 351×351 @ (20,236)、按钮 82×44 @ (235,601)、主按钮 350×48 @ (20,657) 均在首屏内。

## 四、工具链教训（本轮新增）

1. 祖先元素（`.core-breath`）有持续 CSS 动画时，Playwright 的 `click()` 会一直等待"元素稳定"直到超时；验证按钮行为改用 `page.evaluate(() => el.click())`，或在该用例里先停掉祖先动画。
2. PowerShell 里 `*>` 重定向日志是 UTF-16LE，Node 读取要用 `utf16le`，否则全是乱码。
3. 把 Python 代码塞进 `pwsh -c "... @'...'@"` here-string 会吞掉引号（`invalid decimal literal`）；多行脚本一律先写 `.py` 文件再执行。
4. Astro 项目里改完三维代码必须重新 `build` 再导出 GLB，否则 /lab 加载的还是旧 bundle 的模型。

## 五、仍未达标（如实）

1. 蛇头在首页尺寸下仍读成"金色小梭子 + 一圈环"，没有下颌开合、颊窝与眉脊的立体层次。
2. 玉牌虽然有了倒角与字口，但它是"挂在蛇环上的小牌"，与参考图里镶在结构上的玉牌位置不同。
3. 底座徽章缩小后仍偏"螺钉"，缺少武曲浮雕的形。
4. 铜环带在左侧的收口仍是硬边，缺倒角过渡。
5. 蛇身鳞片目前是砖格颜色/法线；几何甲片样段已能读成鳞片，但铺满全身需先做三角面预算。
