"""Start a Blender work file from a cleaned GLB, so hand work begins from the clean model.

    blender -b -P blender/start_work.py -- --in out/clean/012.glb --blend work/012.blend

Open the .blend in Blender and do the hand work (see blender/README.md), save, then run `open`.
"""
import argparse
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import script_args  # noqa: E402


def main(argv=None):
    p = argparse.ArgumentParser(prog="start_work.py")
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--blend", required=True)
    a = p.parse_args(script_args() if argv is None else argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=a.src)
    os.makedirs(os.path.dirname(os.path.abspath(a.blend)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=a.blend)
    print("start_work:", a.src, "->", a.blend)


if __name__ == "__main__":
    main()
