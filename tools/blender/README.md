# 玉衡（NOVA CORE）三维资产管线

本项目首页中央的青玉球体「玉衡」由 **Three.js 实时模型** 与 **Blender 离线渲染图** 两条线共同产出。
两条线共用一套 GLB 几何：`/lab` 页面可实时旋转查看，首页使用离线渲染的高质量静态图。

## 为什么是两条线

| 用途 | 技术 | 原因 |
| --- | --- | --- |
| 首页主视觉 | Blender Cycles 渲染的 WebP（透明背景） | 次表面散射、体积吸收、金属反射在离线渲染中才成立；首页首屏也不应加载 500 KB 的 three.js |
| `/lab` 开发预览 | Three.js 实时渲染 | 可旋转、缩放、导出 GLB，用于持续迭代几何 |

实测结论：同一 GLB，Three.js `MeshPhysicalMaterial` 的 transmission 在深色背景上只会得到「白玻璃」或「暗玻璃」，
无法表达玉的厚度沉积；Blender 侧改用 `Volume Absorption` + `Subsurface` 后才出现真实玉感。
因此首页改用离线图，实时模型保留在 `/lab`。

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

- **玉必须靠体积吸收**：`Volume Absorption` 取 Color=(0.16,0.52,0.36)、Density=1.75，
  厚度差才产生深青沉积；只调 Base Color 永远得到「奶绿塑料」。
- **透明背景是给暖白纸底用的**：首屏背景必须是暖白（#f7f2e7 系）。先在深墨绿首屏上试过，球体发灰绿、像塑料。
- **蛇必须贴球面**：路径用球面参数化（半径 1.086，纬度按 `cos(a)*0.125` 起伏）；平面圆环无论怎么调都像呼啦圈。
- **刻度齿不要做成几何**：60 个 BoxGeometry 齿在 1100px 渲染里退化成白点圈，严重廉价化；刻度改由铜环带自身的 Wave 纹理表达。
- **材质必须命名**：`mat-jade-shell` / `mat-serpent` 等 14 个名字是 GLB → Blender 的唯一锚点，
  Blender 脚本按名字覆写；不命名则导入后全部变成 `Material_N`。
- **自定义 ShaderMaterial 无法导出 GLB**：导出前必须临时替换成同名 `MeshPhysicalMaterial` 代理，
  否则 Blender 侧报 MISSING、玉球变白球。

## 状态

- 已实测：GLB 导出（2.42 MB，材质名保留）、Blender 渲染（1400×1400 / 128 samples）、WebP 打包（51 KB）、首页四视口无溢出。
- 未完成：蛇头几何仍偏简单（金色椭球 + 吻部），未达到参考图的蛇首细节；玉牌刻字为程序化 Canvas 文字，非雕刻。