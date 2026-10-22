"""Clean a generated GLB: weld, drop stray bits, fix normals, trim polygons, set size and origin.

    blender -b -P blender/clean_model.py -- --in out/models/012.glb --out out/clean/012.glb \
        [--report out/clean/012.report.json] [--height-mm 120 | --longest-mm 160] \
        [--target-faces 30000] [--min-island 0.01] [--merge-mm 0.1]

Result: metres, Y up (glTF), origin at the middle of the base, every transform applied.
Nothing about the look changes: textures and UVs stay as they are, and the next step shrinks them.
"""
import argparse
import os
import sys

import bpy  # noqa: F401  (first, so the bpy module registers bmesh and mathutils)
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import script_args, write_json  # noqa: E402


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=path)


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def bake_transforms():
    """Drop parents and empties and bake every object's transform into its vertices."""
    meshes = mesh_objects()
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in meshes:
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    return meshes


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def drop_small_islands(bm, min_ratio):
    """Remove disconnected pieces smaller than min_ratio of the biggest one's face count."""
    if min_ratio <= 0 or not bm.faces:
        return 0
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for face in bm.faces:
        if face.index in seen:
            continue
        stack, island = [face], []
        seen.add(face.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for edge in f.edges:
                for other in edge.link_faces:
                    if other.index not in seen:
                        seen.add(other.index)
                        stack.append(other)
        islands.append(island)
    biggest = max(len(i) for i in islands)
    doomed = [f for i in islands if len(i) < biggest * min_ratio for f in i]
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
    return len(doomed)


def clean_mesh(obj, merge_dist, min_island):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    stats = {"faces_in": len(bm.faces)}
    welded = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge_dist)
    stats["verts_welded"] = welded - len(bm.verts)
    bmesh.ops.dissolve_degenerate(bm, dist=merge_dist, edges=bm.edges)
    stats["faces_in_small_islands"] = drop_small_islands(bm, min_island)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return stats


def decimate(obj, target_triangles):
    current = triangles(obj)
    if target_triangles <= 0 or current <= target_triangles:
        return False
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = max(0.01, target_triangles / current)
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return True


def bounds(meshes):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for o in meshes:
        for v in o.data.vertices:
            for i in range(3):
                lo[i] = min(lo[i], v.co[i])
                hi[i] = max(hi[i], v.co[i])
    return lo, hi


def normalize(meshes, height_mm=None, longest_mm=None):
    """Scale to a real size (if given) and put the middle of the base at the origin."""
    lo, hi = bounds(meshes)
    size = hi - lo
    factor = 1.0
    if height_mm:
        factor = (height_mm / 1000.0) / size.z
    elif longest_mm:
        factor = (longest_mm / 1000.0) / max(size)
    if factor != 1.0:
        for o in meshes:
            o.data.transform(Matrix.Scale(factor, 4))
        lo, hi = bounds(meshes)
    shift = Vector(((lo.x + hi.x) / -2.0, (lo.y + hi.y) / -2.0, -lo.z))
    for o in meshes:
        o.data.transform(Matrix.Translation(shift))
    lo, hi = bounds(meshes)
    return factor, hi - lo


def export_glb(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_image_format="AUTO",
        export_animations=True,
    )


def image_info():
    return sorted(
        ({"name": i.name, "width": i.size[0], "height": i.size[1]} for i in bpy.data.images if i.size[0] and i.size[1]),
        key=lambda d: d["name"],
    )


def run(src, dst, report=None, height_mm=None, longest_mm=None, target_faces=30000, min_island=0.01, merge_mm=0.1):
    reset_scene()
    import_glb(src)
    meshes = bake_transforms()
    if not meshes:
        raise SystemExit("No mesh in " + src)

    before = sum(triangles(o) for o in meshes)
    per_mesh = [clean_mesh(o, merge_mm / 1000.0, min_island) for o in meshes]
    after_clean = sum(triangles(o) for o in meshes)

    decimated = False
    for o in meshes:
        share = triangles(o) / max(1, after_clean)
        decimated = decimate(o, int(target_faces * share)) or decimated
    after = sum(triangles(o) for o in meshes)

    factor, size = normalize(meshes, height_mm, longest_mm)
    export_glb(dst)

    data = {
        "source": os.path.basename(src),
        "triangles_before": before,
        "triangles_after_clean": after_clean,
        "triangles_after": after,
        "decimated": decimated,
        "meshes": len(meshes),
        "clean": per_mesh,
        "scale_factor": factor,
        "size_m": {"x": size.x, "y": size.z, "z": size.y},  # glTF axes: Y is up
        "materials": sorted({m.name for o in meshes for m in o.data.materials if m}),
        "images": image_info(),
        "warnings": [],
    }
    if not height_mm and not longest_mm:
        data["warnings"].append("No real size given, so the model keeps the size Meshy produced.")
    if after > target_faces * 1.05:
        data["warnings"].append("Still above the polygon target after decimation.")
    if report:
        write_json(report, data)
    return data


def main(argv=None):
    p = argparse.ArgumentParser(prog="clean_model.py")
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", dest="dst", required=True)
    p.add_argument("--report")
    group = p.add_mutually_exclusive_group()
    group.add_argument("--height-mm", type=float)
    group.add_argument("--longest-mm", type=float)
    p.add_argument("--target-faces", type=int, default=30000)
    p.add_argument("--min-island", type=float, default=0.01, help="drop pieces smaller than this share of the biggest piece")
    p.add_argument("--merge-mm", type=float, default=0.1, help="weld vertices closer than this")
    a = p.parse_args(script_args() if argv is None else argv)
    data = run(a.src, a.dst, a.report, a.height_mm, a.longest_mm, a.target_faces, a.min_island, a.merge_mm)
    print("clean_model:", a.src, "->", a.dst, "triangles", data["triangles_before"], "->", data["triangles_after"])
    return data


if __name__ == "__main__":
    main()
