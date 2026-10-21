# Static quiz sharing build, v18

This directory is published as `tools/quiz-share/` in the public source repository.
It generates real HTML Open Graph tags and 1200×630 PNGs before Pages deployment.
The browser never needs an API key or a score-submission database for this feature.

The v18 corpus is frozen to 74 existing quiz-eligible items and the exact SHA256 of
the existing `data/quotes.json`. Each item has seven six-question outcomes and two
layouts (`score`, `quote`): 1,036 HTML pages plus 1,036 PNGs. Original quotation,
human date, full front context and source-type qualification are retained. Human
landing pages also show full context, source/video links and evidence limits.
The shared score is a player claim, not a verified leaderboard entry.

## Local build

Python 3.12 and Pillow 12.3.0 are used for the reviewed build. The hash-pinned
requirements file targets the GitHub-hosted Linux x86_64 runner. If Pillow is
already available locally, no installation is needed.

```sh
python tools/quiz-share/test-quiz-og.py
python tools/quiz-share/assemble-pages.py --source . --output _site
python tools/quiz-share/fetch-og-font.py --output /tmp/quiz-og-font
python tools/quiz-share/build-quiz-og.py --site-dir _site --font /tmp/quiz-og-font/NotoSansCJKtc-Bold.otf
python tools/quiz-share/test-quiz-og.py --site-dir _site
```

`build-quiz-og.py --site-dir PUBLIC_ROOT --catalog-only` creates the exact public
catalog without a font. `--output ANOTHER_PUBLIC_ROOT` directs generated files to
a separate output tree. `--samples-only` writes the first statement's two 67-point
cards without creating a partial public catalog.

## Public contracts

- Catalog: `/data/quiz-share-catalog-v18.json`
- Static pages/images: `/game/quiz/cards/v18/<quoteId>-<correct>-6-<score|quote>.html`
  and the same basename with `.png`.
- Generated card manifest: `/game/quiz/cards/v18/build-manifest.json`
- Initial HTML has its own canonical, `og:url`, `og:image` and Twitter image tags.
- Body attributes: `data-quiz-share-landing`, `data-quote-id`, `data-correct`,
  `data-total`, `data-mode`, `data-source-version`.
- Landing hooks: `#quiz-share-challenge`, `#quiz-share-status`,
  `#quiz-share-landing-fact`. The separate frontend script validates and forwards
  a bounded same-round token. No names, contact data or answer choices are stored.

`sourceVersion` is the SHA256 of the unmodified raw source JSON, not a hash of a
reserialized object. Source changes require a reviewed new card version; do not
replace old v18 URLs with a different quotation or outcome.

## Font and deployment

`og-font-v18.json` pins Noto Sans CJK TC Bold to an official repository commit and
SHA256. `fetch-og-font.py` verifies the font and OFL license, rejects redirects,
and bounds downloads. The font stays outside the public artifact; PNGs do not
embed the font software. `OFL-NotoSansCJKtc.txt` preserves the upstream license.
No Microsoft/system font is copied or redistributed.

Copy `pages-v18.workflow.yml` to `.github/workflows/pages.yml` only when ready to
deploy the complete reviewed source. The template builds only on this repository's
`main`, copies only `release-manifest.json`'s byte-verified public allowlist, then
adds generated cards. It does not copy `.git`, tools, private research or runtime
credentials. Actions and Pillow are pinned; the deployment job has only the
normal Pages and OIDC deployment permissions. It changes no Supabase settings.

Platform preview caches and the user's share target control the final preview.
The build validates crawler-visible initial HTML and PNG bytes; it does not claim
that a post was sent to Facebook/LINE or that a platform's cache was refreshed.
