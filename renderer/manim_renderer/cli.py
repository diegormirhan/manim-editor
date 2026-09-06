import argparse
from pathlib import Path
import sys

from .project import load_project
from .scene_compiler import compile_project


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile an editor project to Manim Python.")
    parser.add_argument("project", type=Path)
    arguments = parser.parse_args()
    try:
        source = compile_project(load_project(arguments.project))
    except (ValueError, OSError) as error:
        print(f"Project error: {error}", file=sys.stderr)
        return 1
    sys.stdout.write(source)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

