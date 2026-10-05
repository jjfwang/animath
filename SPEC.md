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
- `arrow`: `{id, kind:"arrow", x1, y1, x2, y2, stroke?, width?, dash?}` —
  line with a head; `dash` applies to the shaft only (the head stays solid).
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
