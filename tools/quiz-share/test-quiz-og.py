#!/usr/bin/env python3
"""Focused OG contract tests; --site-dir additionally verifies every generated card."""
import argparse
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

HERE = Path(__file__).resolve().parent
TEST_TEMP_ROOT = None


def temp_directory():
    return tempfile.TemporaryDirectory(prefix="quiz-og-test-", dir=TEST_TEMP_ROOT)


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


G = module("quiz_og_builder", "build-quiz-og.py")
A = module("quiz_pages_assembler", "assemble-pages.py")


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.metas, self.body, self.canonical, self.scripts = {}, {}, "", []
        self.links, self.text = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            self.metas[attrs.get("property") or attrs.get("name")] = attrs.get("content")
        elif tag == "body":
            self.body = attrs
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs["href"]
        elif tag == "script":
            self.scripts.append(attrs.get("src"))
        elif tag == "a":
            self.links.append(attrs)

    def handle_data(self, text):
        self.text.append(text)


def fixture_quote():
    return G.public_quote({"id": "test-quote", "eventId": "event-1", "quote": '<script>alert("x")</script>',
                           "date": "2018（原片上架：2018-11-26）", "medium": "written", "sourceType": "本人書面原文；條件與上下文保留",
                           "frontContext": "這是條件句，不能拿掉前提。", "context": "完整上下文與限制保留在落地頁。", "url": "https://example.org/source?a=1&b=2"})


class ContractTests(unittest.TestCase):
    def test_score_rounding_matches_six_question_game(self):
        self.assertEqual([G.score_of(i) for i in range(7)], [0, 17, 33, 50, 67, 83, 100])

    def test_outcome_rejects_invalid_or_bool_scores(self):
        for score, mode in ((-1, "score"), (7, "quote"), (True, "score"), (1, "unknown")):
            with self.assertRaises(ValueError):
                G.stem(fixture_quote(), score, mode)

    def test_public_quote_drops_private_workflow_fields(self):
        raw = {**fixture_quote(), "url": "https://example.org", "localDateEvidence": "research/private", "contact": "private", "moderatorNote": "private"}
        q = G.public_quote(raw)
        self.assertNotIn("localDateEvidence", q)
        self.assertNotIn("contact", q)
        self.assertNotIn("moderatorNote", q)

    def test_links_reject_active_schemes_credentials_and_controls(self):
        for value in ("javascript:alert(1)", "data:text/html,x", "https://u:p@example.org", "https://example.org/\nsecret"):
            self.assertEqual(G.safe_url(value), "")

    def test_initial_html_has_real_og_and_escaped_quote(self):
        q = fixture_quote()
        source = G.html_card(q, 4, "quote", "a" * 64)
        parsed = Page()
        parsed.feed(source)
        self.assertNotIn('<script>alert("x")</script>', source)
        self.assertIn(q["quote"], "".join(parsed.text))
        self.assertEqual(parsed.metas["og:url"], parsed.canonical)
        self.assertTrue(parsed.metas["og:image"].endswith("test-quote-4-6-quote.png"))
        self.assertEqual(parsed.metas["og:image:width"], "1200")
        self.assertIn(q["date"], "".join(parsed.text))
        self.assertIn(q["sourceType"], "".join(parsed.text))
        self.assertEqual(parsed.body["data-source-version"], "a" * 64)
        self.assertEqual(parsed.scripts, ["/game/quiz-share-core.js?v=28", "/game/quiz-share-landing.js?v=18"])
        self.assertIn(G.SELF_REPORTED, "".join(parsed.text))
        self.assertTrue(any(link.get("id") == "quiz-share-challenge" for link in parsed.links))

    def test_all_cards_have_distinct_immutable_identity(self):
        q = fixture_quote()
        urls = set()
        for correct in range(7):
            for mode in G.MODES:
                page = Page()
                page.feed(G.html_card(q, correct, mode, "a" * 64))
                urls.add(page.canonical)
        self.assertEqual(len(urls), 14)

    def test_source_hash_change_rejects_before_generation(self):
        with temp_directory() as temp:
            source = Path(temp) / "quotes.json"
            source.write_bytes(b'{"quotes": []}\n')
            with self.assertRaises(ValueError):
                G.load_source(source, {"sourceVersion": "0" * 64, "quoteIds": []})

    def test_curated_membership_preserves_source_bytes_and_overrides_old_archive_flags(self):
        with temp_directory() as temp:
            path = Path(temp) / "quotes.json"
            raw_quotes = [{**fixture_quote(), "id": f"quote-{i}", "url": "https://example.org/source", "quizEligible": i != 1}
                          for i in range(4)]
            raw = (json.dumps({"quotes": raw_quotes}, ensure_ascii=False) + "\n").encode("utf-8")
            path.write_bytes(raw)
            pins = {"version": G.VERSION, "subjectId": "shen-pao-yang", "sourceVersion": hashlib.sha256(raw).hexdigest(),
                    "sourceQuoteCount": 4, "sourceQuoteIds": [q["id"] for q in raw_quotes],
                    "quoteIds": ["quote-2", "quote-1"], "excludedQuoteIds": ["quote-0", "quote-3"]}
            active, source_version = G.load_source(path, pins)
            self.assertEqual([q["id"] for q in active], ["quote-2", "quote-1"])
            self.assertFalse(raw_quotes[1]["quizEligible"])
            self.assertEqual(source_version, pins["sourceVersion"])
            self.assertEqual(path.read_bytes(), raw)
            self.assertEqual(G.catalog_data(active, source_version)["cards"], 28)

    def test_excluded_card_cleanup_is_bounded_idempotent_and_leaves_legacy_untouched(self):
        with temp_directory() as temp:
            output = Path(temp)
            folder = output / G.CARD_BASE.lstrip("/")
            folder.mkdir(parents=True)
            kept = folder / "other-quote-4-6-quote.png"
            kept.write_bytes(b"unchanged-other-card")
            legacy = output / "game/quiz/cards/v18/withdrawn-quote-4-6-quote.png"
            legacy.parent.mkdir(parents=True)
            legacy.write_bytes(b"untouched-legacy-card")
            for correct in G.OUTCOMES:
                for mode in G.MODES:
                    for extension in ("html", "png"):
                        (folder / f"withdrawn-quote-{correct}-6-{mode}.{extension}").write_bytes(b"withdrawn")
            pins = {"sourceQuoteCount": 2, "sourceQuoteIds": ["withdrawn-quote", "other-quote"],
                    "quoteIds": ["other-quote"], "excludedQuoteIds": ["withdrawn-quote"]}
            removed = G.remove_excluded_cards(output, pins)
            self.assertEqual(len(removed), 28)
            self.assertEqual(list(folder.iterdir()), [kept])
            self.assertEqual(kept.read_bytes(), b"unchanged-other-card")
            self.assertEqual(legacy.read_bytes(), b"untouched-legacy-card")
            self.assertEqual(G.remove_excluded_cards(output, pins), [])

    def test_curated_identifiers_reject_unknown_duplicate_or_incomplete_exclusions(self):
        baseline = {"sourceQuoteCount": 2, "sourceQuoteIds": ["known", "other"],
                    "quoteIds": ["known"], "excludedQuoteIds": ["other"]}
        cases = [{**baseline, "quoteIds": value} for value in (["../escape"], ["unknown"], ["known", "known"], [[]], "known")]
        cases += [{**baseline, "excludedQuoteIds": value} for value in ([], ["unknown"], ["other", "other"], ["known"])]
        cases += [{**baseline, "sourceQuoteCount": True}, {**baseline, "sourceQuoteIds": ["known", "known"]}]
        for pins in cases:
            with self.assertRaises(ValueError):
                G.excluded_quote_ids(pins)

    def test_allowlist_copies_only_verified_public_payload(self):
        with temp_directory() as temp:
            root = Path(temp)
            source = root / "source"
            source.mkdir()
            (source / "index.html").write_bytes(b"<!doctype html>safe")
            (source / "private.txt").write_text("must not be copied")
            manifest = {"files": [{"path": "index.html", "bytes": 19, "sha256": hashlib.sha256(b"<!doctype html>safe").hexdigest()}]}
            (source / "release-manifest.json").write_text(json.dumps(manifest))
            result = A.assemble(source, root / "output")
            self.assertTrue(result["onlyManifestAllowlistCopied"])
            self.assertFalse((root / "output" / "private.txt").exists())
            self.assertEqual(len(list((root / "output").iterdir())), 2)

    def test_allowlist_rejects_digest_mismatch_and_traversal(self):
        for path, digest in (("index.html", "0" * 64), ("../private.html", "0" * 64), (".github/workflow.yml", "0" * 64)):
            with temp_directory() as temp:
                source = Path(temp) / "source"
                source.mkdir()
                (source / "index.html").write_bytes(b"safe")
                (source / "release-manifest.json").write_text(json.dumps({"files": [{"path": path, "bytes": 4, "sha256": digest}]}))
                with self.assertRaises(ValueError):
                    A.assemble(source, Path(temp) / "output")
                self.assertFalse((Path(temp) / "output").exists())

    def test_immutable_catalog_rejects_other_source_version(self):
        with temp_directory() as temp:
            root = Path(temp)
            G.write_catalog(root, {"version": "v18", "sourceVersion": "a" * 64})
            with self.assertRaises(ValueError):
                G.write_catalog(root, {"version": "v18", "sourceVersion": "b" * 64})


def verify_site(site: Path) -> dict:
    catalog = G.load_json(site / G.CATALOG_PATH)
    quotes, source_version = G.load_source(site / "data/quotes.json", G.load_json(HERE / "quiz-share-source-v24.json"))
    if catalog != G.catalog_data(quotes, source_version):
        raise AssertionError("Served catalog differs from exact reviewed public corpus")
    folder = site / G.CARD_BASE.lstrip("/")
    manifest = G.load_json(folder / "build-manifest.json")
    card_count = len(quotes) * len(G.OUTCOMES) * len(G.MODES)
    if manifest["cardCount"] != card_count or manifest["fileCount"] != card_count * 2 or not manifest["allTextBoxesComplete"]:
        raise AssertionError("Incomplete generated card set")
    for quote_id in G.excluded_quote_ids(G.load_json(HERE / "quiz-share-source-v24.json")):
        for correct in G.OUTCOMES:
            for mode in G.MODES:
                for extension in ("html", "png"):
                    if (folder / f"{quote_id}-{correct}-6-{mode}.{extension}").exists():
                        raise AssertionError("Withdrawn card is still present in the generated artifact")
    expected = {}
    for q in quotes:
        for correct in range(7):
            for mode in G.MODES:
                name = G.stem(q, correct, mode)
                page_path, image_path = folder / (name + ".html"), folder / (name + ".png")
                page = Page()
                page.feed(page_path.read_text(encoding="utf-8"))
                canonical = G.ORIGIN + G.CARD_BASE + name + ".html"
                if page.canonical != canonical or page.metas.get("og:url") != canonical or page.metas.get("og:image") != G.ORIGIN + G.CARD_BASE + name + ".png":
                    raise AssertionError("Initial OG identity mismatch")
                if page.body.get("data-quote-id") != q["id"] or page.body.get("data-correct") != str(correct) or page.body.get("data-source-version") != source_version:
                    raise AssertionError("Landing data contract mismatch")
                if page.scripts != ["/game/quiz-share-core.js?v=28", "/game/quiz-share-landing.js?v=18"]:
                    raise AssertionError("Landing page does not load the current withdrawal policy")
                text = "".join(page.text)
                if any(value not in text for value in (q["quote"], q["date"], q["sourceType"], q["context"], q["inferenceLimit"], G.SELF_REPORTED)):
                    raise AssertionError("Source qualifiers missing from human landing page")
                with Image.open(image_path) as picture:
                    if picture.size != (1200, 630) or picture.mode != "RGB":
                        raise AssertionError("Invalid social card dimensions or mode")
                    for key, value in {"Quote": q["quote"], "Correct": str(correct), "Total": "6", "Mode": mode, "Date": q["date"], "SourceType": q["sourceType"], "Context": q["frontContext"] or q["context"], "SourceVersion": source_version}.items():
                        if picture.info.get(key) != value:
                            raise AssertionError("Exact statement/context metadata mismatch")
                    picture.verify()
                for path in (page_path, image_path):
                    raw = path.read_bytes()
                    expected[path.relative_to(site).as_posix()] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    rows = {row["path"]: {"bytes": row["bytes"], "sha256": row["sha256"]} for row in manifest["files"]}
    if expected != rows or len(rows) != card_count * 2:
        raise AssertionError("Generated artifact manifest does not match all card bytes")
    return {"cardsVerified": card_count, "pngsVerified": card_count, "initialHtmlOgVerified": card_count, "sourceQuotesVerified": len(quotes),
            "excludedQuoteIds": G.excluded_quote_ids(G.load_json(HERE / "quiz-share-source-v24.json")),
            "allPngCrcPassed": True, "allSourceQualifiersPreserved": True, "sourceVersion": source_version}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path)
    parser.add_argument("--temp-dir", type=Path, help="Optional writable test fixture parent, useful in restricted local sandboxes")
    args = parser.parse_args()
    if args.temp_dir:
        TEST_TEMP_ROOT = args.temp_dir.resolve()
        TEST_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.site_dir:
        print(json.dumps(verify_site(args.site_dir), ensure_ascii=False))
