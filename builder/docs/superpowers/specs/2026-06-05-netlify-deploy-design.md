# Deploy presentations via Netlify at `talks.simonhearne.com`

**Date:** 2026-06-05
**Status:** Approved

## Goal

Give every committed deck a public URL. Add the `zilliz-presentations` builder
plus its new decks into the existing personal repo
`git@github.com:simonhearne/presentations.git` (14 frozen legacy reveal.js
decks), and deploy the **new decks + a generated landing page** via Netlify at
the custom subdomain `talks.simonhearne.com`. Legacy decks stay exactly where
they are and keep being served as they are today.

## Existing-setup facts (verified by inspecting both repos)

- The legacy `simonhearne/presentations` repo is **already published via GitHub
  Pages** at `simonhearne.github.io/presentations/`, served **from the repo
  root** (`<deck>/index.html` + shared `css/ js/ lib/ plugin/ backgrounds/`).
- The `simonhearne.com.11ty` site proxies it: `netlify.toml` rewrites
  `/presentations/*` → `https://simonhearne.github.io/presentations/:splat`
  (`status = 200`, `force = true`). So `simonhearne.com/presentations/<deck>/`
  is the canonical legacy URL.
- The 11ty `/talks/` page (`talks.njk`) is **not** a hand-maintained deck index.
  It renders `collections.talks` — blog posts tagged `talk`. Each such post
  (e.g. `posts/2020-10-15-psychology-of-speed.md`) embeds a video and a
  "View Slides" button linking to `simonhearne.com/presentations/<deck>/#/`.
- Each new deck's `bundle.html` is fully self-contained (CSS/JS/images inlined,
  1.7–2.5 MB). The plain `index.html` instead references shared `../../../css/`.
  Publishing the **bundle** avoids any shared-asset collision.

## Decisions (locked)

- **Home repo:** add the builder + new decks into `simonhearne/presentations`.
  `zilliz-presentations` is kept as an archive.
- **Public URL:** `talks.simonhearne.com` (Netlify custom subdomain).
- **Landing page:** a generated index at the Netlify site root listing all decks.
- **Git history:** clean copy — the builder lands as a single new commit.
- **Decks published from this repo:** real decks only —
  `vector-search-visualised`, `vectordb-101`, `vectordb-201`, `vectordb-301`,
  `vectordb-301-rabitq`. `example/` and `threejs-example/` are omitted.
- **Legacy `/presentations/*` proxy:** **left as-is.** GitHub Pages keeps serving
  legacy decks; the 11ty repo is not touched. Legacy decks are therefore
  intentionally published in two places (GitHub Pages + linked from the landing).
- **Legacy decks on Netlify:** **not re-hosted.** The landing page's legacy
  entries link out to `simonhearne.com/presentations/<deck>/`. `site.js` does no
  legacy copying.

## Combined repo layout

Because GitHub Pages serves the legacy repo **from its root**, legacy content
must stay at root untouched (moving it would 404 every existing
`/presentations/<deck>/` link). The builder therefore nests in a subdirectory —
this also avoids the `css/` name collision between the legacy reveal theme and
the builder's own `css/`.

```
presentations/                    # GitHub Pages serves this root, UNCHANGED
├── psych-speed/ ad-block-perf/ … # 14 legacy decks, at root, untouched
├── css/ js/ lib/ plugin/ …       # legacy shared assets, untouched
├── index.html                    # legacy redirect, untouched
├── builder/                      # ← all of zilliz-presentations lands here
│   ├── bin/ css/ script/ talks/ test/ templates/ visualisations/ img/
│   ├── bin/site.js               # NEW — assembles the publishable site
│   ├── decks.json                # NEW — manifest: what to publish + titles + legacy links
│   ├── .nvmrc                    # NEW — pins Node for Netlify
│   ├── package.json README.md CLAUDE.md
│   └── _site/                    # build output (gitignored) = Netlify publish dir
└── netlify.toml                  # NEW — at repo root; base = "builder"
```

GitHub Pages (serves root statically) and Netlify (runs the builder) deploy
independently from the same repo and do not interfere.

## Component: `bin/site.js` (site assembly)

One command, run by Netlify, that produces `builder/_site/`:

1. **New decks** (`source: "build"`): run the existing build + bundle for the
   slug, copy `talks/<slug>/dist/bundle.html` → `_site/<slug>/index.html`.
2. **Landing page:** generate `_site/index.html` from `decks.json`. Built decks
   link to `/<slug>/`; legacy decks link to their `url`.
3. **Landing assets:** copy `css/tokens.css` → `_site/assets/tokens.css`.

No legacy decks are copied (they are link-outs).

Design constraints:
- House style: plain `function` declarations, pure helpers separated from a thin
  filesystem I/O wrapper, helper functions above the orchestrator, ESM, no
  classes, comments only where the *why* is non-obvious.
- Reuse `escapeHtml` from `bin/build.js` (export it if not already) for any
  user-supplied string rendered into the landing page.
- Fail loudly: a `build` deck missing `slides.md`, or a malformed manifest entry,
  aborts with a clear error.

## Component: `decks.json` (manifest)

Single source of truth for what is published, in what order, with what titles.

```json
{
  "site": { "title": "Simon Hearne — Talks", "tagline": "..." },
  "decks": [
    { "slug": "vector-search-visualised", "source": "build", "title": "Vector Search, Visualised", "date": "2026-06" },
    { "slug": "vectordb-101", "source": "build", "title": "VectorDB 101" },
    { "slug": "vectordb-201", "source": "build", "title": "VectorDB 201" },
    { "slug": "vectordb-301", "source": "build", "title": "VectorDB 301" },
    { "slug": "vectordb-301-rabitq", "source": "build", "title": "VectorDB 301 — RaBitQ" },

    { "slug": "psych-speed", "source": "legacy", "title": "The Psychology of Speed",
      "url": "https://simonhearne.com/presentations/psych-speed/", "date": "2020" }
    /* …remaining 13 legacy decks, each with its /presentations/<slug>/ url… */
  ]
}
```

Validation: each deck needs `slug`, `source` (`build`|`legacy`), `title`.
`source: "legacy"` needs `url` (defaulted to
`https://simonhearne.com/presentations/<slug>/` if omitted). `date` is optional.
Unknown `source` is an error.

## Component: landing page

- Generated `_site/index.html`, brand-styled. Links `css/tokens.css` (copied to
  `_site/assets/tokens.css`) and carries a small inline `<style>` for a grid of
  deck cards.
- Groups **Recent** (built decks) above **Archive** (legacy), in manifest order.
- Built decks → `/<slug>/`; legacy decks → their `url`.

## Netlify + DNS

```toml
# netlify.toml — at the COMBINED repo root (created during migration, not inside builder/)
[build]
  base = "builder"
  command = "npm ci && node bin/site.js"
  publish = "_site"          # relative to base → builder/_site
```

- `builder/.nvmrc` pins the Node version (read from the base dir).
- Custom domain `talks.simonhearne.com` configured in the Netlify UI.
- DNS: a `CNAME` record `talks` → `<site>.netlify.app` (manual — outside code).
- HTTPS provisioned automatically by Netlify.
- `_site/` added to the builder's `.gitignore`.

`netlify.toml` lives at the combined-repo root (Netlify reads root config to find
`base`), so it is created during migration rather than carried inside the builder.

## Migration (one-time, against a clone of the legacy repo)

1. Copy the builder (this repo) into `builder/` in the legacy repo. Legacy
   content at root is left untouched.
2. Add `builder/bin/site.js`, `builder/decks.json`, `builder/.nvmrc`; gitignore
   `builder/_site/`.
3. Add `netlify.toml` at the repo root (`base = "builder"`).
4. Verify `cd builder && node bin/site.js` produces a correct `_site/` locally.
5. Confirm GitHub Pages source (branch/folder) is unchanged and legacy decks
   still resolve at `simonhearne.github.io/presentations/<deck>/`.
6. Commit as a single commit; push.
7. Connect the repo in Netlify (base `builder`); set the custom domain; add the
   DNS record.

## Testing & docs

- Develop `site.js`, `decks.json` **in this repo first** (it has the `node:test`
  harness), so they travel into `builder/` already tested. `netlify.toml` is
  combined-repo config and is added during migration.
- `test/site.test.js` (append to existing patterns, temp-dir fixtures via
  `mkdtempSync` + try/finally):
  - manifest validation (missing field, bad `source`, legacy `url` defaulting),
  - `_site/` structure for a `build` deck,
  - landing page contains a link per deck (built → `/<slug>/`, legacy → `url`),
  - `tokens.css` copied to `_site/assets/`.
- Update `README.md` (deployment section) and `CLAUDE.md` (new pipeline +
  `decks.json` convention).

## Out of scope (no changes needed)

- The `simonhearne.com.11ty` repo: untouched. The `/presentations/*` proxy and
  the `/talks/` posts page stay as they are.
- GitHub Pages publishing of the legacy repo: untouched.

## Risk noted & accepted

- Places Zilliz-branded decks (`vectordb-*`) into the personal
  `simonhearne/presentations` repo and the `talks.simonhearne.com` domain.
  Confirmed intentional by the user.
- Legacy decks are published in two places (GitHub Pages + landing link-out).
  Accepted: keeps existing links working with zero changes to other repos.
