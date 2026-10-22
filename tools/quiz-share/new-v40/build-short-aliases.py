#!/usr/bin/env python3
"""Clone reviewed v40 result HTML into bounded, crawler-readable short aliases.

Only q/ aliases are written. Original card HTML, PNGs, catalogs and manifests are
read-only inputs. Scores remain player claims; no backend or personal data is used.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re

HERE = Path(__file__).resolve().parent
ORIGIN = "https://puwa.taipei"
SOURCE_VERSION = "1abf6bd319996ad4f03ec6a32d753f3c8101d9e471de8107fb0b8e1ec091d13c"
INDEX_ORDER_SHA256 = "dcc948e43cf04707f2e2d97686370fc73767607b9d8d19ad3ee5127407191335"
CARD_BASE = "game/quiz/cards/v40/"
MANIFEST_PATH = "q/build-manifest-v40.json"
DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"
MODE_CODES = {"score": "s", "quote": "q"}
SOURCE_LIMITS = {".html": 65536, ".png": 524288}


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def safe_path(root: Path, relative: str) -> Path:
    parts = PurePosixPath(relative)
    if (not relative or parts.is_absolute() or "\\" in relative
            or any(part in {"", ".", ".."} for part in relative.split("/"))):
        raise ValueError("Unsafe artifact path")
    target = root.joinpath(*parts.parts)
    if not target.resolve().is_relative_to(root):
        raise ValueError("Artifact path escaped the site")
    cursor = target
    while cursor != root:
        if cursor.is_symlink():
            raise ValueError("Symlink in artifact path")
        cursor = cursor.parent
    return target


def read(root: Path, relative: str, limit: int) -> bytes:
    path = safe_path(root, relative)
    if not path.is_file() or path.stat().st_size > limit:
        raise ValueError("Missing or oversized reviewed input: " + relative)
    return path.read_bytes()


def alias_path(index: int, correct: int, mode: str) -> str:
    if (isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < 37
            or isinstance(correct, bool) or not isinstance(correct, int) or not 0 <= correct <= 6
            or mode not in MODE_CODES):
        raise ValueError("Invalid alias identity")
    return f"/q/40{DIGITS[index // 36]}{DIGITS[index % 36]}{correct}{MODE_CODES[mode]}/"


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonical, self.bodies, self.scripts, self.images, self.links = [], [], [], [], []
        self.metas = {}

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "meta":
            key = attrs.get("property") or attrs.get("name")
            self.metas.setdefault(key, []).append(attrs.get("content"))
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        elif tag == "body":
            self.bodies.append(attrs)
        elif tag == "script":
            self.scripts.append(attrs.get("src"))
        elif tag == "img":
            self.images.append(attrs)
        elif tag == "a":
            self.links.append(attrs)


def clone_html(raw: bytes, quote_id: str, index: int, correct: int, mode: str) -> bytes:
    text = raw.decode("utf-8", errors="strict")
    stem = f"{quote_id}-{correct}-6-{mode}"
    old_url = ORIGIN + "/" + CARD_BASE + stem + ".html"
    image_url = ORIGIN + "/" + CARD_BASE + stem + ".png"
    page = Page()
    page.feed(text)
    expected = {"data-quote-id": quote_id, "data-correct": str(correct), "data-total": "6",
                "data-mode": mode, "data-source-version": SOURCE_VERSION}
    if (page.canonical != [old_url] or page.metas.get("og:url") != [old_url]
            or any(page.metas.get(key) != [image_url] for key in ("og:image", "og:image:secure_url", "twitter:image"))
            or len(page.bodies) != 1 or "data-quiz-share-landing" not in page.bodies[0]
            or any(page.bodies[0].get(key) != value for key, value in expected.items())
            or "data-alias-page" in page.bodies[0]
            or page.scripts != ["/game/quiz-share-core-v40.js?v=40", "/game/quiz-share-landing-v40.js?v=40"]):
        raise ValueError("Original card identity or metadata differs from reviewed v24 HTML")
    challenge = [link for link in page.links if link.get("id") == "quiz-share-challenge"]
    if len(challenge) != 1 or challenge[0].get("href") != "/game/quiz/":
        raise ValueError("Original card must use a generic challenge fallback")
    replacements = (
        (f'<link rel="canonical" href="{old_url}">', f'<link rel="canonical" href="{ORIGIN + alias_path(index, correct, mode)}">'),
        (f'<meta property="og:url" content="{old_url}">', f'<meta property="og:url" content="{ORIGIN + alias_path(index, correct, mode)}">'),
        (f'src="{stem}.png"', f'src="{image_url}"'),
        (f'href="{stem}.png" download', f'href="{image_url}" download'),
        ('data-quiz-share-landing data-quote-id=', 'data-quiz-share-landing data-alias-page="v40" data-quote-id='),
    )
    for original, replacement in replacements:
        if text.count(original) != 1:
            raise ValueError("Ambiguous original card replacement")
        text = text.replace(original, replacement)
    alias = Page()
    alias.feed(text)
    if (alias.canonical != [ORIGIN + alias_path(index, correct, mode)]
            or alias.metas.get("og:url") != alias.canonical
            or alias.bodies[0].get("data-alias-page") != "v40"
            or alias.images[0].get("src") != image_url
            or alias.scripts != ["/game/quiz-share-core-v40.js?v=40", "/game/quiz-share-landing-v40.js?v=40"]):
        raise ValueError("Alias transformation did not preserve its identity")
    return text.encode("utf-8")


def expected_outputs(site: Path) -> dict[str, bytes]:
    pins = json.loads((HERE / "quiz-share-source-v40.json").read_bytes())
    ids = pins.get("quoteIds")
    if (pins.get("version") != "v40" or pins.get("subjectId") != "shen-pao-yang"
            or pins.get("sourceVersion") != SOURCE_VERSION or not isinstance(ids, list) or len(ids) != 37
            or any(not isinstance(value, str) or not re.fullmatch(r"[a-z0-9-]{1,100}", value) for value in ids)
            or digest(("\n".join(ids) + "\n").encode()) != INDEX_ORDER_SHA256):
        raise ValueError("Immutable short-token index mapping changed")
    raw_source = read(site, "data/quotes-v40.json", 2000000)
    if digest(raw_source) != SOURCE_VERSION:
        raise ValueError("Raw quotation source differs from pinned version")
    source = json.loads(raw_source)
    if [q.get("id") for q in source.get("quotes", [])] != pins.get("sourceQuoteIds"):
        raise ValueError("Pinned source membership differs")
    manifest = json.loads(read(site, CARD_BASE + "build-manifest.json", 350000))
    if (manifest.get("version") != "v40" or manifest.get("sourceVersion") != SOURCE_VERSION
            or manifest.get("cardCount") != 518 or manifest.get("fileCount") != 1036):
        raise ValueError("Original card manifest version or count differs")
    records = manifest.get("files")
    if not isinstance(records, list) or len(records) != 1036:
        raise ValueError("Original card manifest is incomplete")
    original_paths = {CARD_BASE + f"{quote_id}-{correct}-6-{mode}{extension}"
                      for quote_id in ids for correct in range(7) for mode in MODE_CODES for extension in SOURCE_LIMITS}
    by_path = {}
    for row in records:
        if (not isinstance(row, dict) or row.get("path") not in original_paths or row["path"] in by_path
                or isinstance(row.get("bytes"), bool) or not isinstance(row.get("bytes"), int)
                or not re.fullmatch(r"[a-f0-9]{64}", str(row.get("sha256", "")))):
            raise ValueError("Invalid or duplicate original card row")
        by_path[row["path"]] = row
    if set(by_path) != original_paths:
        raise ValueError("Original card manifest path set differs")
    outputs, files = {}, []
    for index, quote_id in enumerate(ids):
        for correct in range(7):
            for mode in MODE_CODES:
                stem = f"{quote_id}-{correct}-6-{mode}"
                originals = {}
                for extension, limit in SOURCE_LIMITS.items():
                    name = CARD_BASE + stem + extension
                    raw = read(site, name, limit)
                    row = by_path[name]
                    if len(raw) != row["bytes"] or digest(raw) != row["sha256"]:
                        raise ValueError("Original card bytes differ from its manifest: " + name)
                    originals[extension] = raw
                source_path = CARD_BASE + stem + ".html"
                path = alias_path(index, correct, mode).lstrip("/") + "index.html"
                output = clone_html(originals[".html"], quote_id, index, correct, mode)
                outputs[path] = output
                files.append({"path": path, "bytes": len(output), "sha256": digest(output),
                              "sourcePath": source_path, "sourceHtmlSha256": digest(originals[".html"])})
    outputs[MANIFEST_PATH] = json_bytes({"version": "v40", "kind": "static-quiz-short-aliases", "tokenVersion": "40",
        "sourceVersion": SOURCE_VERSION, "indexOrderSha256": INDEX_ORDER_SHA256, "cardCount": 518,
        "fileCount": 518, "files": sorted(files, key=lambda row: row["path"])})
    return outputs


def existing_paths(site: Path) -> set[str]:
    root = safe_path(site, "q")
    if not root.exists():
        return set()
    if not root.is_dir():
        raise ValueError("Alias root is not a directory")
    result = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError("Symlink in alias output")
        if path.is_file():
            relative = path.relative_to(site).as_posix()
            # The immutable v32 generator independently owns these historical outputs.
            if relative == "q/build-manifest-v32.json" or re.fullmatch(r"q/24[0-9a-z][0-6][sq]/index\.html", relative):
                continue
            # Independent v41 aliases are not inputs or outputs of this generator.
            if relative == "q/build-manifest-v41.json" or re.fullmatch(r"q/41[0-9a-z]{2}[0-6][sq]/index\.html", relative):
                continue
            result.add(relative)
    return result


def generate(site: Path, *, verify_only=False) -> dict:
    if site.is_symlink():
        raise ValueError("Site root cannot be a symlink")
    site = site.resolve(strict=True)
    if not site.is_dir():
        raise ValueError("Site root must be a directory")
    outputs = expected_outputs(site)
    existing = existing_paths(site)
    if existing - set(outputs):
        raise ValueError("Unexpected alias output paths; no files removed")
    # Validate every source and existing output before the first write. Conflicts
    # fail closed; rerunning an identical build is safe and preserves all bytes.
    for name, raw in outputs.items():
        path = safe_path(site, name)
        if path.exists() and (not path.is_file() or path.read_bytes() != raw):
            raise ValueError("Immutable alias output conflict: " + name)
        if verify_only and not path.is_file():
            raise ValueError("Missing alias output: " + name)
    written = 0
    if not verify_only:
        for name, raw in outputs.items():
            path = safe_path(site, name)
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                with path.open("xb") as stream:
                    stream.write(raw)
                written += 1
    if existing_paths(site) != set(outputs):
        raise ValueError("Alias output set differs")
    for name, raw in outputs.items():
        if safe_path(site, name).read_bytes() != raw:
            raise ValueError("Alias output bytes differ: " + name)
    return {"status": "verified" if verify_only else "built_and_verified", "aliases": 518, "manifest": MANIFEST_PATH,
            "filesWritten": written, "oldCardsWritten": 0, "pngsWritten": 0, "backendCalls": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", required=True, type=Path)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    print(json.dumps(generate(args.site_dir, verify_only=args.verify_only)))


if __name__ == "__main__":
    main()
