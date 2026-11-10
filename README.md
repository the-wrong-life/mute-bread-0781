# DIY Engineering Lab（PROJECT NOVA）

https://www.token-xxo.cn 的源码仓库。Astro 静态站，阿里云 ESA Pages 托管，生产分支 `main`。

## 站点结构

- `src/pages/` 页面；`src/data/` 项目与文档数据（纯 TS，无 CMS）
- `src/layouts/NovaShell.astro` 全站壳层（导航、移动菜单、跳过链接、页脚）
- `src/components/NovaCore.astro` 玉衡静态 SVG 底图（无 JS 也可见）
- `src/scripts/jade/` 玉衡三维模型：`build-jade.ts`（程序化几何）、`viewer.ts`（渲染与导出）、`jade-material.ts`（玉质着色器）、`procedural-textures.ts`（贴图）
- `src/scripts/tools/` 工程计算器的纯函数与 UI 绑定
- `tools/blender/` 玉衡离线渲染管线（GLB 导出、Blender 渲染脚本、WebP 打包）

## 常用命令

```bash
pnpm install
node node_modules/astro/bin/astro.mjs dev      # 开发
node node_modules/astro/bin/astro.mjs check    # 类型检查
node node_modules/astro/bin/astro.mjs build    # 产出 dist/
```

**注意**：本仓库的 `node_modules` 没有 `.bin` 目录，`pnpm exec astro` 会报 `Command "astro" not found`。必须用上面的 `node node_modules/astro/bin/astro.mjs` 形式。

## 路由清单

以下由 `dist/` 实际产物枚举（`Get-ChildItem dist -Recurse -Filter index.html`），不是手工维护的列表。

开发分支 `nova/v1-foundation`（17 条）：

```
/                                       /projects
/about                                  /projects/engineering-notes
/ai                                     /projects/engineering-toolbox
/blog                                   /projects/project-nova
/docs                                   /projects/yuheng-core
/docs/calculation-record                 /tools
/docs/reusable-archives                  /lab            （开发预览，不发布）
/docs/static-site-deployment             /lab-material   （开发预览，不发布）
/docs/unit-conversion
```

生产分支（15 条，不含 `/lab`、`/lab-material`）：同上减去最后两条。

## 玉衡三维模型：结论的适用范围

`docs/NOVA-YUHENG-20261110.md` 里的材质与渲染结论**只对当轮的渲染条件成立**（Blender 4.5.10 + Cycles CPU + 110 samples + AgX Medium High Contrast + 固定相机与灯光）。换渲染器、换引擎、换灯光都需要重新验证。

要特别避免的两个误读：

1. **不是引擎能力缺失。** Three.js 的 `MeshPhysicalMaterial` 本身就提供 `thickness`、`attenuationColor`、`attenuationDistance`、`transmission`、`ior`、`clearcoat` 等参数（见 [官方文档](https://github.com/mrdoob/three.js/blob/dev/docs/pages/MeshPhysicalMaterial.html.md)）。本项目实时侧的观感问题，正确表述是「**本轮实时方案未达到目标效果**」，不能写成引擎不支持。
2. **深色背景下 Transmission 表达不了玉**，这是在本轮背景色（#1d3a2f 系）与曝光（1.36）下得出的观察，换成暖白背景需要重测。

### 复现离线渲染

```powershell
# 1. 导出 GLB：需要本地预览服务在 127.0.0.1:4340
node _work/nova-export-glb.mjs

# 2. Blender 渲染：两个环境变量必填，否则报 "Please select a file"
$env:NOVA_GLB="<绝对路径>/yuheng-jade-core.glb"
$env:NOVA_OUT="<输出目录>"
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python tools/blender/render-yuheng.py
```

可选开关：`NOVA_GRAY=1` 灰模、`NOVA_ONLY=<子串>` 只留匹配网格、`NOVA_HIDE=<子串>` 隐藏、`NOVA_HEADS=1` 头部四机位、`NOVA_SAMPLE=1` 鳞片样段特写、`NOVA_TRANS/SSS/DENS/ROUGH/COAT/KERNEL` 材质参数、`NOVA_TAG` 输出前缀。

导出注意：`jade-material.ts` 是自定义 `ShaderMaterial`，写不进 glTF 材质。`viewer.ts` 在导出前会把球壳临时换成名为 `mat-jade-shell` 的 `MeshPhysicalMaterial` 代理，`finally` 再换回；否则 Blender 侧拿到白球。

## 测试

- 全路由审计：`node _work/nova-audit-all.mjs`（开发分支，17 路由 × 4 视口）
- 生产批次审计：`node _work/nova-audit-release.mjs`（15 路由 × 4 视口）
- 点击与导航回归：`node _work/nova-click-regress.mjs`

这些脚本需要 Playwright（`C:/Users/33126/Documents/DIY/node_modules/playwright`）与 `TEMP/TMP` 指向可写目录。截图与脚本落在 `_work/`，不进版本库。

## 发布

`main` 是生产分支，推送后 ESA Pages 自动构建。回滚见 `docs/NOVA-RELEASE-20261110.md`。

## 许可证与素材

玉衡三维模型、渲染图、着色器均为本项目原创，随本仓库发布。未引入第三方模型、贴图或字体文件。
