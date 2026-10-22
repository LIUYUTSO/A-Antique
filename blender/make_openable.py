"""Give a hand-separated part (a lid, a flap) a hinge and an open/close animation, then export a GLB.

    blender -b work/012.blend -P blender/make_openable.py -- --part lid --hinge back-top \
        --angle 110 --out out/final/012.glb

The part is a mesh object you split off in Blender and named, for example `lid`. The hinge is
<side>-<top|bottom>, seen from the front of the object (front faces +Z in the GLB):
back-top for a box lid, front-bottom for a drop-down flap, left-top / right-top for side-hinged lids.
Two clips are exported, `<part>.open` and `<part>.close`, so the viewer can play either way.
The part swings away from the rest of the object, so you never have to work out the sign.
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import script_args  # noqa: E402

SIDES = {"back", "front", "left", "right"}
EDGES = {"top", "bottom"}
FRAMES = 24


def parse_hinge(text):
    try:
        side, edge = text.split("-")
    except ValueError:
        raise SystemExit("hinge must look like back-top")
    if side not in SIDES or edge not in EDGES:
        raise SystemExit("hinge side is one of %s and edge is top or bottom" % ", ".join(sorted(SIDES)))
    return side, edge


def world_bounds(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = Vector((min(p[i] for p in pts) for i in range(3)))
    hi = Vector((max(p[i] for p in pts) for i in range(3)))
    return lo, hi


def hinge_point(obj, side, edge):
    """Blender axes: +X is right, +Y is the back, +Z is up (glTF +Z, the front, is Blender -Y)."""
    lo, hi = world_bounds(obj)
    c = (lo + hi) / 2
    p = Vector(c)
    if side == "back":
        p.y = hi.y
    elif side == "front":
        p.y = lo.y
    elif side == "left":
        p.x = lo.x
    else:
        p.x = hi.x
    p.z = hi.z if edge == "top" else lo.z
    axis = "X" if side in ("back", "front") else "Y"
    return p, axis


def centre_of(objs):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for o in objs:
        a, b = world_bounds(o)
        for i in range(3):
            lo[i] = min(lo[i], a[i])
            hi[i] = max(hi[i], b[i])
    return (lo + hi) / 2


def opening_sign(part, others, pivot, axis, angle):
    """+1 or -1: the sign of the rotation that carries the part away from the rest of the object."""
    lo, hi = world_bounds(part)
    centroid = (lo + hi) / 2
    anchor = centre_of(others) if others else centroid
    best, best_distance = 1, -1.0
    for sign in (1, -1):
        rot = Matrix.Rotation(sign * angle, 4, axis)
        moved = pivot + rot @ (centroid - pivot)
        d = (moved - anchor).length
        if d > best_distance:
            best, best_distance = sign, d
    return best


def move_origin_to(part, point):
    world = part.matrix_world.copy()
    part.parent = None
    part.matrix_world = world
    part.data.transform(part.matrix_world)
    part.matrix_world = Matrix.Identity(4)
    part.data.transform(Matrix.Translation(-point))
    part.location = point


def add_clip(part, name, start_angle, end_angle, axis_index):
    anim = part.animation_data_create()
    action = bpy.data.actions.new(name)
    anim.action = action
    part.rotation_mode = "XYZ"
    for frame, value in ((1, start_angle), (FRAMES, end_angle)):
        part.rotation_euler = [value if i == axis_index else 0.0 for i in range(3)]
        part.keyframe_insert("rotation_euler", frame=frame)
    # Park the action on its own NLA track: the exporter turns each track into one named clip.
    track = anim.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    anim.action = None


def make_openable(part_name, hinge, angle_deg):
    part = bpy.data.objects.get(part_name)
    if part is None or part.type != "MESH":
        raise SystemExit("No mesh object named %r. Objects: %s" % (part_name, ", ".join(o.name for o in bpy.data.objects)))
    side, edge = parse_hinge(hinge)
    others = [o for o in bpy.context.scene.objects if o.type == "MESH" and o != part]
    pivot, axis = hinge_point(part, side, edge)
    angle = math.radians(angle_deg)
    sign = opening_sign(part, others, pivot, axis, angle)
    move_origin_to(part, pivot)
    axis_index = "XYZ".index(axis)
    add_clip(part, part_name + ".open", 0.0, sign * angle, axis_index)
    add_clip(part, part_name + ".close", sign * angle, 0.0, axis_index)
    part.rotation_euler = (0.0, 0.0, 0.0)
    return {"part": part_name, "pivot": tuple(pivot), "axis": axis, "sign": sign, "angle_deg": angle_deg}


def export_glb(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_image_format="AUTO",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
    )


def main(argv=None):
    p = argparse.ArgumentParser(prog="make_openable.py")
    p.add_argument("--part", required=True)
    p.add_argument("--hinge", required=True)
    p.add_argument("--angle", type=float, default=110.0)
    p.add_argument("--out", required=True)
    a = p.parse_args(script_args() if argv is None else argv)
    info = make_openable(a.part, a.hinge, a.angle)
    export_glb(a.out)
    print("make_openable:", info, "->", a.out)
    return info


if __name__ == "__main__":
    main()
