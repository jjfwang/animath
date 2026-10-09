# animath Animation Spec — v0.1

The spec is the contract between the **generator** (the LLM) and the
**player**. A spec is a JSON document describing a short animated explainer:
2–8 scenes, each with shapes that appear, move, and highlight on a timeline,
plus narration text per scene.

Authority order: this file > `README.md` > `SYLLABUS.md` > any issue >
implementation. If code and spec disagree, the code is wrong.

## Top-level document

| field     | type                              | notes                                              |
|-----------|-----------------------------------|----------------------------------------------------|
| `animath` | string                            | spec version, currently `"0.1"`                    |
| `title`   | string                            | human title, shown in the player header            |
| `level`   | `"primary"` \| `"secondary"` \| `"jc"` |                                              |
| `subject` | `"math"` \| `"science"`           |                                                    |
| `topic`   | string                            | slug from `SYLLABUS.md`                            |
| `kind`    | `"concept"` \| `"problem"`        | concept = explain an idea; problem = pose then solve |
| `canvas`  | `{width, height}`                 | pixels; `960 × 540` recommended                    |
| `scenes`  | Scene[2..8]                       | played in order                                    |

## Scene

```json
{
  "id": "s1",
  "caption": "Make the pieces the same size",
  "narration": "We can't add halves and quarters directly. Split the half into two quarters.",
  "duration_ms": 8000,
  "steps": [ ... ]
}
```

- `id`: unique within the document.
- `caption`: short on-screen heading for the scene.
- `narration`: 1–2 sentences in a spoken tone suited to the level. Shown under
  the stage; reserved for future text-to-speech.
- `duration_ms`: 4000–12000.
- `steps`: ordered by `at_ms` ascending.

## Steps

Every step has `at_ms` (0 ≤ at_ms < scene `duration_ms`) and a `do` verb.

- `show`: `{at_ms, do:"show", shape}` — fades the shape in over ~300ms.
- `hide`: `{at_ms, do:"hide", target}` — fades the shape out. `target` is a
  shape id shown earlier in the same scene.
- `move`: `{at_ms, do:"move", target, to, dur_ms}` — interpolates the shape's
  position from its current spot to `to` over `dur_ms` ms. `to` may carry
  position fields, size fields, or both: `w`/`h` for `rect`, `r` for `circle`,
  and only fields valid for the target kind (`x`/`y` for `text`/`latex`,
  `cx`/`cy` for `circle`, `x1`/`y1`/`x2`/`y2` for `line`/`arrow`). At least
  one numeric field is required. A `polygon` moves by its vertices: `to`
  carries only `points`, an array of `[x,y]` pairs with the same length as
  the shape's `points`, interpolated pointwise. Moveable kinds in v0:
  `text`, `rect`, `circle`, `line`, `arrow`, `latex`, `polygon`.
- `emphasize`: `{at_ms, do:"emphasize", target, dur_ms?}` — pulse-highlight the
  shape (scale pulse). Default `dur_ms` 900.
- `caption`: `{at_ms, do:"caption", text}` — replaces the scene caption bar
  mid-scene.

## Mechanism-first authoring

Contract validity (see "Validation") is the floor, not the bar. Every scene
shows a *mechanism*: at least one state change — a process, transformation, or
cause->effect — carried by the visuals. The state change rides on `move`, or
on staged `show`/`hide` steps that build or transform a diagram over time
(bars growing one after another, an electron travelling along a wire, a shape
morphing across consecutive beats). `emphasize` may mark a turning point but
never carries the mechanism alone. On-screen text (captions, labels,
narration) supports the visual; it never carries the explanation by itself —
a scene of text fading in line by line is contract-valid but not yet good
enough. No text-only scenes.

## Shapes

Every shape has a unique `id` within its scene.

- `explain` (optional, all kinds): a plain-text "explain me this" sentence
  for the shape. The player shows it as a tooltip when the viewer hovers
  over, taps, or keyboard-focuses the shape; shapes without `explain` stay
  inert (only shapes that carry it become hover/focus targets). Authoring
  guidance: write it for a student staring at that one part — name the
  part, state what it means in this scene, one short sentence, plain text
  (no markdown, no LaTeX). Key chart/diagram parts should carry one;
  decorative shapes and captions should not.

- `text`: `{id, kind:"text", x, y, text, size?, color?, align?}` —
  `align`: `"start"` (default) | `"middle"` | `"end"`. `size` in px, default 28.
- `latex`: `{id, kind:"latex", x, y, tex, size?, color?}` — math rendered
  with KaTeX (see "Math notation"). `tex` is required plain LaTeX;
  `size` in px, default 28.
- `rect`: `{id, kind:"rect", x, y, w, h, fill?, stroke?, strokeWidth?, rx?}`
- `circle`: `{id, kind:"circle", cx, cy, r, fill?, stroke?, strokeWidth?}`
- `line`: `{id, kind:"line", x1, y1, x2, y2, stroke?, width?, dash?}` —
  `dash` is an optional string of space-separated numbers (e.g. `"6 4"`),
  passed through to SVG `stroke-dasharray`; absent or empty means solid.
  Use for asymptotes, construction lines, hidden 3D edges, field-line
  conventions.
- `arrow`: `{id, kind:"arrow", x1, y1, x2, y2, stroke?, width?, dash?, widths?}` —
  line with a head; `dash` applies to the shaft only (the head stays solid).
  Optional `widths: [w1, w2]` makes the shaft a tapered polygon instead of a
  stroke — tail width `w1` at (x1,y1), head width `w2` at (x2,y2), interpolated
  linearly along the shaft (Sankey-style flow arrows for energy diagrams);
  both must be positive numbers. The arrowhead scales with the head width
  (`w2` when `widths` is present, else `width`). `dash` is ignored on a tapered
  shaft (stroke-dasharray cannot apply to a filled polygon). A `move` step on
  an arrow may carry `widths` (an array of two positive numbers) to animate
  the taper widening or narrowing; if the shown shape declared no `widths`,
  the taper snaps in at the end of the move.
- `polygon`: `{id, kind:"polygon", points:[[x,y],...], fill?, stroke?, strokeWidth?}`
- `sector`: `{id, kind:"sector", cx, cy, r, startAngle, endAngle, fill?, stroke?, strokeWidth?}` —
  pie slice / angle arc / mensuration sector. Angles in degrees: `0` is east,
  positive is clockwise (canvas y-down). `r` must be positive. Not moveable in v0.

Coordinates are canvas pixels, origin top-left. Colors are CSS hex strings
(`"#1a1a1a"`). Sensible defaults: 2px `#1a1a1a` strokes, transparent fills.

## Math notation (v0.1)

Two kinds of on-screen math:

- `latex` shapes — rendered with KaTeX when the player page loads it
  (`player/demo.html` pins a CDN copy), with a plain-text fallback
  otherwise. Use `latex` where unicode breaks down: fractions, stacked
  notation, algebra (`tex: "a^2 + b^2 = c^2"`). `size` in px (default 28);
  `color` a CSS hex string.
- `text` shapes stay **unicode-only**: `½ ¼ ¾ × ÷ − → √ π θ ° ² ³ ≤ ≥ ≠ ± ≈ ∠ △`.
  The validator still rejects backslash sequences like `\frac` inside
  `text` — those belong in `tex`, never in `text`.

## Validation

`player/validate.js` is the reference validator. `node --test "tests/*.test.js"`
runs it over every file in `samples/` plus negative cases.
It also ships a Node CLI — `node player/validate.js <spec.json>` — guarded by
`require.main === module`, so requiring it as a module or loading it in a
browser never runs the CLI. Exit codes: 0 = valid spec (names the file on
stdout); 2 = validation errors (one finding per line on stdout); 1 = bad
arguments, unreadable file, or invalid JSON (errors and usage on stderr).

## Export

`player/export-frames.js` defines the DOM-free deterministic per-frame SVG
contract (issue #506):

- `shapeMarkup` mirrors `drawShape`'s attribute decisions and geometry — the
  same defaults (fill `none`, stroke `#1a1a1a`, stroke-width 2, text-anchor
  `start`), the same geometry helpers — by reusing the player's exported pure
  helpers, so the contract cannot drift from the renderer.
- `sceneShapes` replays the scene timeline with the player's instant semantics
  (`renderSceneAt(i, ms, instant=true)`), except move steps interpolate at
  p = (ms - at_ms) / (dur_ms || 800) so mid-tween frames match the live tween
  position. Fades are flattened — a frame either contains a shape or it does
  not; emphasize is a geometric no-op; caption targets the HTML chrome and is
  ignored.
- `renderFrame` returns a standalone byte-deterministic `<svg>` (byte-identical
  across runs and processes); `frameMs` / `sceneFrameCount` define the
  frame-index contract. Text content is XML-escaped; latex shapes render
  through the no-KaTeX fallback (`latexFallbackText`), exactly like the player
  without KaTeX loaded.

`player/export-record.js` is the browser recording harness consuming that
contract:

- It rasterizes each frame's SVG string to an offscreen canvas at a fixed fps
  (default 30) and feeds `canvas.captureStream()` into MediaRecorder, producing
  a WebM blob.
- Wall-clock pacing: frames are drawn on a timer at 1000/fps ms and the stream
  is captured at the same fps, so playback runs at the export fps in real time —
  a 12s scene takes ~12s to record; it is a recorder, not a fast renderer.
- Pure DOM-free helpers: `buildFramePlan`; `defaultExportName`
  (`<slug>-YYYYMMDD-HHmmss.webm`, injectable timestamp so repeats never
  overwrite each other); `preferredMimeTypes` (vp9, then vp8, then plain webm;
  fail-closed — `pickMimeType` returns `''` when nothing is supported);
  `supportCheck` with human-readable reasons.
- `recordSpec` reads every browser capability through an injectable `env`
  (`{ document, Image, MediaRecorder, Blob }`) — never bare globals — so the
  whole pipeline runs in Node under test with fakes.

`player/export-ui.js` wires the harness to a demo page:

- One `attachExportUI(document, window, AnimathExportRecord,
  { getSpec, getSlug })` call: a native Export button plus a short status line
  (idle / recording progress / done with the file name / error reason);
  `player/demo.html` mounts it as `#exportbtn` + `#exportstatus` in the demo
  bar.
- Reduced-motion is respected: the full scene sequence always records at normal
  pace, never time-compressed.
- The button is a native `<button>` (keyboard-accessible by default); when
  MediaRecorder is absent it is disabled with the reason as its title and
  status ("Export unavailable: <reason>").

Honest limitation: the MediaRecorder wiring itself cannot run on this VM's Node
build; the testable contract is everything around it. Parent issue #506 stays
open for end-to-end browser-download acceptance.
