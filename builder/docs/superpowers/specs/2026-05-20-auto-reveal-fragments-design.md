# Auto-advancing fragment reveal

## Problem

Fragments (`{.fragment}` markers) reveal one element per ArrowRight keypress.
For some slides a speaker wants the reveals to play on a timer instead of
pressing a key for each one — a hands-off, rhythmic build of a list or set of
points while the speaker talks.

This spec adds a per-slide opt-in that auto-advances fragment reveals on a
configurable delay.

## Authoring syntax

A slide opts in through its attribute block (the first non-blank line of the
slide). The block already carries layout classes like `{.section .center}`;
pandoc attribute syntax also permits `key=value` pairs, so this feature reuses
that block:

```
{.auto-reveal delay=800}
{.auto-reveal start=immediate delay=1200}
{.section .auto-reveal delay=600}
```

- `.auto-reveal` — class that enables the feature on that slide.
- `delay=<ms>` — milliseconds between successive reveals. Optional; default
  `1000`. Must be a positive integer; an invalid or non-positive value falls
  back to the default.
- `start=immediate` — begin the timed sequence as soon as the slide is
  entered. Optional; when omitted the sequence waits for the speaker's first
  manual reveal (`start=cue`, the default).

`.auto-reveal` composes freely with layout classes. A slide with no
`{.fragment}` elements but with `.auto-reveal` is harmless — there is simply
nothing to reveal.

## Behavior

The feature drives the existing fragment mechanism: it reveals `.fragment`
elements in DOM order by adding `is-revealed`, exactly as a keypress does. No
new reveal styling is needed.

### Start modes

- **`start=immediate`** — on entering the slide (forward or jump navigation),
  a timer is scheduled; the first fragment reveals after `delay` ms, then each
  subsequent fragment every `delay` ms.
- **`start=cue`** (default) — entering the slide schedules nothing. The
  speaker's first forward keypress reveals fragment 1 normally; that reveal
  then starts the timer, and fragment 2 onward reveal automatically every
  `delay` ms.

### End behavior

When the last fragment on the slide has been revealed the sequence stops. The
deck does **not** auto-advance to the next slide — the speaker moves on
manually with ArrowRight, matching the existing rule that fragments never
advance the deck.

### Manual override

Any forward or backward navigation key (ArrowRight/Left, PageUp/Down, Space,
`n`, `p`) pressed while the timer is running cancels the timer and hands back
normal manual fragment stepping for the rest of the slide. The cancelling
keypress still performs its normal action (a forward press reveals the next
fragment, a backward press hides the last one). Once cancelled, the auto
sequence does not restart on that slide visit.

Leaving the slide always clears any pending timer.

### Backward navigation

Entering an `.auto-reveal` slide backward (ArrowLeft from the next slide)
reveals all fragments immediately, as today. No timer is started in this case.

### Per-slide state machine

A single module-level timer handle and a state value track the sequence:

- `armed` — `start=cue` slide entered forward/jump; waiting for the first
  manual reveal.
- `running` — timer is pending or actively revealing.
- `cancelled` — manual key pressed during `running`; manual stepping resumes.
- `done` — last fragment revealed; sequence complete.

Transitions:

| Event | From | To | Action |
|---|---|---|---|
| `slide:enter` forward/jump, `start=immediate` | — | `running` | schedule first reveal after `delay` |
| `slide:enter` forward/jump, `start=cue` | — | `armed` | none |
| `slide:enter` backward | — | (none) | reveal all fragments; no timer |
| `slide:enter` (any) | any | reset | clear pending timer first |
| forward key reveals a fragment | `armed` | `running` | schedule next reveal after `delay` |
| timer fires, fragments remain | `running` | `running` | reveal next; reschedule |
| timer fires, none remain | `running` | `done` | stop |
| any nav key | `running` | `cancelled` | clear timer; key performs its normal action |

## Implementation

### Build side — `bin/build.js`

- **`ATTR_RE` / `parseAttrs`** — widen the attribute-block grammar to accept a
  mix of `.class` and `key=value` tokens (unquoted values, no whitespace).
  `parseAttrs` returns a new third field `attrs` — a `{ key: value }` object —
  alongside the unchanged `classes` and `body`. Existing callers that
  destructure only `classes`/`body` are unaffected.
- **`renderSlide`** — when `classes` includes `auto-reveal`, emit two data
  attributes on the `<section>`:
  - `data-autoreveal-delay` — `attrs.delay` parsed as a positive integer, or
    `1000`.
  - `data-autoreveal-start` — `attrs.start` if it is `immediate`, else `cue`.

  Slides without the `auto-reveal` class emit neither attribute and are byte-
  for-byte unchanged.

### Runtime side — `script/fragments.js`

- Read `data-autoreveal-*` from the active slide on `slide:enter`.
- Add the timer handle, state value, a `scheduleNext()` helper that reveals
  the next fragment via the existing `stepFragments(1)` and reschedules, and a
  `cancelAuto()` helper that clears the timer.
- Wire the state transitions above into the existing `onSlideEnter` and
  `onKeyCapture` handlers. The capture-phase keydown listener already runs
  before `deck.js`; the auto-reveal logic adds cancellation on top of the
  current behavior without changing keypress consumption.

No new CSS — reuses `.fragment` / `.is-revealed`.

## Testing

- `test/build.test.js`:
  - `parseAttrs` parses `key=value` pairs into `attrs` alongside `.class`
    tokens; a classes-only block still yields an empty `attrs`.
  - `renderSlide` emits `data-autoreveal-delay` / `data-autoreveal-start` for
    an `.auto-reveal` slide, applies the `1000` / `cue` defaults, and clamps an
    invalid `delay`.
  - A slide without `.auto-reveal` emits neither data attribute.
- `script/fragments.js` is browser runtime with no existing unit coverage; the
  timed-reveal behavior is verified manually in a built deck, consistent with
  the current setup.

## Docs

- Update the README "Fragments (incremental reveals)" section with the
  `.auto-reveal` syntax, parameters, and behavior.
- Add an `.auto-reveal` slide to `talks/2026-05-example/` so the canonical
  reference deck exercises the feature.

## Out of scope

- Auto-advancing the deck to the next slide after the last fragment.
- Resuming the auto sequence after a manual cancel.
- Per-fragment delay overrides.
