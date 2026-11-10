# 玉衡（NOVA CORE）三维资产管线

本项目首页中央的青玉球体「玉衡」由 **Three.js 实时模型** 与 **Blender 离线渲染图** 两条线共同产出。
两条线共用一套 GLB 几何：`/lab` 页面可实时旋转查看，首页使用离线渲染的高质量静态图。

## 为什么是两条线

| 用途 | 技术 | 原因 |
| --- | --- | --- |
| 首页主视觉 | Blender Cycles 渲染的 WebP（透明背景） | 次表面散射、体积吸收、金属反射在离线渲染中才成立；首页首屏也不应加载 500 KB 的 three.js |
| `/lab` 开发预览 | Three.js 实时渲染 | 可旋转、缩放、导出 GLB，用于持续迭代几何 |

**本轮实验结果（限定条件，不作为渲染器的普遍结论）**：在使用本仓库当前参数（transmission 0.86 / thickness 0.4 /
attenuationDistance 4.5 / 深色或中等亮度背景）时，Three.js `MeshPhysicalMaterial` 的输出偏向「白玻璃」或「暗玻璃」两端，
未达到目标玉质；同一 GLB 在 Blender 侧加上 `Volume Absorption` + `Subsurface` 后接近目标。
需要说明的是，Three.js 的 `MeshPhysicalMaterial` 本身提供 `thickness`、`attenuationColor`、`attenuationDistance`
等体积近似参数，理论上也能表达厚度沉积——是**本轮参数与布光组合未调出目标效果**，不是引擎能力缺失。
后续若要让实时版本承担主视觉，应先在该组参数上重做对照实验。

## 目录

| 路径 | 说明 |
| --- | --- |
| `src/scripts/jade/build-jade.ts` | 程序化建模：球壳、衔尾蛇、玉轴、铜环、玉牌、底座 |
| `src/scripts/jade/jade-material.ts` | 球壳的自定义 ShaderMaterial（Fresnel + 内部光核 + 环境反射） |
| `src/scripts/jade/procedural-textures.ts` | 鳞片 color/bump 贴图、玉牌文字 |
| `src/scripts/jade/viewer.ts` | Three 场景、布光、OrbitControls、GLB 导出、性能降级 |
| `tools/blender/export-glb.mjs` | 用 Playwright 打开 `/lab`，调用 `window.__jadeViewer.exportGLB()` 落盘 |
| `tools/blender/render-yuheng.py` | Blender 端重写材质、布光、相机、渲染 |
| `tools/blender/pack-webp.py` | 裁透明白边并压成 WebP |
| `public/yuheng/yuheng-core.webp` | 首页主视觉（1040×1040，透明，约 51 KB） |

## 复现步骤

1. 构建：`node node_modules/astro/bin/astro.mjs build`
2. 导出 GLB（需 Playwright + Chrome）：`node tools/blender/export-glb.mjs`
3. Blender 渲染（约 60–90 秒）：设置环境变量 `NOVA_GLB`、`NOVA_OUT` 后运行
   `blender.exe -b --python tools/blender/render-yuheng.py`
4. 裁边与打包：`python tools/blender/pack-webp.py`（需 Pillow）

## 关键参数与教训

- **体积吸收是本轮玉感的主要来源**：`Volume Absorption` 取 Color=(0.16,0.52,0.36)、Density=1.75 时，
  厚度差产生深青沉积。仅调整 Base Color（不接体积/次表面）在本轮实验中没有得到玉感。
- **透明背景是给暖白纸底用的**：本轮首屏为暖白（#f7f2e7 系），在深墨绿首屏上试过，同一张图发灰绿、像塑料。
  这是**背景色与透射材质耦合**的现象，不代表深色底一律不可用。
- **蛇必须贴球面**：路径用球面参数化（半径 1.086，纬度按 `cos(a)*0.125` 起伏）；平面圆环无论怎么调都像呼啦圈。
- **刻度齿不要做成几何**：60 个 BoxGeometry 齿在 1100px 渲染里退化成白点圈，严重廉价化；刻度改由铜环带自身的 Wave 纹理表达。
- **材质必须命名**：`mat-jade-shell` / `mat-serpent` 等 14 个名字是 GLB → Blender 的唯一锚点，
  Blender 脚本按名字覆写；不命名则导入后全部变成 `Material_N`。
- **自定义 ShaderMaterial 无法导出 GLB**：导出前必须临时替换成同名 `MeshPhysicalMaterial` 代理，
  否则 Blender 侧报 MISSING、玉球变白球。

## 复现参数（渲染侧）

| 项 | 值 |
| --- | --- |
| 相机 | 位置 (0, -10, 0.35)，焦距 92 mm，朝向 (0, 0, 0.05) |
| 采样 | 1400×1400，Cycles CPU，128 samples，denoise 开 |
| 色彩 | AgX，Look = Medium High Contrast |
| 背景 | 渐变世界（0.62/0.60/0.54 → 0.96/0.94/0.88），强度 1.15；`film_transparent=True` |
| 灯光 | key (5.2,-7.0,6.4) 1500W size 7；rim (-6.8,2.2,3.6) 900W size 6；back (0.2,5.2,2.0) 700W size 5；fill (-3.4,-7.6,0.8) 320W size 6 |
| 球壳 | Transmission 0.86 / IOR 1.55 / Coat 0.55 / Subsurface 0.22；Volume Absorption (0.16,0.52,0.36) Density 1.75 |
| 蛇身 | 半径 0.098，砖格程序化（scale 15），金铜双色 + 亮金细缝 |

诊断脚本（`_work/nova-render-v19.py`，未入库）先 `read_factory_settings(use_empty=True)` 清空出厂场景，
打印导入后对象清单，再按「关内核 / 全开 / 单灯各一张 / 只内核」输出 700² 64 samples 对照图，用于定位高光来源。

## 状态

- 已实测：GLB 导出（2.42 MB，材质名保留）、Blender 渲染（1400×1400 / 128 samples）、WebP 打包（51 KB）、首页四视口无溢出。
- 未完成：蛇头几何仍偏简单（金色椭球 + 吻部），未达到参考图的蛇首细节；玉牌刻字为程序化 Canvas 文字，非雕刻。