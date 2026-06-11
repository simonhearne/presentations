# Simon Hearne — Talks

Slides from talks and workshops, published at **[talks.simonhearne.com](https://talks.simonhearne.com)**.

This repo holds two generations of decks side by side:

- **Legacy decks** — self-contained [reveal.js](https://revealjs.com) presentations (2018–2022), each in its own top-level directory.
- **New decks** — Markdown sources under [`builder/talks/`](builder/talks/), compiled to self-contained HTML by a small, dependency-light build system.

The live site is assembled from both: new decks are rehosted with generated OpenGraph thumbnails, legacy decks are linked out in place.

## The site

[`builder/bin/site.js`](builder/bin/site.js) reads [`builder/decks.json`](builder/decks.json) and produces `builder/_site/`:

- For each `source: "build"` deck it runs the Markdown build, rewrites asset paths to root-absolute, injects OpenGraph + Twitter meta, and screenshots the title slide with headless Chromium (Playwright) for the `og:image` and landing-page thumbnail.
- For each `source: "legacy"` deck it adds a link-out card (no rehosting, no screenshot).
- Shared `css/`, `img/`, and `script/` are copied once, and a landing page is rendered listing every deck.

Deploy is handled by Netlify ([`netlify.toml`](netlify.toml)):

```toml
[build]
  base = "builder"
  command = "npm ci && npx playwright install chromium && node bin/site.js"
  publish = "_site"
```

## Talks

| Talk | Year | Format |
| --- | --- | --- |
| [Vector Search, Visualised](https://talks.simonhearne.com/vector-search-visualised) | 2026 | Markdown build |
| Optimising Core Web Vitals on SPAs | 2022 | reveal.js |
| An Inclusive Web is Fast by Default | 2021 | reveal.js |
| The Psychology of Speed | 2020 | reveal.js |
| Third-party content: a deep dive | 2019 | reveal.js |
| Five Surprising Techniques to Improve Online Engagement | 2019 | reveal.js |
| The state of third-party tag performance | 2019 | reveal.js |
| Maximise Digital Revenue | 2019 | reveal.js |
| Web Performance Workshop | 2019 | reveal.js |
| The Future of Web Performance | 2018 | reveal.js |
| Weak Links | 2018 | reveal.js |

The canonical list lives in [`builder/decks.json`](builder/decks.json).

## Repository layout

```
.
├── builder/                  # Markdown-to-HTML build system + site assembler
│   ├── talks/<slug>/slides.md  # new deck sources
│   ├── decks.json            # site manifest (build + legacy decks)
│   ├── bin/                  # build.js · bundle.js · site.js
│   ├── script/ css/ img/     # shared deck runtime + brand assets
│   └── README.md             # full authoring guide
├── netlify.toml              # deploy config (base = builder)
├── index.html                # root redirect → simonhearne.com/talks/
│
├── cwv-spa/ inclusive-design/ psych-speed/ …   # legacy reveal.js decks
├── css/ js/ lib/ plugin/     # shared reveal.js runtime for legacy decks
└── weaklinks.html            # standalone legacy deck
```

## Building new decks

Authoring lives in [`builder/`](builder/) — see [`builder/README.md`](builder/README.md) for the full layout-class reference and frontmatter formats (authors, Vega charts, Graphviz `dot`, three.js).

```bash
cd builder
npm install

npm run build talks/<slug>     # slides.md → dist/index.html
npm run bundle talks/<slug>     # → dist/bundle.html (fully self-contained)
npm run site                    # build all decks + assemble _site/ (the live site)
npm test                        # node:test unit + integration tests
```

Requires Node 22 (see [`builder/.nvmrc`](builder/.nvmrc)). The `site` step needs Chromium (`npx playwright install chromium`) for OG screenshots.

To add a deck: create `builder/talks/<slug>/slides.md`, then add an entry to `builder/decks.json` (`source: "build"` for a hosted Markdown deck, `source: "legacy"` for a link-out).
