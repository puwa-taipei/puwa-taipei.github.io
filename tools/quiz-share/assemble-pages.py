#!/usr/bin/env python3
"""Copy only the byte-verified public release allowlist into an empty Pages artifact."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil

PUBLIC_DIRS = {"assets", "contribute", "data", "downloads", "game", "review", "village", "v"}


def assemble(source: Path, output: Path):
    source = source.resolve(strict=True)
    output = output.resolve()
    if output == source or output in source.parents:
        raise ValueError("Output must be a separate new directory")
    manifest_path = source / "release-manifest.json"
    raw_manifest = manifest_path.read_bytes()
    manifest = json.loads(raw_manifest)
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Release allowlist is empty")
    verified = []
    paths = set()
    for row in entries:
        raw_path = row.get("path", "")
        relative = PurePosixPath(raw_path)
        if not isinstance(raw_path, str) or relative.is_absolute() or "\\" in raw_path or any(part in {"", ".", ".."} for part in raw_path.split("/")):
            raise ValueError("Unsafe allowlisted path")
        if raw_path == "release-manifest.json" or raw_path in paths:
            raise ValueError("Duplicate or self-referential allowlist entry")
        if len(relative.parts) > 1 and relative.parts[0] not in PUBLIC_DIRS:
            raise ValueError("Only reviewed public directories can enter the artifact")
        if len(relative.parts) == 1 and raw_path != ".nojekyll" and (raw_path.startswith(".") or relative.suffix not in {".html", ".css", ".js", ".json", ".md"}):
            raise ValueError("Unexpected public root file")
        original = source.joinpath(*relative.parts)
        if original.is_symlink() or not original.resolve(strict=True).is_relative_to(source) or not original.is_file():
            raise ValueError("Symlink or non-file in release allowlist")
        cursor = original.parent
        while cursor != source:
            if cursor.is_symlink():
                raise ValueError("Symlink directory in release allowlist")
            cursor = cursor.parent
        data = original.read_bytes()
        if len(data) != row.get("bytes") or hashlib.sha256(data).hexdigest() != row.get("sha256"):
            raise ValueError("Public payload does not match release manifest")
        paths.add(raw_path)
        verified.append((original, relative))
    output.mkdir(parents=True, exist_ok=False)
    for original, relative in verified:
        destination = output.joinpath(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, destination)
    (output / "release-manifest.json").write_bytes(raw_manifest)
    return {"baseStaticPayloadFiles": len(verified) + 1, "allHashesVerified": True, "onlyManifestAllowlistCopied": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(assemble(args.source, args.output)))


if __name__ == "__main__":
    main()
