"""Tests for the Blender scripts. They need Blender's Python module, not a Blender window:

    uv venv --python 3.13 .venv-bpy && uv pip install --python .venv-bpy/bin/python bpy
    .venv-bpy/bin/python blender/tests/test_blender.py

Reading the finished GLB back is done by tests/read_glb.mjs (gltf-transform), so the check
does not trust Blender's own idea of what it exported.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import bpy  # noqa: F401  (must come first: it registers bmesh and mathutils)
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import clean_model  # noqa: E402
import make_openable  # noqa: E402

TMP = tempfile.mkdtemp(prefix="blender-tests-")
REPO = os.path.dirname(os.path.dirname(HERE))


def read_glb(path):
    out = subprocess.run(["node", os.path.join(HERE, "read_glb.mjs"), path], cwd=REPO, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def add_texture(obj):
    img = bpy.data.images.new("test-texture", 256, 256)
    img.pixels = [0.8, 0.5, 0.2, 1.0] * (256 * 256)
    img.pack()
    mat = bpy.data.materials.new("skin")
    mat.use_nodes = True
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    mat.node_tree.links.new(node.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    obj.data.materials.append(mat)


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True)


def test_clean():
    clean_model.reset_scene()
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=0.05, location=(0.3, 0.2, 0.9))
    body = bpy.context.active_object
    body.scale = (1.0, 1.0, 2.0)  # a tall object, so height and width differ
    add_texture(body)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.001, location=(0.4, 0.2, 0.9))  # stray speck
    speck = bpy.context.active_object
    bpy.ops.mesh.primitive_cube_add(size=0.02, location=(-0.1, 0.0, 0.9))  # a cube whose corners are not welded
    cube = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(cube.data)
    bmesh.ops.split_edges(bm, edges=bm.edges)
    bm.to_mesh(cube.data)
    bm.free()
    assert len(cube.data.vertices) == 24
    for o in (body, speck, cube):
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    src = os.path.join(TMP, "raw.glb")
    export(src)

    dst = os.path.join(TMP, "clean.glb")
    report = os.path.join(TMP, "clean.report.json")
    data = clean_model.run(src, dst, report, height_mm=120, target_faces=8000)

    assert data["triangles_before"] > 20000, data
    assert data["triangles_after"] <= 8400, data
    assert data["decimated"] is True
    assert data["clean"][0]["faces_in_small_islands"] >= 80, "the speck should be dropped"
    assert data["clean"][0]["verts_welded"] >= 16, "the split cube should be welded"
    assert abs(data["size_m"]["y"] - 0.120) < 1e-4, data["size_m"]
    assert os.path.exists(report)
    assert any(i["name"].startswith("test-texture") for i in data["images"]), "the texture must survive"

    final = read_glb(dst)
    lo, hi = final["bounds"]["min"], final["bounds"]["max"]
    assert abs(lo[1]) < 1e-5, "base sits on y = 0"
    assert abs((lo[0] + hi[0]) / 2) < 1e-5 and abs((lo[2] + hi[2]) / 2) < 1e-5, "centred over the origin"
    assert abs(hi[1] - 0.120) < 1e-4
    assert final["textures"] == 1, final
    print("clean: ok,", data["triangles_before"], "->", data["triangles_after"], "triangles")


def box_scene():
    clean_model.reset_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.04))
    body = bpy.context.active_object
    body.name = "body"
    body.scale = (0.10, 0.10, 0.08)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.085))
    lid = bpy.context.active_object
    lid.name = "lid"
    lid.scale = (0.10, 0.10, 0.01)
    for o in (body, lid):
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return body, lid


def clip_info(path):
    info = read_glb(path)
    return {a["name"]: a for a in info["animations"]}


def test_openable():
    body, lid = box_scene()
    result = make_openable.make_openable("lid", "back-top", 100)
    assert result["axis"] == "X" and result["sign"] == -1, result  # front edge lifts, so the turn is negative about +X
    # The pivot is the back-top edge of the lid: y = +0.05 (back), z = 0.09 (top).
    assert abs(result["pivot"][1] - 0.05) < 1e-6 and abs(result["pivot"][2] - 0.09) < 1e-6, result
    out = os.path.join(TMP, "box.glb")
    make_openable.export_glb(out)
    clips = clip_info(out)
    assert set(clips) == {"lid.open", "lid.close"}, clips.keys()
    final_quaternion = clips["lid.open"]["rotation_last"]
    assert abs(abs(final_quaternion[0]) - math.sin(math.radians(50))) < 1e-3, final_quaternion
    assert clips["lid.close"]["rotation_last"][3] > 0.999, "close ends back at rest"
    print("openable back-top: ok")

    body, lid = box_scene()
    result = make_openable.make_openable("lid", "front-top", 100)
    assert result["sign"] == 1, result
    print("openable front-top: ok")

    body, lid = box_scene()
    result = make_openable.make_openable("lid", "right-top", 100)
    assert result["axis"] == "Y", result
    print("openable right-top: ok")


def test_bad_input():
    box_scene()
    for args in (("lid", "middle-top"), ("lid", "backtop"), ("nope", "back-top")):
        try:
            make_openable.make_openable(args[0], args[1], 90)
        except SystemExit:
            continue
        raise AssertionError("expected SystemExit for %r" % (args,))
    print("bad input: ok")


if __name__ == "__main__":
    test_clean()
    test_openable()
    test_bad_input()
    print("all Blender tests passed")
