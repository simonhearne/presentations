# CSS styleguide

How to style slides without growing orphaned CSS. Written for agents and humans
editing `css/` or authoring HTML blocks in a `slides.md`.

## The ladder

Work down this list; stop at the first rung that fits. Each rung below the
first adds CSS that someone must later maintain or delete.

1. **Layout classes and markdown** — `.title`, `.section`, `.hero`, `.bg`,
   `.center`, `.dark`, `.two-col`/`.three-col` (+`.cards`), fragments,
   blockquotes, `mark`. See README.md for the full list.
2. **Shared components** (below) — compose `.card`, `.card-grid`, `.pill`,
   `.stat-grid`, `.eyebrow-new`/`.eyebrow-ver` in raw HTML. No new CSS needed.
3. **Thin deck-scoped extension** — a component almost fits but needs a tweak
   (different gap, an extra label style). Add a small rule to the deck's own
   `talks/<slug>/slides.css` (see "Deck-specific styles" below) that *extends*
   the shared component; don't fork its chrome.
4. **New shared component** — only when two or more decks need it, or it is
   clearly deck-agnostic. Build it from the tokens, document it here, and add
   it to `css/layouts.css` under "Shared components". A rule that starts in one
   deck's `slides.css` moves here the moment a second deck wants it; never
   copy it into the second deck's file.

## Shared components

Defined in `css/layouts.css` under "Shared components".

| Component | Classes | Notes |
|---|---|---|
| Card | `.card` | White panel: brand border, `--zilliz-radius-card`, `--zilliz-shadow-card`, flex column. `.is-win` lifts one card as the answer. |
| Card grid | `.card-grid`, `.cols-2`, `.cols-4`, `.cols-5`, `.tight` | 3-up by default. Add `.fragment` to cards for reveals. `.tight` halves the card padding and sets `ul.case-proof` at caption size, for a grid that shares its slide with a stat row or runs to two rows. |
| Labelled card | `.feature-cat`, `.case-name`, `.case-proof` | The three-part card body: mono uppercase eyebrow (what kind of thing this is), headline (which one), then the sentence or `<ul>` that backs it. `.case-proof strong` takes brand blue. Any part is optional. |
| Pill | `.pill` + `.navy` / `.gradient` / `.berry` / `.ghost` | Mono uppercase tag, equal `min-width` so pill columns align. `.ghost` is a bare label (no fill). |
| Stat grid | `.stat-grid` (+`.cols-2` / `.cols-4`), `.stat-card` (+`.is-warn`), `.stat-label`, `.stat-value`, `.stat-note` | 3-up metric tiles. |
| Pill strip | `.rig` of `.pill.ghost`s | The setup behind a chart or section (dataset, model, sizes) as a wrapping row of pills sized to their labels. |
| Dense table | `.dense-table` on the slide | Shrinks table type, padding and `mark`s for ten-plus rows of long cells. |
| Search demo | `.search-demo`: `.header` > `.query`, `.body` > `.section` > `.results` > `.result` | A query over ranked result lists, each with `.rank`, `.title` and a `.pill.hit` / `.miss` / `.near`. A third `.section` switches the body to three columns. |
| Big idea | `.big-idea` > `.bi-cell.give` / `.bi-cell.get` (`.bi-num`, `.bi-lab`), `.bi-arrow` | A give/get trade at statement size on its own slide. `.section-byline` is the same row under a section heading. |
| Inline SVG diagram | `<svg class="svg-diagram">` (+`.staged`) | Shared vocabulary for diagrams drawn in `slides.md`: `.node` (`.node-model` filled), `.nlabel` / `.nsub` (`-source` for white on a filled box, `.muted` aside), `.mlabel`, `.edge` (`.dashed`, `.plain` for no head), `.elabel` (mono). Each `<svg>` defines its own arrowhead marker, so a deck rule sets `marker-end` on `.edge`. `.staged` adds the stage rail (`.rail`, `.tag`/`.tlabel`) and paints the current `.stage` brand blue. Pair it with an `ol.stage-list` whose items share each stage's `data-fragment-index`. |
| Callout | `blockquote` (+`.blue` / `.bottom` / `.small`), `.label` | Stat-tile chrome (tint, `-20` border, card radius) with a mono eyebrow. Berry by default, `.blue` for the positive variant. |
| Closing line | `.closing-line` (+`.is-emphatic`) | The sentence under a diagram, grid or chart that says what it meant. Bare text, no panel. `.is-emphatic` makes it bold navy when the line is the takeaway rather than a caption. Use `blockquote` instead when it needs chrome, or `p.punchline` when the line *is* the slide. |
| Setup line | `p.setup-line` with a leading `<strong>Setup</strong>` | How the numbers on the slide were measured. Works on any layout: always pinned just above the footer rule, out of flow, wherever it sits in the markup. Keep it to one line, and leave the slide's last ~55px clear for it. |
| Pull quote | `blockquote.case-quote`, `cite` | No panel: gradient quote glyph, navy text, mono grey attribution. |
| Eyebrow | `[RAM]{.eyebrow-new}`, `[2.5]{.eyebrow-ver}` | Inline label beside the text it marks — trails a heading, rides alongside a cell or bullet. Em-sized: scales with its context, stepping down again inside an `h1`. `-new` gradient for the headline mark, `-ver` muted grey for the quiet one (release version, memory tier). `[[B1b](url)]{.eyebrow-run}` is `-ver` with the case kept, for the benchmark run behind a slide; any eyebrow can wrap a link and keeps its pill colours. |
| Metric ladder | `.metric-ladder`: `.ml-head`, then `.ml-body` > `.ml-rail` + `.ml-rungs` > `.ml-rung` | Layered table of metrics with an upward rail. Write rungs bottom-first; `column-reverse` stacks them so fragments climb. Each rung is five cells, led by `.ml-name` and `.ml-metrics` (`.pill.ghost`s). |
| Highlight | `mark` (plain markdown) | Brand-tinted emphasis. |
| Big code | `.big-code` on the slide | Enlarges code blocks on sparse slides. |
| Placeholder | `.slide.placeholder`, `.placeholder-dep` | Unfinished-slide marker: hatched border, rotated "PLACEHOLDER" tag, dimmed body. `.placeholder-dep` is an undimmed "waiting on: " line naming the blocker. |

Example — a 2-up grid of cards with pills:

```html
<div class="card-grid cols-2">
<div class="card fragment">
<p class="case-eyebrows"><span class="pill berry">before</span> <span class="pill gradient">after</span></p>
…content…
</div>
</div>
```

## Deck bookends

Openers and closers are fixed forms built from rung-1 classes only. Copy one
from a current deck; they should never need CSS.

**Opening slide** — `{.title .no-chrome}`, logo, title, subtitle, `authors`:

````markdown
{.title .no-chrome}
<img class="logo" src="../../../img/zilliz-light.svg" alt="">

# Deck title
## One-line subtitle

```authors
- name: Simon Hearne
  position: Solutions Architect
  company: Zilliz
  photo: https://avatars.githubusercontent.com/u/496189?v=4
```
````

A second `##` can carry the date or venue. `<span class="hero-text">` gives a
phrase the gradient accent on a multi-line title. On the dark layouts
(`.title`, `.hero`) add `bright` — `<span class="hero-text bright">` — for a
still aqua-to-sky fill that holds its colour against the blue-berry background;
the plain navy-to-berry fill disappears there. All the `hero-text` variants
print as a flat fill (white on the dark layouts, purple elsewhere).

**Closing slide** — two accepted forms. Pick one; don't blend them.

1. *Sign-off* — the opener's frame reused, so the deck closes on the card it
   opened with: same `{.title .no-chrome}` + logo + `authors`, with
   `# Thank you!` and the contact route as `##` lines (`## simon @ zilliz.com`,
   optionally `## Questions?`). Give the closing logo `loading="lazy"`; the
   opener's is the first paint and shouldn't defer.
2. *Statement* — `{.hero .no-chrome}` and one sentence that lands the argument
   ("Meaning is a coordinate."). No contact details, no speaker card.

Reach for the sign-off when the deck ends in live Q&A, the statement when the
final line is the takeaway and the deck reads on its own afterwards.

## Conventions

- **Scope content rules with `.slide `** so they can't leak into deck chrome.
- **States are `is-*`** (`.is-win`, `.is-warn`, `.is-now`, `.is-good`); grid
  widths are `cols-N`; pill colors are the visual name (`navy`, `gradient`,
  `berry`, `ghost`). Don't invent parallel schemes (`grid-4`, `type-2`, …).
- **No literal brand values.** Colors, spacing, radii, and shadows come from
  `css/tokens.css` (`--zilliz-*`). The only sanctioned duplicates are the hex
  literals in `bin/build.js` (`DOT_DEFAULTS`) and `script/vega.js`/`three`
  configs, which can't read CSS variables. The `--zilliz-amber*` data tokens
  mirror `BRAND.amber` in `script/vega.js`; change both together.
- **Delete, don't comment out.** Superseded rules live in git history, not in
  the file.
- **A class that undoes its base is the wrong base.** If a `.pill` needs to
  strip its own background and padding, it wanted to be a label; add a modifier
  (`.ghost`) or a different class, not per-use overrides.

## Deck-specific styles

Truly bespoke styles (a one-slide diagram, a demo mock-up) go in
`talks/<slug>/slides.css`, next to the deck's `slides.md`. The build links it
after `css/layouts.css` (and before `print.css`) whenever the file exists, so a
deck rule wins a specificity tie against a shared one. It only ever loads in its
own deck. Don't put `<style>` blocks in `slides.md`: they apply to the whole
document anyway, and they hide the deck's CSS from anyone reading the
stylesheets.

Rules for that file:

- Build on the shared components; the block should mostly be typography and
  arrangement, not re-declared chrome.
- Prefix class names with the concept, not the deck (`.arch-`, `.tl-`). If a
  second deck wants one, promote it to `css/layouts.css` as a shared component
  rather than copying it into that deck's `slides.css`.
- When a slide is cut, delete its rules from the deck's file. When the deck
  retires, its `slides.css` goes with it.

## Orphan audit

To find shared classes no `slides.md` references (candidates for deletion —
beware classes added by scripts, e.g. `iframe-live`, `is-revealed`, or the
`search-demo` result classes toggled at runtime):

```bash
for c in $(grep -ho '^\.[a-z][a-z0-9-]*' css/layouts.css talks/*/slides.css | sort -u | tr -d '.'); do
  grep -rlq --include=slides.md "$c" talks/ || echo "$c"
done
```

Run it before and after touching `css/layouts.css` or a deck's `slides.css`;
a diff of its output is the orphan you just created. Classes emitted by a
generator script count as used: `talks/vector-search-production/showcase/generate.mjs`
writes `.result-thumb.is-missing`.
