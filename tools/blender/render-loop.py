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
KERNEL = float(os.environ.get("NOVA_KERNEL", "7.0"))
SSS = float(os.environ.get("NOVA_SSS", "0.52"))
TRANS = float(os.environ.get("NOVA_TRANS", "0.36"))
AXIS_EMIT = float(os.environ.get("NOVA_AXIS_EMIT", "0.0"))
SHELL_BASE = os.environ.get("NOVA_SHELL_BASE", "0.09,0.34,0.24")

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
    brick.inputs['Scale'].default_value = 6.5
    brick.inputs['Mortar Size'].default_value = 0.018
    brick.inputs['Mortar Smooth'].default_value = 0.2
    brick.inputs['Color1'].default_value = (0.20, 0.44, 0.31, 1)
    brick.inputs['Color2'].default_value = (0.15, 0.36, 0.25, 1)
    brick.inputs['Mortar'].default_value = (0.10, 0.27, 0.19, 1)
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

def materials():
    sb = tuple(float(v) for v in SHELL_BASE.split(","))
    rep("mat-jade-shell", sb, 0.10, 0.0, trans=TRANS, ior=1.55, coat=0.55, sss=SSS, sss_rad=(0.30,0.62,0.44), sss_scale=0.14)
    rep("mat-kernel", (1.0, 0.96, 0.88), 0.62, 0.0, emit=(1.0, 0.88, 0.66), emit_str=KERNEL)
    rep("mat-serpent", (0.66, 0.48, 0.19), 0.30, 0.85, coat=0.30)
    serpent_plates()
    rep("mat-serpent-scale", (0.10, 0.32, 0.22), 0.24, 0.42)
    for n in ("mat-serpent-upper-jaw",):
        rep(n, (0.09, 0.30, 0.21), 0.28, 0.30, sss=0.35, sss_rad=(0.2,0.4,0.3), sss_scale=0.1)
    rep("mat-serpent-mouth", (0.12, 0.07, 0.04), 0.55, 0.0)
    rep("mat-eye", (0.20, 0.72, 0.48), 0.12, 0.0, emit=(0.14, 0.55, 0.34), emit_str=1.2, coat=1.0)
    rep("mat-kernel-glow", (1.0, 0.94, 0.80), 0.9, 0.0)
    rep("mat-jade-core", (0.30, 0.62, 0.48), 0.22, 0.0, trans=0.30, ior=1.5, sss=0.4, sss_rad=(0.25,0.5,0.4), sss_scale=0.2)
    rep("mat-jade-axis", (0.78, 0.94, 0.86), 0.14, 0.0, trans=0.30, ior=1.5, coat=0.3, emit=(0.86, 0.98, 0.90), emit_str=AXIS_EMIT)
    rep("mat-copper-ring", (0.78, 0.60, 0.30), 0.26, 0.92)
    rep("mat-copper-tick", (0.90, 0.74, 0.42), 0.22, 0.95)
    rep("mat-gold", (0.80, 0.62, 0.30), 0.26, 0.92)
    # 玉牌必须是青玉，不能是白色平板（2026-11-10 渲染诊断：白板读成占位贴纸）
    rep("mat-tablet", (0.12, 0.36, 0.26), 0.20, 0.0, trans=0.10, ior=1.55, coat=0.3, keep_tex=True)
    rep("mat-star", (0.92, 0.82, 0.52), 0.30, 0.6, emit=(0.85, 0.68, 0.32), emit_str=0.8)
    rep("mat-relief", (0.72, 0.56, 0.28), 0.32, 0.85)

def camera():
    cd = bpy.data.cameras.new("cam"); cd.lens = 92
    cam = bpy.data.objects.new("cam", cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0, -10.0, 0.35)
    cam.rotation_euler = (mathutils.Vector((0,0,0.1)) - mathutils.Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera = cam

def lights():
    def add(name, loc, energy, size, color):
        d = bpy.data.lights.new(name, type='AREA'); d.energy = energy; d.size = size; d.color = color
        d.shape = 'DISK'
        o = bpy.data.objects.new(name, d); o.location = loc
        bpy.context.scene.collection.objects.link(o)
        v = mathutils.Vector((0,0,0.1)) - mathutils.Vector(loc)
        o.rotation_euler = v.to_track_quat('-Z','Y').to_euler()
    add("key", (5.2, -7.0, 6.4), 1050, 12.0, (1.0, 0.97, 0.90))
    add("rim", (-6.8, 2.2, 3.6), 900, 10.0, (0.92, 0.98, 1.0))
    add("back", (0.2, 5.2, 2.0), 700, 9.0, (1.0, 0.98, 0.92))
    add("fill", (-3.4, -7.6, 0.8), 320, 10.0, (1.0, 1.0, 1.0))

def world():
    w = bpy.data.worlds.new("w"); bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.92, 0.93, 0.88, 1)
    bg.inputs['Strength'].default_value = 0.55

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
    materials(); camera(); lights(); world(); render_settings()
    name = os.path.basename(f).replace(".glb", ".png")
    bpy.context.scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    i += 1
    print("RENDERED", i, name, flush=True)
print("DONE", i)
