#!/usr/bin/env python3
"""Fetch the pinned OFL font into a build-only directory, verifying every byte."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


def fetch(entry, destination):
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == entry["sha256"]:
        return
    request = Request(entry["url"], headers={"User-Agent": "quiz-og-reproducible-build/18"})
    with urlopen(request, timeout=60) as response:
        if response.status != 200 or response.geturl() != entry["url"]:
            raise ValueError("Font download redirected or returned an error")
        data = response.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ValueError("Downloaded open-font bytes do not match the reviewed pin")
    destination.write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    pins = json.loads((Path(__file__).parent / "og-font-v18.json").read_text(encoding="utf-8"))
    for key in ("font", "licenseFile"):
        entry = pins[key]
        fetch(entry, args.output / entry["filename"])
    print(json.dumps({"fontVerified": True, "licenseVerified": True, "commit": pins["commit"]}))


if __name__ == "__main__":
    main()
