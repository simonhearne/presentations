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
   (different gap, an extra label style). Add a small rule to the deck's block
   in `css/layouts.css` (see "Deck-specific styles" below) that *extends* the
   shared component; don't fork its chrome.
4. **New shared component** — only when two or more decks need it, or it is
   clearly deck-agnostic. Build it from the tokens, document it here, and add
   it above the `custom per-deck styles` marker in `css/layouts.css`.

## Shared components

Defined in `css/layouts.css` under "Shared components".

| Component | Classes | Notes |
|---|---|---|
| Card | `.card` | White panel: brand border, `--zilliz-radius-card`, `--zilliz-shadow-card`, flex column. `.is-win` lifts one card as the answer. |
| Card grid | `.card-grid`, `.cols-2`, `.cols-4` | 3-up by default. Add `.fragment` to cards for reveals. |
| Pill | `.pill` + `.navy` / `.gradient` / `.berry` / `.ghost` | Mono uppercase tag, equal `min-width` so pill columns align. `.ghost` is a bare label (no fill). |
| Stat grid | `.stat-grid`, `.stat-card` (+`.is-warn`), `.stat-label`, `.stat-value`, `.stat-note` | 3-up metric tiles. |
| Version eyebrow | `[3.0]{.eyebrow-new}`, `[2.5]{.eyebrow-ver}` | Inline, em-sized: scales with heading/cell/bullet context. `-new` gradient, `-ver` muted grey. |
| Highlight | `mark` (plain markdown) | Brand-tinted emphasis. |
| Big code | `.big-code` on the slide | Enlarges code blocks on sparse slides. |

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
print as a flat fill (white on the dark layouts, purple elsewhere), and the
animated ones hold still under `prefers-reduced-motion`.

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
  configs, which can't read CSS variables.
- **Delete, don't comment out.** Superseded rules live in git history, not in
  the file.
- **A class that undoes its base is the wrong base.** If a `.pill` needs to
  strip its own background and padding, it wanted to be a label; add a modifier
  (`.ghost`) or a different class, not per-use overrides.

## Deck-specific styles

Truly bespoke styles (a one-slide diagram, a demo mock-up) go at the bottom of
`css/layouts.css` under the `custom per-deck styles` marker, in a block headed
by a banner comment naming the owning deck:

```css
/* ── Deck: talks/<slug> ── */
```

Rules for that block:

- Build on the shared components; the block should mostly be typography and
  arrangement, not re-declared chrome.
- Prefix class names with the concept, not the deck (`.arch-`, `.tl-`), and
  keep them out of other decks — if a second deck wants one, promote it to a
  shared component instead of importing the coupling.
- When the deck retires or a slide is cut, delete its rules. Check consumers
  first:

  ```bash
  grep -rl --include=slides.md '<class>' talks/
  ```

## Orphan audit

To find shared classes no `slides.md` references (candidates for deletion —
beware classes added by scripts, e.g. `iframe-live`, `is-revealed`, or the
`search-demo` result classes toggled at runtime):

```bash
for c in $(grep -ho '^\.[a-z][a-z0-9-]*' css/layouts.css | sort -u | tr -d '.'); do
  grep -rlq --include=slides.md "$c" talks/ || echo "$c"
done
```

Run it before and after touching `css/layouts.css`; a diff of its output is
the orphan you just created.
