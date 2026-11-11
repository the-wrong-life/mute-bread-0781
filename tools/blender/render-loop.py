# -*- coding: utf-8 -*-
"""
玉衡循环动画帧渲染：逐帧导入 /lab 导出的姿态 GLB，固定机位与材质，输出透明 PNG 序列。

用法：
  set NOVA_FRAMES=C:\work\nova-loop\glb
  set NOVA_OUT=C:\work\nova-loop\png
  set NOVA_RES=720
  blender -b --python tools/blender/render-loop.py
"""
import bpy, os, math, mathutils, glob

FRAMES = os.environ.get("NOVA_FRAMES", ".")
OUT = os.environ.get("NOVA_OUT", ".")
RES = int(os.environ.get("NOVA_RES", "720"))
SAMPLES = int(os.environ.get("NOVA_SAMPLES", "24"))
# 单变量诊断开关：同一帧同一机位只改一个参数，用于定位内部层次与过曝
KERNEL = float(os.environ.get("NOVA_KERNEL", "14.0"))
SSS = float(os.environ.get("NOVA_SSS", "0.50"))
TRANS = float(os.environ.get("NOVA_TRANS", "0.42"))
AXIS_EMIT = float(os.environ.get("NOVA_AXIS_EMIT", "0.0"))
SHELL_BASE = os.environ.get("NOVA_SHELL_BASE", "0.06,0.26,0.19")

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def rep(name, base, rough, metal, trans=0.0, ior=1.45, coat=0.0, emit=None, emit_str=0.0, sss=0.0, sss_rad=(0.5,0.9,0.7), sss_scale=0.3, keep_tex=False):
    m = bpy.data.materials.get(name)
    if not m: return
    m.use_nodes = True
    nt = m.node_tree
    tex_img = None
    if keep_tex:
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                tex_img = n.image; break
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value = (base[0], base[1], base[2], 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['IOR'].default_value = ior
    if 'Transmission Weight' in bs.inputs: bs.inputs['Transmission Weight'].default_value = trans
    if 'Coat Weight' in bs.inputs:
        bs.inputs['Coat Weight'].default_value = coat
        bs.inputs['Coat Roughness'].default_value = 0.04
    if emit is not None:
        bs.inputs['Emission Color'].default_value = (emit[0], emit[1], emit[2], 1)
        bs.inputs['Emission Strength'].default_value = emit_str
    if name == 'mat-jade-shell':
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = float(os.environ.get("NOVA_VEIN_SCALE", "7.5"))
        noise.inputs['Detail'].default_value = 6.0
        noise.inputs['Roughness'].default_value = 0.55
        nr = nt.nodes.new('ShaderNodeValToRGB')
        # 色阶两端别拉太开：0.10→0.44 的对比在球面上渲成一团团大云斑，
        # 参考图的玉絮是细的、贴着实心玉肉走的。
        # 玉壳底色由这段噪声色阶决定，SHELL_BASE 对 mat-jade-shell 实际不生效（诊断结论）。
        # 因此"整体发青"的根因在这里：旧值两端都是青绿，暖色调吸收/暖灯都压不过它。
        vc = os.environ.get("NOVA_VEIN_COLORS", "0.16,0.42,0.31|0.30,0.62,0.47").split("|")
        c0 = tuple(float(v) for v in vc[0].split(",")); c1 = tuple(float(v) for v in vc[1].split(","))
        nr.color_ramp.elements[0].position = 0.40
        nr.color_ramp.elements[0].color = (c0[0], c0[1], c0[2], 1)
        nr.color_ramp.elements[1].position = 0.62
        nr.color_ramp.elements[1].color = (c1[0], c1[1], c1[2], 1)
        nt.links.new(noise.outputs['Fac'], nr.inputs['Fac'])
        nt.links.new(nr.outputs['Color'], bs.inputs['Base Color'])
    if tex_img is not None:
        # 玉牌贴图自带浅色底，直接用会渲成一块白牌；用青色相乘压回玉色，字口仍深
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = tex_img; t.interpolation = 'Smart'
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = (base[0] * 3.2, base[1] * 3.2, base[2] * 3.2, 1)
        nt.links.new(t.outputs['Color'], mix.inputs[6])
        nt.links.new(mix.outputs[2], bs.inputs['Base Color'])
    if sss > 0 and 'Subsurface Weight' in bs.inputs:
        bs.inputs['Subsurface Weight'].default_value = sss
        bs.inputs['Subsurface Radius'].default_value = sss_rad
        bs.inputs['Subsurface Scale'].default_value = sss_scale
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])

def serpent_plates():
    m = bpy.data.materials.get("mat-serpent")
    if not m: return
    nt = m.node_tree
    bs = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    brick = nt.nodes.new('ShaderNodeTexBrick')
    # 甲片密度与缝宽可调：缝用金铜色才读得出"金底嵌青玉甲片"，但尺度过大就成编织袋。
    # 几何侧 UV 已改成物理尺度（约 1 个 UV 单位 = 1 片甲片），Scale 取 1.0 才不再被拉长；
    # 旧值 13.0 是给"参数尺度 UV"打的补丁，UV 修好后继续用会变成满身金点。
    brick.inputs['Scale'].default_value = float(os.environ.get("NOVA_PLATE_SCALE", "1.0"))
    brick.inputs['Mortar Size'].default_value = float(os.environ.get("NOVA_PLATE_MORTAR", "0.03"))
    brick.inputs['Mortar Smooth'].default_value = 0.2
    pc = tuple(float(v) for v in os.environ.get("NOVA_PLATE_COLORS", "0.13,0.35,0.25|0.09,0.27,0.19").split("|")[0].split(","))
    pc2 = tuple(float(v) for v in os.environ.get("NOVA_PLATE_COLORS", "0.13,0.35,0.25|0.09,0.27,0.19").split("|")[1].split(","))
    brick.inputs['Color1'].default_value = (pc[0], pc[1], pc[2], 1)
    brick.inputs['Color2'].default_value = (pc2[0], pc2[1], pc2[2], 1)
    mc = tuple(float(v) for v in os.environ.get("NOVA_PLATE_MORTAR_COLOR", "0.05,0.14,0.10").split(","))
    # 缝压暗 = 缝隙阴影；但参考图的蛇是"金铜骨架 + 青玉甲片"，缝偏亮才出金线，
    # 因此缝色做成可调，默认仍取暗缝（旧结论：缝比甲片亮到极致会读成鱼网袜）。
    brick.inputs['Mortar'].default_value = (mc[0], mc[1], mc[2], 1)
    uvc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = 0.785398
    nt.links.new(uvc.outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.012
    nt.links.new(brick.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])

def shell_volume():
    """球壳体积吸收：玉的深浅必须由光程决定，缺这一层就渲成奶白玻璃（本机实测对比）。

    教训：这一层只加在 rep() 里的 Principled 上不生效，必须单独接 Volume Absorption 到
    Material Output 的 Volume 口；Density 越大越沉（1.7 为当前定稿，0.75 会明显发透）。
    """
    m = bpy.data.materials.get("mat-jade-shell")
    if not m or not m.use_nodes: return
    nt = m.node_tree
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    vol = nt.nodes.new('ShaderNodeVolumeAbsorption')
    # 吸收色决定"透出来的玉色"：深绿 → 薄荷绿；参考图是暖白偏青，R 分量必须接近 G。
    ac = tuple(float(v) for v in os.environ.get("NOVA_ABS_COLOR", "0.16,0.52,0.36").split(","))
    vol.inputs['Color'].default_value = (ac[0], ac[1], ac[2], 1)
    dens = float(os.environ.get("NOVA_DENS", "2.1"))
    # 用三维噪声调制吸收密度：玉的"棉絮/色根"应该是体积里的，
    # 只画在表面色阶上会读成球面上一层云斑（本轮实测）。
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.noise_dimensions = '3D'
    noise.inputs['Scale'].default_value = float(os.environ.get("NOVA_VOL_SCALE", "3.2"))
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.55
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.34
    ramp.color_ramp.elements[0].color = (0.45, 0.45, 0.45, 1)
    ramp.color_ramp.elements[1].position = 0.70
    ramp.color_ramp.elements[1].color = (1.7, 1.7, 1.7, 1)
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = dens
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mul.inputs[0])
    nt.links.new(mul.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])

def kernel_warm():
    """内核单独建暖白自发光材质：GLB 里的 mat-kernel 是纯白高亮，渲出来是一块硬边白盘。"""
    o = bpy.data.objects.get("default-kernel")
    if not o or o.type != 'MESH': return
    m = bpy.data.materials.new("mat-kernel-warm"); m.use_nodes = True
    bs = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    bs.inputs['Base Color'].default_value = (1.0, 0.95, 0.82, 1)
    bs.inputs['Roughness'].default_value = 0.42
    bs.inputs['Emission Color'].default_value = (1.0, 0.90, 0.70, 1)
    bs.inputs['Emission Strength'].default_value = KERNEL
    o.data.materials.clear(); o.data.materials.append(m)


def pearl_glass():
    """珍珠材质按对象名覆盖（不要再用 rep("mat-kernel-glass")）。

    第 29 轮红色诊断（NOVA_GLASS_COLOR=1,0,0 / TRANS=0 / EMIT=1）渲出画面里没有红色，
    证明 rep("mat-kernel-glass", ...) 完全没命中：glTF 导入后材质名不可靠（可能被去重加后缀）。
    与 kernel_warm() 同理，直接按对象名取 jade-pearl 并换上一份新材质，参数全部走环境变量。
    """
    o = bpy.data.objects.get("jade-pearl")
    if not o or o.type != "MESH":
        print("PEARL-MISS pearl-like objects:", [x.name for x in bpy.data.objects if "pearl" in x.name.lower()])
        print("PEARL-MISS glass-like materials:", [m.name for m in bpy.data.materials if "glass" in m.name.lower()])
        return
    col = tuple(float(v) for v in os.environ.get("NOVA_PEARL_COLOR", "0.96,0.92,0.82").split(","))
    m = bpy.data.materials.new("mat-pearl-v2"); m.use_nodes = True
    nt = m.node_tree
    bs = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    bs.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1)
    bs.inputs["Roughness"].default_value = float(os.environ.get("NOVA_PEARL_ROUGH", "0.06"))
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["IOR"].default_value = float(os.environ.get("NOVA_PEARL_IOR", "1.47"))
    # 薄壁玻璃珠：透射高但不为 1，保留一点奶白体色；自发光只补"内部有一点光"的印象。
    if "Transmission Weight" in bs.inputs:
        bs.inputs["Transmission Weight"].default_value = float(os.environ.get("NOVA_PEARL_TRANS", "0.62"))
    if "Coat Weight" in bs.inputs:
        bs.inputs["Coat Weight"].default_value = float(os.environ.get("NOVA_PEARL_COAT", "1.0"))
        bs.inputs["Coat Roughness"].default_value = 0.02
    bs.inputs["Emission Color"].default_value = (col[0], col[1], col[2], 1)
    bs.inputs["Emission Strength"].default_value = float(os.environ.get("NOVA_PEARL_EMIT", "0.12"))
    o.data.materials.clear(); o.data.materials.append(m)
    print("PEARL-OVERRIDE ok", o.name, "mats:", [s.material.name for s in o.material_slots if s.material])
def ground_shadow():
    """接触阴影：没有它，玉衡在暖白页面上是"浮着"的。

    用 shadow catcher 平面，配合 film_transparent 输出到 alpha，页面背景仍由 CSS 决定。
    """
    if os.environ.get("NOVA_GROUND", "1") == "0": return
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, float(os.environ.get("NOVA_GROUND_Z", "-1.58"))))
    p = bpy.context.active_object
    p.name = "ground-shadow"
    p.is_shadow_catcher = True
    print("GROUND-SHADOW ok")

def materials():
    sb = tuple(float(v) for v in SHELL_BASE.split(","))
    # SSS 半径决定"肉色"：旧值 (0.30,0.62,0.44) 是绿色的，球体再怎么调底都发青；
    # 参考图的玉肉是暖白偏黄（实测 rgb 187,169,136），所以默认改成暖色，并可用 NOVA_SSS_RAD 覆盖。
    sss_rad = tuple(float(v) for v in os.environ.get("NOVA_SSS_RAD", "0.52,0.44,0.32").split(","))
    # 壳粗糙度可覆盖：参考图是薄玻璃壳，边缘要有 Fresnel 弧光；0.22 的粗糙度会把弧光磨成雾面
    shell_rough = float(os.environ.get("NOVA_SHELL_ROUGH", "0.22"))
    rep("mat-jade-shell", sb, shell_rough, 0.0, trans=TRANS, ior=float(os.environ.get("NOVA_IOR", "1.55")), coat=float(os.environ.get("NOVA_COAT", "0.20")), sss=SSS, sss_rad=sss_rad, sss_scale=0.14)
    # 第 26 轮：壳是实心球，Transmission=1 时光在两层界面间反复折射，Cycles 里永远渲成乳白
    # （s5-a/s6-a 实测：transmission 拉满、吸收关掉仍不透）。要"薄壁玻璃"只能改用 Alpha 混合，
    # 让壳几乎不参与折射，只保留边缘高光与反射。NOVA_SHELL_ALPHA<1 时切到 BLEND。
    _shell_alpha = float(os.environ.get("NOVA_SHELL_ALPHA", "1.0"))
    if _shell_alpha < 0.999:
        for _n in bpy.data.materials["mat-jade-shell"].node_tree.nodes:
            if _n.type == 'BSDF_PRINCIPLED':
                _n.inputs['Alpha'].default_value = _shell_alpha
                _n.inputs['Roughness'].default_value = max(_n.inputs['Roughness'].default_value, 0.04)
                break
        bpy.data.materials["mat-jade-shell"].blend_method = 'BLEND'
    shell_volume()
    kernel_warm()
    pearl_glass()
    print("MATS-kernel:", [m.name for m in bpy.data.materials if "kernel" in m.name.lower()])
    rep("mat-kernel", (1.0, 0.96, 0.88), 0.62, 0.0, emit=(1.0, 0.88, 0.66), emit_str=KERNEL)
    rep("mat-serpent", (0.66, 0.48, 0.19), 0.30, 0.85, coat=0.30)
    serpent_plates()
    # 甲片底色可覆盖：参考图是"金铜蛇身 + 细密甲片"，青玉甲片在首页尺寸下会整条读成绿管
    rep("mat-serpent-scale",
        tuple(float(v) for v in os.environ.get("NOVA_SCALE_BASE", "0.10,0.32,0.22").split(",")),
        float(os.environ.get("NOVA_SCALE_ROUGH", "0.24")),
        float(os.environ.get("NOVA_SCALE_METAL", "0.42")))
    # 蛇头材质名是 mat-serpent-head（build-jade.ts 里 headMat），之前误按旧名
    # mat-serpent-upper-jaw 覆写，导致头部保持 GLB 里的铜色、与绿色蛇身断开。
    for n in ("mat-serpent-head", "mat-serpent-brow-l", "mat-serpent-brow-r"):
        rep(n, (0.52, 0.36, 0.14), 0.26, 0.82, coat=0.25)
    rep("mat-serpent-mouth", (0.12, 0.07, 0.04), 0.55, 0.0)
    rep("mat-eye", (0.20, 0.72, 0.48), 0.12, 0.0, emit=(0.14, 0.55, 0.34), emit_str=1.2, coat=1.0)
    rep("mat-kernel-glow", (1.0, 0.94, 0.80), 0.9, 0.0)
    # 内层玉球（build-jade.ts 的 inner-globe）：参考图里它是"半透玉胎 + 细白星点"，
    # 外玻璃壳几乎全透，所以它才是球体主体的颜色来源。
    opal_rgb = tuple(float(v) for v in os.environ.get("NOVA_OPAL_COLOR", "0.74,0.86,0.72").split(","))
    rep("mat-opal", opal_rgb, float(os.environ.get("NOVA_OPAL_ROUGH", "0.30")), 0.0,
        trans=float(os.environ.get("NOVA_OPAL_TRANS", "0.55")), ior=1.45, coat=0.30,
        emit=opal_rgb, emit_str=float(os.environ.get("NOVA_OPAL_EMIT", "0.0")))
    # 内球半透同样只能走 Alpha：rep() 会 nt.nodes.clear() 重建节点树，所以这段必须放在 rep 之后。
    _opal_alpha = float(os.environ.get("NOVA_OPAL_ALPHA", "1.0"))
    if _opal_alpha < 0.999:
        for _n in bpy.data.materials["mat-opal"].node_tree.nodes:
            if _n.type == 'BSDF_PRINCIPLED':
                _n.inputs['Alpha'].default_value = _opal_alpha
                break
        bpy.data.materials["mat-opal"].blend_method = 'BLEND'
    # 内圈宽带与带上装饰：与铜环同族材质，色略亮
    band_rgb = tuple(float(v) for v in os.environ.get("NOVA_BAND_COLOR", "0.72,0.52,0.22").split(","))
    rep("mat-inner-band", band_rgb, 0.26, 0.95)
    rep("mat-band-badge", (0.42, 0.31, 0.12), 0.34, 0.9)
    rep("mat-band-dot", (0.86, 0.72, 0.40), 0.30, 0.85)
    # 内层玻璃珠：参考图球心是一颗能反光的玻璃球，不是一颗发光的小豆。
    # 给它薄壁玻璃 + 极弱的内部自发光，高光弧由环境灯盘打出。
    # 教训：trans=0.94 + 薄壁 在小球上等于"看不见"——m1 诊断里球心是空的。
    # 参考图的珍珠是"奶白玻璃珠 + 一点内部光"，所以传输压到 0.5，并保留微弱自发光。
    # 教训（第 9 轮）：外壳调到 trans=0.95/dens=0.06 仍是奶白球，说明"奶"不来自外壳。
    # 这两层才是：kernel-glass 罩在内珠外、透射 0.5 又带 0.35 自发光；jade-core 底色是青玉绿。
    core_rgb = tuple(float(v) for v in os.environ.get("NOVA_CORE_COLOR", "0.30,0.62,0.48").split(","))
    # 第 13 轮：底色写死 (1.0,0.985,0.94) 会把 GLB 里的暖白珠重新漂白，
    # 无论 build-jade.ts 怎么调都读成"硬边白盘"。底色与自发光改成可覆盖的暖白。
    glass_rgb = tuple(float(v) for v in os.environ.get("NOVA_GLASS_COLOR", "0.98,0.93,0.80").split(","))
    rep("mat-kernel-glass", glass_rgb, 0.05, 0.0, trans=float(os.environ.get("NOVA_GLASS_TRANS", "0.50")), ior=1.47, coat=1.0, emit=glass_rgb, emit_str=float(os.environ.get("NOVA_GLASS_EMIT", "0.16")))
    # 诊断（第 10 轮）：GLB 里 jade-inner-core 直径 1.48，占外壳半径 74%，底色调青绿、透射仅 0.30、
    # SSS 0.4 —— 它才是"调外壳参数毫无反应"的原因：肉眼看到的那颗球就是它，不是外壳。
    rep("mat-jade-core", core_rgb, 0.16, 0.0, trans=float(os.environ.get("NOVA_CORE_TRANS", "0.30")), ior=1.5, sss=float(os.environ.get("NOVA_CORE_SSS", "0.4")), sss_rad=(0.25,0.5,0.4), sss_scale=0.2)
    # 第 13 轮：骨架在玻璃里读成"荧光白线"，因为发光 0.10 + 高 coat 把边缘打亮；
    # 参考图的梁是实玉色，靠体积而非发光发亮。
    rep("mat-jade-strut",
        tuple(float(v) for v in os.environ.get("NOVA_STRUT_COLOR", "0.30,0.46,0.30").split(",")),
        float(os.environ.get("NOVA_STRUT_ROUGH", "0.26")), 0.0,
        trans=float(os.environ.get("NOVA_STRUT_TRANS", "0.18")), ior=1.5, coat=float(os.environ.get("NOVA_STRUT_COAT", "0.18")),
        emit=(0.70, 0.80, 0.64), emit_str=float(os.environ.get("NOVA_STRUT_EMIT", "0.02")))
    # 玉轴原来写死淡薄荷 (0.78,0.94,0.86)，在玻璃里也读成白棒；改成青玉本体色。
    axis_rgb = tuple(float(v) for v in os.environ.get("NOVA_AXIS_COLOR", "0.44,0.64,0.46").split(","))
    rep("mat-jade-axis", axis_rgb, 0.16, 0.0, trans=float(os.environ.get("NOVA_AXIS_TRANS", "0.22")), ior=1.5, coat=0.25, emit=axis_rgb, emit_str=float(os.environ.get("NOVA_AXIS_EMIT", str(AXIS_EMIT))))
    # 环色必须可调：mat-copper-ring 长期写死 (0.78,0.60,0.30)，build-jade.ts 里怎么改
    # metalness/颜色都会被这里覆盖（第 25 轮踩过的坑）。参考图的古铜金更暗更黄。
    ring_rgb = tuple(float(v) for v in os.environ.get("NOVA_RING_COLOR", "0.70,0.50,0.20").split(","))
    ring_rough = float(os.environ.get("NOVA_RING_ROUGH", "0.30"))
    rep("mat-copper-ring", ring_rgb, ring_rough, float(os.environ.get("NOVA_RING_METAL", "0.92")))
    rep("mat-copper-tick", tuple(min(1.0, c * 1.15) for c in ring_rgb), 0.22, 0.95)
    rep("mat-gold", ring_rgb, ring_rough, 0.92)
    # 玉牌必须是青玉，不能是白色平板（2026-11-10 渲染诊断：白板读成占位贴纸）
    rep("mat-tablet", (0.12, 0.36, 0.26), 0.20, 0.0, trans=0.10, ior=1.55, coat=0.3, keep_tex=True)
    rep("mat-star", (0.92, 0.82, 0.52), 0.30, 0.6, emit=(0.85, 0.68, 0.32), emit_str=0.8)
    rep("mat-relief", (0.72, 0.56, 0.28), 0.32, 0.85)

def camera():
    # NOVA_CAM="x,y,z,tx,ty,tz,lens" 可换机位做局部检查（默认首页正向）
    spec = os.environ.get("NOVA_CAM", "").strip()
    if spec:
        vals = [float(v) for v in spec.split(",")]
        loc, tgt, lens = tuple(vals[0:3]), tuple(vals[3:6]), vals[6]
    else:
        loc, tgt, lens = (0, -10.0, 0.35), (0, 0, 0.1), 92
    cd = bpy.data.cameras.new("cam"); cd.lens = lens
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (mathutils.Vector(tgt) - mathutils.Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera = cam

def lights():
    def add(name, loc, energy, size, color):
        d = bpy.data.lights.new(name, type='AREA'); d.energy = energy; d.size = size; d.color = color
        d.shape = 'DISK'
        o = bpy.data.objects.new(name, d); o.location = loc
        bpy.context.scene.collection.objects.link(o)
        v = mathutils.Vector((0,0,0.1)) - mathutils.Vector(loc)
        o.rotation_euler = v.to_track_quat('-Z','Y').to_euler()
    # 灯盘尺寸必须小：12 单位的 DISK 在 10 单位距离上张角约 60°，
    # 会在玉壳的高光里映成几个大椭圆光斑，看着像"球里有团云"——本轮实测确认这就是云斑来源，
    # 不是玉絮噪声。缩到 4–5 单位后高光收成一个柔和亮点。
    k = float(os.environ.get("NOVA_LIGHT_SCALE", "1.0"))
    # 能量单独可调：参考图的高光是很小很亮的点/条（p90 亮度 233），
    # 我们的旧参数是"大而软的灯盘"，高光糊成一片，p90 只有 181。收缩灯盘并提亮才有硬高光。
    le = float(os.environ.get("NOVA_LIGHT_ENERGY", "1.0"))
    # 灯色可覆盖：诊断"整体发青"到底来自材质还是冷色轮廓光（rim 原值为偏蓝的 0.92,0.98,1.0）
    def lc(name, default):
        return tuple(float(v) for v in os.environ.get(name, default).split(","))
    add("key", (5.2, -7.0, 6.4), 900 * le, 3.5 * k, lc("NOVA_KEY_COLOR", "1.0,0.97,0.90"))
    add("rim", (-6.8, 2.2, 3.6), 700 * le, 4.5 * k, lc("NOVA_RIM_COLOR", "0.92,0.98,1.0"))
    add("back", (0.2, 5.2, 2.0), 520 * le, 4.0 * k, lc("NOVA_BACK_COLOR", "1.0,0.98,0.92"))
    add("fill", (-3.4, -7.6, 0.8), 260 * le, 3.5 * k, lc("NOVA_FILL_COLOR", "1.0,1.0,1.0"))
    # 珍珠高光：珠心是一颗小玻璃珠，只有"正前方一个小光源"才能在珠面打出一个明确高光点。
    # 大灯盘只会把它糊成一团白光，所以单独给一盏小灯，默认关闭（0 = 不出灯）。
    pl = float(os.environ.get("NOVA_PEARL_LIGHT", "0"))
    # 光斑大小也要能调：高光点的大小正比于灯盘张角，1.1 单位在 5.4 单位距离上仍偏大，
    # 珠面读成一片柔光而不是"点"——这是"珠心像光团不像玻璃珠"的直接原因之一。
    ps = float(os.environ.get("NOVA_PEARL_SIZE", "1.1"))
    pp = tuple(float(v) for v in os.environ.get("NOVA_PEARL_POS", "1.4,-5.2,1.6").split(","))
    if pl > 0:
        add("pearl-spec", (pp[0], pp[1], pp[2]), pl, ps, (1.0, 0.96, 0.86))

def world():
    w = bpy.data.worlds.new("w"); bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    wc = tuple(float(v) for v in os.environ.get("NOVA_WORLD_COLOR", "0.92,0.93,0.88").split(","))
    bg.inputs['Color'].default_value = (wc[0], wc[1], wc[2], 1)
    bg.inputs['Strength'].default_value = float(os.environ.get("NOVA_WORLD_STR", "0.55"))

def render_settings():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x = RES
    sc.render.resolution_y = RES
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'

files = sorted(glob.glob(os.path.join(FRAMES, "frame-*.glb")))
os.makedirs(OUT, exist_ok=True)
print("FRAMES", len(files))

HIDE = [s.strip() for s in os.environ.get("NOVA_HIDE", "").split(",") if s.strip()]

def hide_objects():
    if not HIDE: return
    kill = [o for o in bpy.data.objects if any(h in o.name for h in HIDE)]
    for o in kill:
        bpy.data.objects.remove(o, do_unlink=True)
    print("HIDDEN", len(kill), [o for o in HIDE])

i = 0
for f in files:
    reset()
    bpy.ops.import_scene.gltf(filepath=f)
    hide_objects()
    materials(); camera(); lights(); world(); ground_shadow(); render_settings()
    name = os.path.basename(f).replace(".glb", ".png")
    bpy.context.scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    i += 1
    print("RENDERED", i, name, flush=True)
print("DONE", i)
