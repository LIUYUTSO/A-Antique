"""Helpers shared by the Blender scripts. Run through Blender: blender -b -P <script> -- <args>."""
import json
import sys


def script_args(argv=None):
    """Arguments after the `--` that separates Blender's own flags from the script's."""
    argv = sys.argv if argv is None else argv
    return argv[argv.index("--") + 1:] if "--" in argv else []


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, sort_keys=True)
        f.write("\n")
