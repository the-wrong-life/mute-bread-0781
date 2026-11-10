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
## 六、离线管线修复：从"奶白胶球"到可辨青玉（2026-11-11 凌晨）

本轮把动画渲染脚本 `tools/blender/render-loop.py` 与已知可用的单帧脚本 `render-yuheng.py` 逐段对照，找到四处真实缺陷。**这四处都不是"参数没调好"，而是管线里少了一段代码**，所以在之前几轮里怎么调数值都不收敛。

### 6.1 球壳缺体积吸收（最主要）

`render-loop.py` 把 `mat-jade-shell` 交给 `rep()` 统一按 Principled 设置，但 `render-yuheng.py` 额外挂了一个 `ShaderNodeVolumeAbsorption`（Color 0.16/0.52/0.36，Density 1.7）到 Material Output 的 Volume 口。

- 缺这一层的后果：玉的深浅不再由光程决定，球壳渲成奶白胶质，内部结构全被冲淡。
- 修法：新增 `shell_volume()`，Density 由 `NOVA_DENS` 控制，默认 1.6。
- 注意：只把 Principled 的 Transmission 调高不会产生同等效果，二者不是替代关系。

### 6.2 内核缺独立暖白材质

GLB 里的 `mat-kernel` 是纯白高亮，直接渲出来是一块硬边白盘。`render-yuheng.py` 是按对象名 `default-kernel` 换成一个新材质（Base 1.0/0.95/0.82，Emission 1.0/0.90/0.70）。

- 修法：新增 `kernel_warm()`，Emission Strength 由 `NOVA_KERNEL` 控制，本轮定稿 14。
- 教训：材质覆写要按**对象**做，不能只按**材质名**做——同名材质可能被多个对象共用。

### 6.3 "球里有团云"不是玉絮，是灯盘映进高光

连续三版渲染里球面都有几块大而柔的白斑，我一度当成噪声色阶太粗糙，把 `Scale` 从 3.4 调到 7.5、把色阶两端从 0.10/0.44 收到 0.16/0.30，白斑几乎没变。

真正的原因是灯：四盏 AREA 灯原是 `size` 12/10/9/10，在约 10 单位距离上张角接近 60°，它们的像被球壳的高光整块映了出来。

- 修法：灯盘缩到 5.0/4.5/4.0/3.5（`NOVA_LIGHT_SCALE` 可整体缩放），球壳 Roughness 0.10 → 0.16、Coat 0.55 → 0.30。
- 结果：白斑收成一个柔和亮点。
- 教训：**光滑球面上的成片柔光斑，先怀疑灯的形状和尺寸，再怀疑材质噪声**。判断方法：改灯尺寸后斑块位置跟着动，就是灯。

### 6.4 蛇头材质名不匹配

`build-jade.ts` 里蛇头材质名是 `mat-serpent-head`，而渲染脚本一直在覆写旧名 `mat-serpent-upper-jaw`（`serpent-upper-jaw` 是**网格**名，不是材质名）。结果头部保持 GLB 自带的铜色，与绿色蛇身断开。

- 修法：覆写 `mat-serpent-head`、`mat-serpent-brow-l/r`，Base 0.52/0.36/0.14、Metallic 0.82。

### 6.5 甲片配色的两次翻转

砖格 `Color1/Color2/Mortar` 的配比直接决定蛇身读成什么：

| 配色 | 观感 |
|---|---|
| 青玉为底 + 深青缝（Scale 6.5） | 整条蛇读成一根绿管，看不出甲片 |
| 金铜为底 + 青玉缝（Scale 9） | 读成"金管子"，青玉片消失 |
| **青玉为底 + 金铜细缝（Scale 13 / Mortar 0.006）** | 甲片可辨，且与金色铜环带区分开 |
| 金铜为底 + 金铜缝 | 与铜环同色，两个环粘成一个 |

### 6.6 本轮定稿参数（render-loop.py 默认值）

| 项 | 值 | 说明 |
|---|---|---|
| 球壳 Base | 0.09 / 0.34 / 0.24 | 深青玉肉 |
| Transmission | 0.42 | 比 0.36 通透，但不到玻璃 |
| SSS Weight / Scale | 0.50 / 0.14 | 玉的散射 |
| Volume Absorption Density | 1.6 | 决定深浅 |
| 灯盘 size | 5.0 / 4.5 / 4.0 / 3.5 | DISK |
| 内核 Emission Strength | 14 | 暖白 |
| 甲片 | Scale 13 / Mortar 0.006 | 青玉底 + 金缝 |
| 玉絮噪声 | Scale 7.5 / Detail 6 / 色阶 0.16→0.30 | 细絮 |

### 6.7 仍未解决

- 球壳整体仍偏"玻璃球"，玉肉的密度感不如参考图；下一步应调噪声色阶的空间尺度而不是再加吸收。
- 蛇头在首页尺寸下仍是一个光滑铜色梭形，看不出下颌。
- 玉牌在右侧像"贴在环上的牌"，没有镶进结构的连接件。
- 甲片只在颜色层面成立，没有真实叠压的几何起伏。
### 6.8 玉絮要放进体积，不是画在表面

把噪声接在 Base Color 的色阶上，渲出来永远是"球面一层云斑"，因为球壳是高透材质，表面色阶被透射和反射冲淡。

改法：噪声（3D，Scale 3.2，Detail 8）→ 色阶（0.45→1.7 灰阶）→ 乘上密度 → 接 `Volume Absorption` 的 Density 口，由 `NOVA_VOL_SCALE` 控制。

结果：球内出现随厚度变化的不均匀深浅，读起来像玉肉里的棉絮；这是本轮观感提升最明显的一步。

### 6.9 接触阴影

玉衡原本在暖白页面上没有落影，读成"浮在空气里的图标"。新增 `ground_shadow()`：40 单位平面 + `is_shadow_catcher=True`，配合 `film_transparent` 把阴影写进 alpha，页面背景仍由 CSS 决定（`NOVA_GROUND=0` 可关，`NOVA_GROUND_Z` 调高度，默认 −1.58）。

### 6.10 本轮定稿（v10）

| 项 | 值 |
|---|---|
| 球壳 Base | 0.06 / 0.26 / 0.19 |
| Roughness / Coat | 0.22 / 0.20 |
| Transmission / IOR | 0.42 / 1.55 |
| SSS Weight / Scale | 0.50 / 0.14 |
| Volume Absorption | Color 0.16/0.52/0.36，Density 2.1，由 3D 噪声调制 |
| 主灯 | DISK size 3.5–5.0，900 W |
| 内核 | 暖白，Emission Strength 14 |
| 甲片 | 青玉底 + 金缝，Scale 13 / Mortar 0.006 |
| 地面阴影 | shadow catcher，z = −1.58 |

对比上一版（`yuheng-core.webp` 95 720 B 之前那一版）：球体不再是一块奶白胶质，能看到体积内的浓淡变化，底部有了接触阴影。

### 6.11 甲片 UV 的遗留问题（结论写在前面，避免再走一遍）

蛇身管的 UV 是 `u = t × 20`、`v = (j / radial) × 3`，两者物理尺度差约 6 倍。砖格节点对 u、v 用同一个 Scale，所以甲片在管身上被拉成 6:1 的长条——
Scale 小的时候看不出来（读成整条管），Scale 大的时候变成金点。**要真正得到方形甲片，必须先把 UV 改成等物理尺度，或给 V 方向单独加 Mapping 节点缩放**，只调 brick Scale 不可能收敛。本条本轮未做。

## 七、循环动画素材与网络门控（2026-11-11 00:45）

- 编码：20 帧 / 400 ms / 480² / quality 70 = 541112 B（`public/yuheng/yuheng-loop.webp`）；24 帧会到 638–656 KiB，带接触阴影后渐变压缩差，减帧比降质更划算。
- 网络门控：`saveData` 或 `effectiveType` 为 2g/3g 时不自动播放动画，保留静态 1040² WebP（117186 B）与"播放动作"按钮。实测 Chrome 桌面与移动模拟均正常切换。
- 静态主视觉裁切按"实体 alpha>40"取框，避免地面阴影把画面撑大导致玉衡在页面上变小。

## 八、玉牌、贴图 UV 与接触阴影（2026-11-11 01:00）

- 玉牌位置改为坠在蛇环右下方外侧：`tabletAngle = -0.30π`、`tabletR = 1.16`（环半径 1.14），长轴顺半径向外，另加 `tablet-link`（`TorusGeometry(0.034,0.011)`，材质 `mat-copper-ring`）把牌顶与蛇环连起来。旧位置 (1.16,−0.88,0.54) 孤立在画面右侧，读成"浮着的绿卡片"。
- **ExtrudeGeometry 的默认 UV 是模型单位而不是 0..1**，直接贴 256×384 的辛巳贴图只会采到左下角一小块，渲成十字纹。修法：按法线重铺 UV——`|nz| >= 0.5` 的正反面用 `x/(2*tw)+0.5, y/(2*th)+0.5`，侧壁用 `atan2(nx,ny)/π*0.5+0.5` 与 `z/0.05+0.5`。修后"辛巳"两字与金框可辨。
- 接触阴影两条路线对比：Blender `is_shadow_catcher` 平面会把整块平面写进 alpha，裁切后页面出现**带直边的灰色方块**；改为渲染不接地影（`NOVA_GROUND=0`）+ 页面 CSS `.yuheng-frame::after` 椭圆径向渐变落影，边缘干净、素材也更小（循环 541 KiB → 431 KiB）。
