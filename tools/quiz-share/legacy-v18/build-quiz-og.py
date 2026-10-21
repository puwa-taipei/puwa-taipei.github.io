#!/usr/bin/env python3
"""Build immutable, crawler-readable quiz result cards from the pinned public corpus."""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

HERE = Path(__file__).resolve().parent
ORIGIN = "https://puwa.taipei"
VERSION = "v18"
CARD_BASE = "/game/quiz/cards/v18/"
CATALOG_PATH = "data/quiz-share-catalog-v18.json"
SELF_REPORTED = "玩家自行分享，未經伺服器驗證"
SIZE = (1200, 630)
MODES = ("score", "quote")
OUTCOMES = range(7)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def safe_url(value) -> str:
    if not isinstance(value, str) or any(ord(c) < 32 for c in value):
        return ""
    parts = urlsplit(value)
    return value if parts.scheme in {"http", "https"} and parts.hostname and not parts.username and not parts.password else ""


def public_quote(q: dict) -> dict:
    # Deliberate allowlist: the source corpus also has private-workflow locator fields.
    item = {key: str(q.get(key) or "") for key in
            ("id", "eventId", "quote", "date", "eventDate", "medium", "sourceType", "context", "frontContext", "venue", "verificationLevel")}
    item["eventId"] = item["eventId"] or item["id"]
    item["eventDate"] = item["eventDate"] or item["date"]
    item["sourceUrl"] = safe_url(q.get("url") or q.get("sourceURL"))
    item["videoUrl"] = safe_url(q.get("videoUrl"))
    item["fullVideoUrl"] = safe_url(q.get("fullVideoUrl") or q.get("fullMeetingVideoUrl"))
    item["evidenceLocator"] = str(q.get("evidenceLocator") or q.get("timecode") or "")
    item["inferenceLimit"] = str(q.get("inferenceLimit") or q.get("editorialLimit") or q.get("cannotInfer") or "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item["id"]):
        raise ValueError("Unsafe quote identifier")
    if not item["quote"] or len(item["quote"]) > 40 or not item["sourceUrl"] or item["medium"] not in {"spoken", "written"}:
        raise ValueError("Unsupported pinned quote")
    if not item["sourceType"] or not (item["frontContext"] or item["context"]):
        raise ValueError("Quote must preserve its source basis and context")
    return item


def load_source(path: Path, pins: dict) -> tuple[list[dict], str]:
    raw = path.read_bytes()
    digest = sha256(raw)
    if digest != pins["sourceVersion"]:
        raise ValueError("Source bytes changed: publish a new card version after review")
    source = json.loads(raw)
    quotes = [q for q in source["quotes"] if q.get("quizEligible") is not False]
    if [q["id"] for q in quotes] != pins["quoteIds"] or len(quotes) != 74:
        raise ValueError("Pinned quiz membership changed")
    excluded = set(excluded_quote_ids(pins))
    return [public_quote(q) for q in quotes if q["id"] not in excluded], digest


def excluded_quote_ids(pins: dict) -> list[str]:
    excluded = pins.get("excludedQuoteIds", [])
    if (not isinstance(excluded, list)
            or any(not isinstance(item, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", item)
                   or item not in pins.get("quoteIds", []) for item in excluded)
            or len(set(excluded)) != len(excluded)):
        raise ValueError("Invalid editorial exclusion list")
    return excluded


def remove_excluded_cards(output: Path, pins: dict) -> list[str]:
    """Remove only the 28 named outputs per withdrawn item, never a directory."""
    root = output.resolve()
    target = root / CARD_BASE.lstrip("/")
    if not target.resolve().is_relative_to(root) or target.is_symlink():
        raise ValueError("Card target must remain inside the output root")
    removed = []
    for quote_id in excluded_quote_ids(pins):
        for correct in OUTCOMES:
            for mode in MODES:
                for extension in ("html", "png"):
                    path = target / f"{quote_id}-{correct}-6-{mode}.{extension}"
                    if path.resolve().parent != target.resolve():
                        raise ValueError("Excluded card path escaped its target")
                    if path.exists():
                        if not path.is_file():
                            raise ValueError("Excluded card output is not a file")
                        path.unlink()
                        removed.append(path.relative_to(root).as_posix())
    return removed


def image_metadata(q: dict, correct: int, mode: str, source_version: str) -> dict:
    return {"Quote": q["quote"], "SourceVersion": source_version, "SourceUrl": q["sourceUrl"], "Mode": mode,
            "Correct": str(correct), "Total": "6", "SelfReported": SELF_REPORTED,
            "Context": q["frontContext"] or q["context"], "SourceType": q["sourceType"], "Date": q["date"]}


def existing_image_matches(path: Path, q: dict, correct: int, mode: str, source_version: str) -> bool:
    if not path.is_file() or path.is_symlink():
        return False
    try:
        with Image.open(path) as picture:
            if picture.size != SIZE or picture.mode != "RGB":
                return False
            if any(picture.info.get(key) != value for key, value in image_metadata(q, correct, mode, source_version).items()):
                return False
            picture.verify()
        return True
    except (OSError, ValueError, SyntaxError):
        return False


def stem(q: dict, correct: int, mode: str) -> str:
    if not isinstance(correct, int) or isinstance(correct, bool) or not 0 <= correct <= 6 or mode not in MODES:
        raise ValueError("Invalid card outcome")
    return f'{q["id"]}-{correct}-6-{mode}'


def score_of(correct: int) -> int:
    # Match JavaScript Math.round for the seven supported six-question results.
    return (correct * 100 + 3) // 6


def medium_label(q: dict) -> str:
    if q["medium"] == "written":
        return "本人書面文字"
    if q["verificationLevel"] == "official-transcript-fulltext":
        return "官方逐字稿"
    return "口語／來源引述"


class Painter:
    def __init__(self, font_path: Path):
        self.font_path = font_path
        self.bounds: list[dict] = []

    @lru_cache(maxsize=80)
    def font(self, size: int):
        return ImageFont.truetype(str(self.font_path), size)

    def lines(self, text: str, size: int, width: int) -> list[str]:
        font = self.font(size)
        result, current = [], ""
        for ch in text:
            if ch == "\n":
                result.append(current)
                current = ""
            elif current and font.getlength(current + ch) > width:
                result.append(current)
                current = ch
            else:
                current += ch
        result.append(current)
        return result

    def text_box(self, draw, text: str, box, max_size: int, min_size: int, fill, label: str, spacing=1.24):
        x, y, width, height = box
        for size in range(max_size, min_size - 1, -1):
            lines = self.lines(text, size, width)
            step = int(size * spacing)
            if len(lines) * step <= height and all(self.font(size).getlength(line) <= width for line in lines):
                for i, line in enumerate(lines):
                    draw.text((x, y + i * step), line, font=self.font(size), fill=fill, anchor="lt")
                self.bounds.append({"label": label, "size": size, "lines": len(lines), "box": list(box), "complete": "".join(lines) == text.replace("\n", "")})
                return
        raise ValueError(f"Text cannot fit without truncation: {label}")

    def image(self, q: dict, correct: int, mode: str, source_version: str) -> Image.Image:
        cream, forest, coral, muted = "#f6f2e6", "#183f35", "#c35c48", "#53665c"
        image = Image.new("RGB", SIZE, cream)
        d = ImageDraw.Draw(image)
        d.rectangle((0, 0, 1200, 88), fill=forest)
        d.text((54, 27), "THE RECORD / 沈伯洋原話辨識挑戰", font=self.font(23), fill=cream, anchor="lt")
        d.text((620, 33), "PUWA-TAIPEI.GITHUB.IO/GAME/QUIZ", font=self.font(14), fill="#d8e2d5", anchor="lt")
        d.text((1004, 31), "六題一輪", font=self.font(19), fill="#e9b48c", anchor="lt")
        value = score_of(correct)
        literal = "「" + q["quote"] + "」"
        context = q["frontContext"] or q["context"]
        if mode == "score":
            self.text_box(d, "這是沈伯洋的原話嗎？", (54, 116, 700, 70), 45, 35, forest, "score-heading")
            d.text((54, 205), str(value), font=self.font(159), fill=forest, anchor="lt")
            d.text((368, 302), "分 / 100", font=self.font(30), fill=coral, anchor="lt")
            d.text((60, 397), f"答對 {correct} / 6 題", font=self.font(27), fill=forest, anchor="lt")
            d.rounded_rectangle((640, 108, 1146, 437), radius=22, fill=forest)
            d.text((669, 134), "原話有出處", font=self.font(19), fill="#e9b48c", anchor="lt")
            self.text_box(d, literal, (663, 189, 458, 171), 39, 27, cream, "score-quote")
            self.text_box(d, q["date"] + " · " + medium_label(q), (668, 380, 452, 42), 17, 13, "#d8e2d5", "score-date")
        else:
            heading = "沈伯洋這段文字，你認得？" if q["medium"] == "written" else "沈伯洋這句話，你認得？"
            self.text_box(d, heading, (54, 114, 883, 61), 44, 34, forest, "quote-heading")
            d.rounded_rectangle((943, 111, 1147, 184), radius=14, fill=forest)
            d.text((963, 127), f"我得 {value} 分", font=self.font(27), fill=cream, anchor="lt")
            d.text((967, 161), f"答對 {correct} / 6", font=self.font(16), fill="#d8e2d5", anchor="lt")
            self.text_box(d, q["date"] + " · " + medium_label(q), (58, 181, 1084, 33), 19, 15, muted, "quote-date")
            self.text_box(d, literal, (48, 231, 1104, 204), 66, 46, forest, "quote-primary")
        self.text_box(d, context, (58, 451, 1084, 57), 20, 16, muted, "full-front-context")
        self.text_box(d, "來源：" + q["sourceType"], (58, 518, 1084, 29), 17, 14, muted, "full-source-type")
        d.rectangle((0, 566, 1200, 630), fill=forest)
        d.text((55, 582), "換你挑戰，認出更多原話。", font=self.font(24), fill=cream, anchor="lt")
        d.text((722, 583), SELF_REPORTED, font=self.font(17), fill="#e1d7bd", anchor="lt")
        image.info["metadata"] = {"Quote": q["quote"], "SourceVersion": source_version, "SourceUrl": q["sourceUrl"], "Mode": mode,
                                  "Correct": str(correct), "Total": "6", "SelfReported": SELF_REPORTED, "Context": context, "SourceType": q["sourceType"], "Date": q["date"]}
        return image


def html_card(q: dict, correct: int, mode: str, source_version: str) -> str:
    e = lambda value: html.escape(str(value), quote=True)
    name = stem(q, correct, mode)
    url = ORIGIN + CARD_BASE + name + ".html"
    image_url = ORIGIN + CARD_BASE + name + ".png"
    score = score_of(correct)
    title = f"我得 {score} 分，你能認出更多沈伯洋原話嗎？" if mode == "score" else f"「{q['quote']}」｜沈伯洋原話辨識挑戰"
    description = f"答對 {correct}/6 題。{SELF_REPORTED}。{q['date']} · {q['sourceType']}。附原始來源與上下文，換你挑戰。"
    alt = f"{title} 答對 {correct}/6 題。原文：{q['quote']}。{SELF_REPORTED}。"
    links = [("讀原始來源與上下文 ↗", q["sourceUrl"])]
    if q["videoUrl"]:
        links.append(("看發言影片 ↗", q["videoUrl"]))
    if q["fullVideoUrl"] and q["fullVideoUrl"] != q["videoUrl"]:
        links.append(("看完整會議影片 ↗", q["fullVideoUrl"]))
    source_links = "".join(f'<li><a href="{e(link)}" target="_blank" rel="noopener noreferrer">{e(label)}</a></li>' for label, link in links)
    front = f'<p class="quiz-share-front-context">{e(q["frontContext"])}</p>' if q["frontContext"] else ""
    locator = f'<p><strong>影片／原文位置：</strong>{e(q["evidenceLocator"])}</p>' if q["evidenceLocator"] else ""
    limit = f'<p><strong>證據範圍：</strong>{e(q["inferenceLimit"])}</p>' if q["inferenceLimit"] else ""
    return f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,follow"><meta name="theme-color" content="#183f35">
<title>{e(title)}</title><meta name="description" content="{e(description)}"><link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:locale" content="zh_TW"><meta property="og:site_name" content="國會紀錄觀測・紀錄遊樂場"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{image_url}"><meta property="og:image:secure_url" content="{image_url}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="{e(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{e(title)}"><meta name="twitter:description" content="{e(description)}"><meta name="twitter:image" content="{image_url}"><meta name="twitter:image:alt" content="{e(alt)}"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/game/quiz-share.css?v=18"></head>
<body class="quiz-share-landing" data-quiz-share-landing data-quote-id="{e(q['id'])}" data-correct="{correct}" data-total="6" data-mode="{mode}" data-source-version="{source_version}">
<main class="quiz-share-landing-main"><p class="eyebrow">THE RECORD / CHALLENGE A FRIEND</p><h1>{e(title)}</h1><p>玩家分享答對 {correct} / 6 題，得分 {score} / 100。<strong>{SELF_REPORTED}</strong>。</p>
<img class="quiz-share-landing-card" src="{name}.png" alt="{e(alt)}" width="1200" height="630">
<div class="quiz-share-landing-actions"><a id="quiz-share-challenge" class="button primary" href="/game/quiz/">換我挑戰 →</a><a href="{name}.png" download>下載這張卡</a><a href="/game/">回遊樂場 ↗</a></div><p id="quiz-share-status" role="status" aria-live="polite">可以開始一輪原話挑戰。若連結附有完整且有效的同題資料，會使用相同六題。</p>
<section id="quiz-share-landing-fact" class="quiz-share-landing-context" aria-labelledby="quiz-share-source-title"><h2 id="quiz-share-source-title">把這一則原話，放回來源。</h2><blockquote>{e(q['quote'])}</blockquote><p>{e(q['date'])} · {e(medium_label(q))} · {e(q['venue'])}</p><p>{e(q['sourceType'])}</p>{front}<p>{e(q['context'])}</p>{locator}<ul>{source_links}</ul>{limit}</section>
<p class="small-note">這是有來源的精選原話遊戲；辨識得分不是支持度、人格或真誠程度的測量。挑戰連結不含玩家姓名、聯絡資料或逐題答案。</p><a href="/">回國會紀錄觀測 ↗</a></main>
<script src="/game/quiz-share-core.js?v=28" defer></script><script src="/game/quiz-share-landing.js?v=18" defer></script></body></html>
'''


def catalog_data(quotes: list[dict], source_version: str) -> dict:
    return {"version": VERSION, "subjectId": "shen-pao-yang", "sourceVersion": source_version, "roundSize": 6, "modes": list(MODES),
            "cardBase": CARD_BASE, "imageWidth": 1200, "imageHeight": 630, "selfReportedLabel": SELF_REPORTED,
            "quoteCount": len(quotes), "cards": len(quotes) * len(OUTCOMES) * len(MODES), "quotes": quotes}


def write_catalog(output: Path, catalog: dict):
    path = output / CATALOG_PATH
    if path.exists():
        old = load_json(path)
        if old.get("version") != VERSION or old.get("sourceVersion") != catalog["sourceVersion"]:
            raise ValueError("Immutable card version already exists with other source bytes")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def build(site_dir: Path, source: Path, font: Path, output: Path, *, samples_only=False) -> dict:
    pins = load_json(HERE / "quiz-share-source-v18.json")
    font_pins = load_json(HERE.parent / "og-font-v18.json")
    if sha256(font.read_bytes()) != font_pins["font"]["sha256"]:
        raise ValueError("Font digest differs from reviewed open-font pin")
    quotes, source_version = load_source(source, pins)
    target = output / CARD_BASE.lstrip("/")
    catalog_file = output / CATALOG_PATH
    if catalog_file.exists():
        old = load_json(catalog_file)
        if old.get("version") != VERSION or old.get("sourceVersion") != source_version:
            raise ValueError("Immutable card version already exists with other source bytes")
    target.mkdir(parents=True, exist_ok=True)
    removed = remove_excluded_cards(output, pins)
    painter = Painter(font)
    chosen = quotes[:1] if samples_only else quotes
    corrects = (4,) if samples_only else OUTCOMES
    files, total_bytes, preserved_pngs = [], 0, 0
    for q in chosen:
        for correct in corrects:
            for mode in MODES:
                name = stem(q, correct, mode)
                png = target / (name + ".png")
                picture = painter.image(q, correct, mode, source_version)
                if existing_image_matches(png, q, correct, mode, source_version):
                    preserved_pngs += 1
                else:
                    metadata = PngImagePlugin.PngInfo()
                    for key, value in picture.info.pop("metadata").items():
                        metadata.add_itxt(key, value)
                    picture.save(png, format="PNG", optimize=True, pnginfo=metadata)
                page = target / (name + ".html")
                page.write_text(html_card(q, correct, mode, source_version), encoding="utf-8", newline="\n")
                for file in (page, png):
                    data = file.read_bytes()
                    total_bytes += len(data)
                    files.append({"path": file.relative_to(output).as_posix(), "bytes": len(data), "sha256": sha256(data)})
    catalog = catalog_data(quotes, source_version)
    if not samples_only:
        write_catalog(output, catalog)
        files.sort(key=lambda row: row["path"])
        build_receipt = {"version": VERSION, "sourceVersion": source_version, "cardCount": len(quotes) * 14, "fileCount": len(files),
                         "totalCardBytes": total_bytes, "fontSha256": font_pins["font"]["sha256"], "allTextBoxesComplete": all(row["complete"] for row in painter.bounds), "files": files}
        (target / "build-manifest.json").write_text(json.dumps(build_receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return {"version": VERSION, "sourceVersion": source_version, "quoteCount": len(chosen), "cardCount": len(files) // 2,
            "fileCount": len(files), "totalCardBytes": total_bytes, "allTextBoxesComplete": all(row["complete"] for row in painter.bounds),
            "excludedQuoteIds": excluded_quote_ids(pins), "removedExcludedFiles": len(removed), "preservedExistingPngs": preserved_pngs,
            "maxContextLines": max(row["lines"] for row in painter.bounds if row["label"] == "full-front-context")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, required=True, help="Static public source directory")
    parser.add_argument("--font", type=Path, help="Pinned Noto Sans CJK TC Bold OTF; required for raster cards")
    parser.add_argument("--source", type=Path, help="Defaults to SITE_DIR/data/quotes.json")
    parser.add_argument("--output", type=Path, help="Public output root; defaults to SITE_DIR")
    parser.add_argument("--samples-only", action="store_true", help="Write the first quote's two 67-point samples only, with no catalog")
    parser.add_argument("--catalog-only", action="store_true", help="Write the pinned public catalog without requiring a font")
    args = parser.parse_args()
    if args.catalog_only:
        pins = load_json(HERE / "quiz-share-source-v18.json")
        quotes, source_version = load_source(args.source or args.site_dir / "data/quotes.json", pins)
        removed = remove_excluded_cards(args.output or args.site_dir, pins)
        write_catalog(args.output or args.site_dir, catalog_data(quotes, source_version))
        result = {"version": VERSION, "sourceVersion": source_version, "quoteCount": len(quotes), "cards": len(quotes) * len(OUTCOMES) * len(MODES), "catalogOnly": True,
                  "excludedQuoteIds": excluded_quote_ids(pins), "removedExcludedFiles": len(removed)}
    else:
        if not args.font:
            parser.error("--font is required unless --catalog-only is selected")
        result = build(args.site_dir, args.source or args.site_dir / "data/quotes.json", args.font, args.output or args.site_dir, samples_only=args.samples_only)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
