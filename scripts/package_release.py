"""Create a GitHub-ready ZIP using an explicit public file list.

This script never enumerates the working directory or reads Git history.
Run with Python 3.10+; no third-party dependency is required.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = (
    ".gitignore",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "README.en.md",
    "demo-data.json",
    "demo.html",
    "favicon.svg",
    "index.html",
    "docs/GitHub填写内容.md",
    "docs/images/gantt.png",
    "docs/images/settings.png",
    "docs/images/today.png",
    "docs/发布文案.md",
    "docs/本地验证.md",
    "docs/演示脚本.md",
    "scripts/build_demo.py",
    "scripts/package_release.py",
    "tests/settings.test.cjs",
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/day-threads-github.zip")
    args = parser.parse_args()
    target = args.output.resolve()
    checksum = target.with_suffix(".sha256")
    if target.suffix.lower() != ".zip":
        raise SystemExit("Output must have a .zip suffix")
    sources = [(relative, ROOT / relative) for relative in PUBLIC_FILES]
    for relative, source in sources:
        if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(ROOT):
            raise SystemExit(f"Public file missing or outside package: {relative}")
        if source.resolve() == target:
            raise SystemExit("Output must not overwrite a public source file")
    if target.exists() or checksum.exists():
        raise SystemExit("Output or checksum already exists; choose a new --output path")
    target.parent.mkdir(parents=True, exist_ok=True)
    # A fixed timestamp and permissions keep repeated builds reproducible.
    with ZipFile(target, "x", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, source in sources:
            info = ZipInfo("day-threads/" + relative, date_time=(2026, 10, 19, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, source.read_bytes(), compresslevel=9)
    with ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity check failed")
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    with checksum.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(f"{digest}  {target.name}\n")
    print(f"Created: {target.name} ({len(sources)} public files, {target.stat().st_size} bytes)")
    print(f"SHA256: {digest}")


if __name__ == "__main__":
    main()
