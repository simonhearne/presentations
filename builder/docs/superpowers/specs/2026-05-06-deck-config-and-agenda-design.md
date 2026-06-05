# Deck-level config and auto-generated agenda

**Date:** 2026-05-06
**Status:** Approved

## Goal

Add an opt-out, auto-generated agenda slide that lists each section divider as a hyperlink. Introduce a deck-level config block as the carrier for the opt-out flag, with room to grow (speaker notes, theme, custom footer, etc.).

## Authoring surface

A new fenced block at the **top of `slides.md`**, before any slide content:

````markdown
```deck
- agenda: false
```

# Title slide
…
````

- Block name: `deck`.
- Body shape: same kv-list as `authors` / `vega`, parsed via the shared `parseKvList`.
- Position: must be at the very top of the file (leading blank lines tolerated). If the first non-blank content is anything other than a ` ```deck ` fence, no deck config is recognised.
- Recognised keys (v1):
  - `agenda` — `true` (default) or `false`. Any value other than the string `false` (case-insensitive) is treated as truthy.
- Unknown keys pass through silently. Forward-compatible for future deck-level options.

A misplaced ` ```deck ` block (i.e. embedded inside a slide rather than at top of file) is **not** specially recognised — it'll render as a regular fenced code block inside that slide, which will look obviously wrong and signal the authoring mistake.

## Pipeline integration

`buildDeck` gets one new step before `splitSlides`:

```
md → extractDeckConfig(md) → { config, remaining } → splitSlides(remaining) → …
```

`extractDeckConfig(md)` returns `{ config, remaining }`:
- `config`: parsed kv object (or `{}` if no block found).
- `remaining`: the original markdown with the deck block (and any leading whitespace) stripped.

The agenda is injected after chunks are prepared (authors/vega/dot extracted, attribute classes parsed) but before titles/slugs/dot rendering happen. Sequence:

1. `splitSlides` and `prepared` build as today.
2. Find the first index `i` in `prepared` whose `classes` include `section`.
3. If `i === -1`, or `config.agenda === 'false'` (case-insensitive), skip agenda — pipeline continues unchanged.
4. Otherwise, build a list of `{ title, slug, originalIndex }` for each section slide using `extractTitle` + `slugify` on each section chunk's parsed body.
5. Synthesise an agenda chunk via `renderAgendaChunk(sections)` — returns a markdown string with the `{.agenda}` attribute block, an `# Agenda` heading, and a numbered list of links pointing to `#${originalIndex + 2}-${slug}` (every section slide shifts by one due to the inserted agenda; `+2` because slide indices are 1-based and `originalIndex` is 0-based).
6. Splice the synthetic prepared entry at position `i`. Downstream code (`titles`, `slugs`, `dotHtmls`, `renderSlide`, `total`) operates on the post-splice array unchanged.

The synthetic prepared entry has the same shape as a real one: `{ chunk, authors: [], charts: [], dotBlocks: [] }`.

## Agenda slide markup

The synthesised chunk is plain markdown so it goes through the standard `renderSlide` path — no special-case rendering. Example output for a 4-section deck:

```markdown
{.agenda}
# Agenda

1. [Indexes that don't fall over](#7-indexes-that-dont-fall-over)
2. [Hybrid search & reranking](#19-hybrid-search-reranking)
3. [Distribution & isolation](#30-distribution-isolation)
4. [Observability & alerting](#42-observability-alerting)
```

After `marked` and `renderSlide`, this becomes `<section class="slide agenda" …><h1>Agenda</h1><ol>…</ol>…</section>` with the standard chrome and footer.

The deck.js navigation already reads the leading number from the URL hash (`/^#(\d+)/`), so links of the form `#42-observability-alerting` work without any JS changes.

## CSS

New rules in `css/layouts.css` for `.slide.agenda`:

- Heading: matches existing slide heading scale, left-aligned (no oversized treatment).
- Ordered list: ~48–56px font, generous line-height (1.4–1.6), brand-blue numerals.
- Links: brand-blue, no underline, hover/focus underline, `cursor: pointer`. Visited state inherits.
- Padding/centering matches surrounding `.slide` defaults.
- No support engineered for >8 items — long agendas are an authoring smell.

Style is terse, matches the existing `layouts.css` voice. No comments unless the *why* is non-obvious.

## New / changed exports in `bin/build.js`

- `extractDeckConfig(md)` — new, exported. Returns `{ config, remaining }`.
- `parseDeckConfig(body)` — new, internal helper that wraps `parseKvList` and flattens to a single object (since the kv-list yields a list of one-key objects per `- key: value` line, we collapse them into `{ key: value, ... }` for ergonomic config access).
- `renderAgendaChunk(sections)` — new, exported. Pure function: takes `[{title, slug, slideIndex}]` and returns the markdown string for the agenda slide.
- `buildDeck` — wires the above in.

`renderSlide`, `extractFencedBlock`, `parseKvList`, and the rest of the pipeline are unchanged.

## Tests

Appended to `test/build.test.js`:

1. `extractDeckConfig`:
   - top-of-file block → `config` populated, `remaining` excludes the block.
   - block preceded by blank lines → still extracted.
   - block preceded by non-blank content (e.g., a slide heading) → not extracted; `config = {}`, `remaining = md`.
   - missing block → `config = {}`, `remaining = md`.
   - unknown keys (`notes: foo`) → present in config, no throw.

2. `renderAgendaChunk`:
   - returns markdown starting with `{.agenda}` attribute block and `# Agenda` heading.
   - emits one numbered list item per input section, link target matches `#${slideIndex}-${slug}`.

3. Integration build:
   - Fixture with title slide + 2 `.section` divider slides → one extra `<section class="slide agenda">` emitted immediately before the first section, page count is `originalCount + 1`, anchors point to the post-splice slide indices.
   - Same fixture with `agenda: false` in deck block → no agenda slide injected, page count unchanged.
   - Fixture with no `.section` slides → no agenda slide injected.
   - Fixture with `notes: foo` (unknown key) in deck block → build succeeds.

## Out of scope

- Multi-column agenda layouts.
- Sub-section / nested agenda items.
- Auto-numbered "Section 1 of 4" badges on `.section` slides themselves.
- Recap or transition slides between sections.
- Highlighting the current section when the agenda is revisited mid-deck.
- Speaker notes (will land in a follow-up using the same `deck` config block).
