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
  position from its current spot to `to` over `dur_ms` ms. `to` carries the
  same position fields the shape kind uses (`x`/`y`, `cx`/`cy`,
  `x1`/`y1`/`x2`/`y2`). Not supported for `polygon` in v0.
- `emphasize`: `{at_ms, do:"emphasize", target, dur_ms?}` — pulse-highlight the
  shape (scale pulse). Default `dur_ms` 900.
- `caption`: `{at_ms, do:"caption", text}` — replaces the scene caption bar
  mid-scene.

## Shapes

Every shape has a unique `id` within its scene.

- `text`: `{id, kind:"text", x, y, text, size?, color?, align?}` —
  `align`: `"start"` (default) | `"middle"` | `"end"`. `size` in px, default 28.
- `rect`: `{id, kind:"rect", x, y, w, h, fill?, stroke?, strokeWidth?, rx?}`
- `circle`: `{id, kind:"circle", cx, cy, r, fill?, stroke?, strokeWidth?}`
- `line`: `{id, kind:"line", x1, y1, x2, y2, stroke?, width?}`
- `arrow`: `{id, kind:"arrow", x1, y1, x2, y2, stroke?, width?}` — line with a head.
- `polygon`: `{id, kind:"polygon", points:[[x,y],...], fill?, stroke?, strokeWidth?}`

Coordinates are canvas pixels, origin top-left. Colors are CSS hex strings
(`"#1a1a1a"`). Sensible defaults: 2px `#1a1a1a` strokes, transparent fills.

## Math notation (v0)

The player has no math renderer in v0, so specs must use **unicode math**, never
LaTeX commands: `½ ¼ ¾ × ÷ − → √ π θ ° ² ³ ≤ ≥ ≠ ± ≈ ∠ △`. The validator
rejects backslash sequences like `\frac`. (KaTeX rendering is ROADMAP item
R-3; the spec will gain a `latex` shape kind then, keeping `text` working.)

## Validation

`player/validate.js` is the reference validator. `node --test "tests/*.test.js"`
runs it over every file in `samples/` plus negative cases.
