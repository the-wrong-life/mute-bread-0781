# -*- coding: utf-8 -*-
"""灰模渲染（Clay）：把 GLB 的全部材质换成同一灰色 Principled，用于只看结构与比例。

用法：
  $env:NOVA_FRAMES=<dir with frame-000.glb>
  $env:NOVA_OUT=<dir>
  $env:NOVA_CAM="x,y,z,tx,ty,tz,lens"   # 可只渲染一个机位；不设则渲默认正面
  blender -b --python tools/blender/clay.py
"""
import bpy, os, glob, math

FRAMES = os.environ.get("NOVA_FRAMES", ".")
OUT = os.environ.get("NOVA_OUT", ".")
RES = int(os.environ.get("NOVA_RES", "900"))
SAMPLES = int(os.environ.get("NOVA_SAMPLES", "12"))
CLAY = tuple(float(v) for v in os.environ.get("NOVA_CLAY_COLOR", "0.62,0.62,0.62").split(","))
HIDE = [s.strip() for s in os.environ.get("NOVA_HIDE", "").split(",") if s.strip()]
ARC_THICK = float(os.environ.get("NOVA_ARC_THICK", "0.028"))

def clay_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = [n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"][0]
    bs.inputs["Base Color"].default_value = (CLAY[0], CLAY[1], CLAY[2], 1)
    bs.inputs["Roughness"].default_value = 0.42
    bs.inputs["Metallic"].default_value = 0.0
    return m

def setup(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in list(bpy.data.objects):
        if any(h in o.name for h in HIDE):
            bpy.data.objects.remove(o, do_unlink=True)
    m = clay_material("mat-clay")
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            ob.data.materials.clear(); ob.data.materials.append(m)
            # 弧片玉壳在 three.js 里是单层面片，灰模也必须加厚度才看得出"玉壁"
            if "arc-shell" in ob.name and ARC_THICK > 0:
                md = ob.modifiers.new(name="arc-thick", type="SOLIDIFY")
                md.thickness = ARC_THICK
                md.offset = 0.0
                md.use_even_offset = True
                md.use_rim = True
    # 世界光：均匀灰，避免方向光把结构吃掉
    w = bpy.data.worlds.new("W"); bpy.context.scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.92, 0.92, 0.92, 1); bg.inputs[1].default_value = 0.9
    key = bpy.data.lights.new("key", "AREA"); key.energy = 900; key.size = 7.0
    ko = bpy.data.objects.new("key", key); bpy.context.collection.objects.link(ko)
    ko.location = (-4.2, -6.0, 5.4)
    ko.rotation_euler = (math.radians(48), 0, math.radians(-32))
    fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 260; fill.size = 10.0
    fo = bpy.data.objects.new("fill", fill); bpy.context.collection.objects.link(fo)
    fo.location = (5.0, -5.0, 1.2); fo.rotation_euler = (math.radians(80), 0, math.radians(46))
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = SAMPLES
    sc.cycles.device = "CPU"
    sc.render.resolution_x = RES; sc.render.resolution_y = RES
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd)
    bpy.context.collection.objects.link(cam); sc.camera = cam
    return cam, cd

def aim(cam, cd, spec):
    p = [float(v) for v in spec.split(",")]
    cam.location = (p[0], p[1], p[2])
    tgt = p[3:6]
    import mathutils
    d = mathutils.Vector(tgt) - mathutils.Vector((p[0], p[1], p[2]))
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cd.lens = p[6] if len(p) > 6 else 92.0

files = sorted(glob.glob(os.path.join(FRAMES, "frame-*.glb")))
cams = os.environ.get("NOVA_CAMS", "")
if cams:
    spots = [s.strip() for s in cams.split(";") if s.strip()]
else:
    spots = [os.environ.get("NOVA_CAM", "0,-10.4,0.34,0,0,0.05,92")]
os.makedirs(OUT, exist_ok=True)
cam, cd = setup(files[0])
for i, spec in enumerate(spots):
    aim(cam, cd, spec)
    bpy.context.scene.render.filepath = os.path.join(OUT, "clay-%02d.png" % i)
    bpy.ops.render.render(write_still=True)
    print("CLAY-WROTE", bpy.context.scene.render.filepath)