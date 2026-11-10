# -*- coding: utf-8 -*-
"""
玉衡（NOVA CORE）Blender 离线渲染脚本 —— 定稿版 v18

用途：把 /lab 页面导出的 yuheng-jade-core.glb 在 Blender 中重新布光、
      重写材质（GLB 里的 Three 材质在 Blender 中表现不足），
      输出首页主视觉所需的透明背景 PNG。

用法（Windows）：
  set NOVA_GLB=C:\path\to\yuheng-jade-core.glb
  set NOVA_OUT=C:\path\to\out
  "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b --python tools/blender/render-yuheng.py

依赖：Blender 4.5 LTS（Cycles CPU 渲染，单张约 60-90 秒 @1400x1400/128 samples）
"""
import bpy, os, math, mathutils

OUT = os.environ.get("NOVA_OUT", os.path.dirname(os.path.abspath(__file__)))
GLB = os.environ.get("NOVA_GLB", os.path.join(OUT, "yuheng-jade-core.glb"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
print("OBJ", len(bpy.data.objects))

def rep(name, base, rough, metal, trans=0.0, ior=1.45, coat=0.0, emit=None, emit_str=0.0, keep_tex=False, sss=0.0, sss_rad=(0.5,0.9,0.7), sss_scale=0.3):
    m = bpy.data.materials.get(name)
    if not m:
        print("MISSING", name); return
    m.use_nodes = True
    nt = m.node_tree
    tex_img = None
    if keep_tex:
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                tex_img = n.image; break
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
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
        noise.inputs['Scale'].default_value = 3.4
        noise.inputs['Detail'].default_value = 8.0
        noise.inputs['Roughness'].default_value = 0.62
        nr = nt.nodes.new('ShaderNodeValToRGB')
        nr.color_ramp.elements[0].position = 0.36
        nr.color_ramp.elements[0].color = (0.10, 0.33, 0.23, 1)
        nr.color_ramp.elements[1].position = 0.68
        nr.color_ramp.elements[1].color = (0.44, 0.74, 0.58, 1)
        nt.links.new(noise.outputs['Fac'], nr.inputs['Fac'])
        nt.links.new(nr.outputs['Color'], bs.inputs['Base Color'])
    if sss > 0 and 'Subsurface Weight' in bs.inputs:
        bs.inputs['Subsurface Weight'].default_value = sss
        bs.inputs['Subsurface Radius'].default_value = sss_rad
        bs.inputs['Subsurface Scale'].default_value = sss_scale
    if tex_img is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = tex_img; t.interpolation = 'Smart'
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.7
        bump.inputs['Distance'].default_value = 0.05
        nt.links.new(t.outputs['Color'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
        bt = nt.nodes.new('ShaderNodeTexImage'); bt.image = tex_img
        nt.links.new(bt.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])

# 参考图是暖白纸底上的青玉：玉必须浅、透、有内部散射，不能是深墨绿
# 实心浅青玉：透射只留一点点做边缘水头，主体靠次表面散射表现"玉肉"，这样球心不会再透出背景的白。
rep("mat-jade-shell", (0.17, 0.47, 0.34), 0.10, 0.0, trans=0.36, ior=1.55, coat=0.55, sss=0.52, sss_rad=(0.30,0.62,0.44), sss_scale=0.14)
# 内核只作柔光核：强度过高时透过球壳形成边界生硬的中央白斑（本轮诊断已确认）
rep("mat-kernel", (1.0, 0.96, 0.88), 0.62, 0.0, emit=(1.0, 0.88, 0.66), emit_str=7.0)
rep("mat-serpent", (0.06, 0.20, 0.14), 0.28, 0.34, coat=0.30)
def serpent_plates():
    m = bpy.data.materials.get("mat-serpent")
    nt = m.node_tree
    bs = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.inputs['Scale'].default_value = 3.4
    brick.inputs['Mortar Size'].default_value = 0.055
    brick.inputs['Mortar Smooth'].default_value = 0.2
    brick.inputs['Bias'].default_value = 0.0
    brick.inputs['Brick Width'].default_value = 0.5
    brick.inputs['Row Height'].default_value = 0.5
    # 甲片取深青玉，砖缝取金铜：远看是金铜蛇裹青玉甲，近看有鳞片分界
    brick.inputs['Color1'].default_value = (0.055, 0.19, 0.13, 1)
    brick.inputs['Color2'].default_value = (0.035, 0.13, 0.09, 1)
    brick.inputs['Mortar'].default_value = (0.11, 0.26, 0.18, 1)
    uvc = nt.nodes.new('ShaderNodeTexCoord')
    # 砖格旋转 45° 成菱形：横竖方砖读起来是"砖墙"，菱形才是覆瓦甲片
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = 0.785398
    nt.links.new(uvc.outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], bs.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    # 凸起过强会把鳞片读成竹编/藤编，改为以颜色分片、只留极浅起伏
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.012
    nt.links.new(brick.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    print("SERPENT-PLATES ok")
serpent_plates()
rep("mat-serpent-belly", (0.58, 0.46, 0.22), 0.40, 0.55)
rep("mat-serpent-jaw", (0.07, 0.24, 0.17), 0.35, 0.30)
rep("mat-serpent-crest", (0.86, 0.68, 0.38), 0.24, 1.0)
rep("mat-eye", (0.45, 0.96, 0.68), 0.08, 0.0, emit=(0.20, 0.92, 0.52), emit_str=3.0, coat=1.0)
rep("mat-jade-axis", (0.70, 0.92, 0.80), 0.10, 0.0, trans=0.22, ior=1.5, coat=1.0, sss=0.8, sss_scale=0.30)
rep("mat-gold", (0.86, 0.66, 0.32), 0.20, 1.0)
rep("mat-copper-ring", (0.60, 0.39, 0.15), 0.30, 1.0)
rep("mat-copper-tick", (0.90, 0.74, 0.44), 0.24, 1.0)
rep("mat-tablet", (0.80, 0.90, 0.82), 0.18, 0.0, trans=0.25, ior=1.5, coat=1.0, keep_tex=True, sss=0.6, sss_scale=0.2)
rep("mat-star", (0.85, 0.68, 0.34), 0.25, 0.75, emit=(0.9, 0.72, 0.36), emit_str=0.5)
rep("mat-relief", (0.80, 0.66, 0.40), 0.30, 1.0)
rep("mat-plinth", (0.76, 0.88, 0.80), 0.14, 0.0, trans=0.30, ior=1.5, coat=0.9, sss=0.5)

# 蛇头改亮金，与蛇身鳞甲区分开（参考图的蛇头是金铜色带绿眼）
head_mat = bpy.data.materials.new("head-gold"); head_mat.use_nodes = True
hb = head_mat.node_tree.nodes["Principled BSDF"]
hb.inputs['Base Color'].default_value = (0.62, 0.45, 0.19, 1)
hb.inputs['Metallic'].default_value = 0.5
hb.inputs['Roughness'].default_value = 0.24
for o in bpy.data.objects:
    if o.type == 'MESH' and (o.name.startswith('serpent-skull') or o.name.startswith('serpent-snout') or o.name.startswith('serpent-crest')):
        o.data.materials.clear()
        o.data.materials.append(head_mat)
        print("HEADMAT", o.name)

# 铜环带加刻度细纹，避免"素腰带"
mr = bpy.data.materials.get("mat-copper-ring")
if mr:
    mr.use_nodes = True
    nt2 = mr.node_tree
    bs2 = [n for n in nt2.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    wv = nt2.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.bands_direction = 'Z'
    wv.inputs['Scale'].default_value = 14.0
    wv.inputs['Distortion'].default_value = 0.0
    cmix = nt2.nodes.new('ShaderNodeMixRGB')
    cmix.blend_type = 'MIX'
    cmix.inputs['Fac'].default_value = 0.62
    cmix.inputs['Color1'].default_value = (0.42, 0.28, 0.10, 1)
    cmix.inputs['Color2'].default_value = (0.78, 0.58, 0.28, 1)
    nt2.links.new(wv.outputs['Fac'], cmix.inputs['Fac'])
    nt2.links.new(cmix.outputs['Color'], bs2.inputs['Base Color'])
    bmp2 = nt2.nodes.new('ShaderNodeBump')
    bmp2.inputs['Strength'].default_value = 0.35
    nt2.links.new(wv.outputs['Fac'], bmp2.inputs['Height'])
    nt2.links.new(bmp2.outputs['Normal'], bs2.inputs['Normal'])
    print("COPPER-TICKS ok")

# 球壳加实体壁厚：单面球壳在 transmission 下内壁相互反射，中央出现形状不规则的大块亮区。
# Solidify 给出真实壁厚后，厚度差才能被体积吸收正确读出。
# 注意：不要给球壳加 Solidify。球面本身是闭合曲面，Volume Absorption 会在球内生效；
# 一旦加厚成双层壳，体积被限制在 0.085 的壁内，路径太短，吸收几乎失效，球心会直接透出背景的白色。
_sh = bpy.data.objects.get("jade-shell")
print("SHELL", _sh.name if _sh else "MISSING")

# 蛇头单独给青玉材质：
# 蛇身用砖格贴图表达甲片，但蛇头是球体 UV，砖格在头上只铺到一两块，读成整块金铜色，
# 于是头和身颜色断开、像"绿管子插了块金石头"。这里按对象直接换成与蛇身同色系的青玉。
def head_material():
    m = bpy.data.materials.new("mat-serpent-head-jade")
    m.use_nodes = True
    nt = m.node_tree
    bs = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    bs.inputs['Base Color'].default_value = (0.07, 0.24, 0.17, 1)
    bs.inputs['Roughness'].default_value = 0.22
    bs.inputs['Metallic'].default_value = 0.30
    if 'Coat Weight' in bs.inputs:
        bs.inputs['Coat Weight'].default_value = 0.6
    # 头部保留一点细鳞起伏，避免完全塑料感
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 120.0
    noise.inputs['Detail'].default_value = 4.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.28
    bump.inputs['Distance'].default_value = 0.02
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return m

_hm = head_material()
for _n in ("serpent-upper-jaw", "serpent-lower-jaw", "serpent-mouth", "serpent-eye-socket-l", "serpent-eye-socket-r"):
    _o = bpy.data.objects.get(_n)
    if _o and _o.type == 'MESH':
        _o.data.materials.clear()
        _o.data.materials.append(_hm)
        print("HEAD-JADE", _n)
    else:
        print("HEAD-MISS", _n)

# 球壳体积吸收：让厚度决定深浅，玉的关键
ms = bpy.data.materials.get("mat-jade-shell")
if ms and ms.use_nodes:
    nt3 = ms.node_tree
    o3 = [n for n in nt3.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    vol = nt3.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value = (0.16, 0.52, 0.36, 1)
    vol.inputs['Density'].default_value = 1.7
    nt3.links.new(vol.outputs['Volume'], o3.inputs['Volume'])
    print("SHELL-VOLUME ok")

_k = bpy.data.objects.get("default-kernel")
if _k and _k.type == 'MESH':
    mk = bpy.data.materials.new("mat-kernel-warm")
    mk.use_nodes = True
    nt = mk.node_tree
    bs = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    bs.inputs['Base Color'].default_value = (1.0, 0.95, 0.82, 1)
    bs.inputs['Roughness'].default_value = 0.42
    bs.inputs['Metallic'].default_value = 0.0
    if 'Emission Color' in bs.inputs:
        bs.inputs['Emission Color'].default_value = (1.0, 0.90, 0.70, 1)
        bs.inputs['Emission Strength'].default_value = 7.0
    _k.data.materials.clear()
    _k.data.materials.append(mk)
    print("KERNEL-WARM ok")
else:
    print("KERNEL MISS")

scene = bpy.context.scene
# 暖白纸底：与参考图一致，玉的通透只在浅底上才成立
world = bpy.data.worlds.new("w"); scene.world = world
world.use_nodes = True
wn = world.node_tree
bg = wn.nodes["Background"]
grad = wn.nodes.new("ShaderNodeTexGradient")
mapping = wn.nodes.new("ShaderNodeMapping")
texco = wn.nodes.new("ShaderNodeTexCoord")
ramp = wn.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (0.62, 0.60, 0.54, 1)
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (0.96, 0.94, 0.88, 1)
wn.links.new(texco.outputs['Generated'], mapping.inputs['Vector'])
wn.links.new(mapping.outputs['Vector'], grad.inputs['Vector'])
wn.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
wn.links.new(ramp.outputs['Color'], bg.inputs[0])
bg.inputs[1].default_value = 1.15

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -1.72))
plane = bpy.context.object
plane.hide_render = True  # 首页用透明背景 + CSS 投影
pm = bpy.data.materials.new("ground"); pm.use_nodes = True
pb = pm.node_tree.nodes["Principled BSDF"]
pb.inputs["Base Color"].default_value = (0.80, 0.78, 0.72, 1)
pb.inputs["Roughness"].default_value = 0.55
plane.data.materials.append(pm)

cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data)
bpy.context.scene.collection.objects.link(cam)
cam_data.lens = 92
bpy.context.scene.camera = cam

def add_light(name, loc, energy, size, color):
    d = bpy.data.lights.new(name, type='AREA'); d.energy = energy; d.size = size; d.color = color
    o = bpy.data.objects.new(name, d); o.location = loc
    bpy.context.scene.collection.objects.link(o)
    v = mathutils.Vector((0,0,0.1)) - mathutils.Vector(loc)
    o.rotation_euler = v.to_track_quat('-Z','Y').to_euler()

add_light("key", (5.2, -7.0, 6.4), 1050, 7.0, (1.0, 0.97, 0.90))
add_light("rim", (-6.8, 2.2, 3.6), 900, 6.0, (0.92, 0.98, 1.0))
add_light("back", (0.2, 5.2, 2.0), 700, 5.0, (1.0, 0.98, 0.92))
add_light("fill", (-3.4, -7.6, 0.8), 320, 6.0, (1.0, 1.0, 1.0))

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

VIEWS = {"web": (0.0, -10.0, 0.35), "side": (-9.6, -2.6, 0.35), "quarter": (-6.6, -7.4, 2.6)}
# 头部局部：Three (0.891,0.860,0) → Blender (0.891, 0, 0.860)；吻端朝 (-0.70,-0.20,0.68)
LOOK = {"closeup-front": ((0.72, -2.55, 1.02), (0.86, 0.0, 0.94), 108),
        "closeup-side": ((2.52, 0.0, 2.60), (0.86, 0.0, 0.90), 108),
        "closeup-quarter": ((1.85, -1.95, 2.20), (0.86, 0.0, 0.92), 108)}
def shoot(name, loc, target, lens=None):
    if lens:
        cam_data.lens = lens
    cam.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)

for k, loc in VIEWS.items():
    shoot("yuheng-web-%s" % k, loc, (0, 0, 0.05), 92)
for k, (loc, tgt, lens) in LOOK.items():
    shoot("yuheng-%s" % k, loc, tgt, lens)
print("DONE")