"""Compile a temporary fixture and run solver tests without package changes."""

from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile


def main() -> int:
    """Return the compiler/test exit code; always clean temporary build files."""
    compiler = shutil.which("cc")
    if compiler is None:
        print("A C compiler named cc is required.", file=sys.stderr)
        return 2
    source = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="ovos-dnf-fixture-") as temporary:
        library = Path(temporary, "dnf-fixture-installed.so")
        build = subprocess.run(
            [
                compiler,
                "-std=c11",
                "-Wall",
                "-Wextra",
                "-Werror",
                "-shared",
                "-fPIC",
                str(source / "dnf-fixture-installed.c"),
                "-o",
                str(library),
                "-ldl",
            ],
            check=False,
        )
        if build.returncode:
            return build.returncode
        environment = os.environ.copy()
        preload = environment.get("LD_PRELOAD")
        environment["LD_PRELOAD"] = (
            f"{library}:{preload}" if preload else str(library)
        )
        environment.pop("PYTHONOPTIMIZE", None)
        return subprocess.run(
            [
                sys.executable,
                "-m",
                "unittest",
                "discover",
                "-s",
                str(source),
                "-p",
                "solver_cases.py",
                "-v",
            ],
            env=environment,
            check=False,
        ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
