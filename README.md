# animath

Animated math & science problems and concepts, generated on demand for the
Singapore syllabus — primary, secondary, and junior college.

**The idea:** a student picks what they need (level → subject → topic, or just
types a question). animath asks an LLM to produce an *animation spec* — a small
JSON document describing scenes, shapes, motion, and narration — and the
built-in player renders it as a playable animation right in the browser. No
video files, no render farm: the animation is data, generated fresh per need.

**Bring your own key:** the web app talks to any OpenAI-compatible chat
completions endpoint. Your API key stays in your browser's `localStorage` and
is sent only to the endpoint you configure — nowhere else.

**Presets:** the provider select fills the base URL and model for OpenAI,
local Ollama (no key needed), and Anthropic via an OpenAI-compatible proxy
(see `generator/llm_client.js`). Note the client speaks OpenAI-compatible chat
completions only — the Anthropic option requires a proxy that translates.

**Long-term direction:** a generation service that Aceceed live teaching can
call to produce animated explainers inside real lessons.

## Quickstart

No build step, no dependencies.

1. Open `web/index.html` in a browser.
2. Pick level / subject / topic (or describe the concept in your own words).
3. Paste your LLM API key — and base URL if it isn't OpenAI — pick a model,
   hit **Generate**.
4. Watch, scrub, replay. **Copy spec** saves the JSON so the animation can be
   replayed or shared without regenerating.

No API key handy? Play the hand-authored samples in `player/demo.html` — or
browse them as cards in `web/gallery.html` (same samples, no key needed). Like
the player demo, the gallery fetches its JSON over HTTP, so serve the repo
with e.g. `python3 -m http.server` rather than opening the file directly —
Chrome blocks fetch from `file://` pages.

## How it works

```
student need ──► prompt builder ──► LLM (your key) ──► animation spec (JSON)
                                                              │
                                                     validator ├─► player (SVG, in-browser)
                                                              │
                                                     samples/ (hand-authored, always playable)
```

- `SPEC.md` is the contract: the JSON schema the LLM must emit and the player
  renders. If code and spec disagree, the code is wrong.
- `SYLLABUS.md` is the topic taxonomy (PSLE → O/N-level → H2), which feeds the
  topic picker and the generator prompts.
- `PROMPTS.md` holds the generator prompt templates.
- `player/` is a dependency-free SVG renderer: play / pause / scrub / scene
  stepper / speed.
- Keyboard shortcuts in the player: Space for play/pause, left/right arrows
  for prev/next scene; reduced-motion honored (no animation when the OS
  prefers-reduced-motion setting is on).
- Scene filmstrip: one labeled button per scene jumps straight to it; the
  active scene is highlighted as you play.
- `generator/` builds the prompt and calls the LLM (OpenAI-compatible).
- `web/` is the student-facing single page app.
- `samples/` are hand-authored specs that prove the player works with no LLM.

## Embedding

No API key is needed to play a sample — `web/embed.js` mounts any sample by
topic slug in a host page with one call:

```html
<link rel="stylesheet" href="player/player.css">
<script src="player/player.js"></script>
<script src="web/embed.js"></script>
<script>AnimathEmbed.mount(document.getElementById('stage'), 'primary-math-fractions-addition')
  .then(function (player) { player.play(); });</script>
```

Copy the snippet into your page, adjusting the script paths so they point at
your animath checkout, and optionally pass `{ baseUrl: '/samples', autoplay: true }`.
Like the gallery, embedding fetches the sample JSON over HTTP — serve your
site with e.g. `python3 -m http.server` rather than `file://`, which Chrome
blocks for fetch.

## Export WebM

Open any sample in `player/demo.html` and press the Export WebM button (`#exportbtn`,
in the demo bar) to record the currently loaded animation as a WebM video file —
handy for teachers embedding a clip in slides or worksheets.

The filename is `<slug>-YYYYMMDD-HHmmss.webm` (e.g.
`primary-math-fractions-addition-20261009-101825.webm`), so repeated exports never
overwrite each other. Three modules do the work:

- `player/export-frames.js` — DOM-free, deterministic per-frame SVG rendering
  (`renderFrame` / `frameMs` / `sceneFrameCount`): replays the scene timeline with
  the player's instant semantics and emits a standalone SVG string per frame.
- `player/export-record.js` — browser recording harness: rasterizes each frame to
  an offscreen canvas, feeds `canvas.captureStream()` into `MediaRecorder`
  (VP9 first, then VP8, then plain WebM), and resolves a WebM blob.
- `player/export-ui.js` — wires the button to the harness on demo.html.

The export records the full scene sequence at normal playback pace — reduced-motion
users receive the same complete video. The button is a native `<button>`, so it is
keyboard-accessible. On browsers without `MediaRecorder` (checked by `supportCheck`,
fail-closed with human-readable reasons), the button is disabled and shows the
reason as a tooltip plus an "Export unavailable: <reason>" status message.

## Singapore syllabus coverage

Primary (PSLE) · Secondary (O/N-level, E-Math & A-Math, Physics / Chemistry /
Biology) · JC (H2 Math / Physics / Chemistry / Biology). Full topic list with
slugs in `SYLLABUS.md`.

## Teacher rubric

`generator/rubric.js` scores a generated spec 0-120 across six dimensions
(20 points each): contract validity (`player/validate.js` clean), pacing
(scene durations in the measured 6000-12000ms band, step gaps at most
3700ms), captions (every scene non-empty, at most 80 chars), pedagogy
(worked-solution answer beat for kind `problem`; a wrong-turn marker beat
when the topic resolves in the misconception library — both documented
heuristics, skipped when inapplicable), canvas bounds (every shape
inside the 960x540 canvas, text within its per-size char budget), and
mechanism density (scenes showing a genuine state transition: move steps,
a staged diagram build, or a diagram rebuild after a hide — a documented
heuristic, owner-reversible).

```js
const { scoreSpec } = require('./generator/rubric.js');
const { score, maxScore, dimensions } = scoreSpec(spec); // e.g. 110/120
```

Invalid (non-object) input scores 0 with a reason and never throws. Works
in the browser too — load `player/validate.js` and
`generator/build_prompt.js` before it.

## Geometry audit

`generator/geometry.js` statically audits text geometry across a spec:
every `show`-step text shape is boxed (width = size × the sum of
PIL-measured DejaVu Sans per-glyph advances baked into the module,
falling back to 0.6 × size per unknown glyph,
resolved against `align`/`start`|`middle`|`end`, and baseline-anchored
vertically — top = y − ascent × size (ascent is 1.0 conservatively, or 0.8
for ascender-less labels: only lowercase without bdfhkl/i/j-tittle/tall
characters, per the PIL-measured budget in `geometry.js`), since SVG text y
is the alphabetic baseline)
and checked for canvas overflow, every pair of text boxes is checked for overlap beyond a 1%
tolerance, and latex anchors are checked against the canvas (no width
estimate — KaTeX width is not statically computable). Shapes moved by
later `move` steps are audited at their show-time position (documented
limitation). `auditAllSamples('samples')` runs the audit over all
69 samples in `samples/index.json` and returns finding records
`{file, scene, kind, detail}`. Run the check (with coverage) via
`node --test --experimental-test-coverage "tests/*.test.js"` — every line
of the module is covered by `tests/geometry.test.js`.

The runnable developer entry point is `node generator/audit.js`:
`--all` (or `<file...>` paths) runs the static and time-sampled audits and
prints up to four finding sections in order — `genuine findings:`,
`triage-verified findings:`, `intentional-motion findings:`,
`intentional-staging findings:` (each only when it has entries) — followed by
a counts line, e.g. `559 finding(s): 367 intentional-motion, 127
intentional-staging, 0 genuine, 65 triage-verified`. The exit-code contract is
CI-able as 0 = no genuine findings, 1 = one or more genuine findings, 2 =
usage error, unreadable file, or bad triage-verdicts file: intentional
findings get their own sections and do NOT affect the exit code.
`generator/audit-verdicts.json` holds human-triage verdicts —
`deliberate-placement` or `box-model-artifact` — for genuine findings verified
acceptable as-is; matching pairs move into the `triage-verified` section and
stop counting as genuine. The verdicts file is validated fail-closed:
unreadable, malformed, or unknown-verdict records exit 2 rather than being
silently ignored.

Intentional findings are classified by `classifyFindings` (issues #382/#384):
intentional-motion iff the overlap band touches a move-step flight interval of
either involved shape AND both shapes' rest positions are clear;
intentional-staging iff not intentional-motion and the two shapes' visibility
intervals (from show/hide step times) never share a 100ms audit sample —
sequential same-slot labels never on screen together; everything else is
genuine. Known limitation: bands are 100ms samples, so a sub-100ms graze
between samples is invisible to the audit and the classifier alike, and flight
intervals come only from the spec's own move steps (scripted motion).

## Chart toolkit

`generator/charts.js` standardizes chart construction across samples and
the generator: `pieSectors` builds pie slices as first-class sector
descriptors (value-proportional sweeps from north, zero-angle sectors keep
index alignment with legends), `barLayout` builds vertical or horizontal
bar rects on a zero baseline, `axisTicks` produces "nice" tick values
(1/2/2.5/5/10 × 10^k), `numberLine` composes a baseline with tick marks
and centered labels, `areaUnderCurve` closes a polyline into polygon
points down to a baseline, and `gridLines` lays out chart-grid lines. All
six are pure (no DOM, no dependencies), UMD like `geometry.js`/`rubric.js`
so they work in the browser too, and return spec-ready descriptors that
`player/validate.js` accepts unchanged — `tests/charts.test.js` covers
every line including the empty/negative/degenerate edge cases.

## Circuit symbols

`docs/circuit-symbols.md` standardizes circuit-diagram symbols for
`phys-electricity` samples: cell, battery, resistor (IEC zigzag), bulb,
switch, ammeter, and voltmeter, each specified as a composite of SPEC.md
v0.1 primitives on a 40px grid with connection points, plus the
current-flow marker convention (red markers traveling the wires in the
conventional-current direction) that keeps circuit scenes mechanism-first.
Every electricity sample draws its circuits with these symbols.

## Curly arrows

`docs/curly-arrows.md` standardizes the electron-pushing arrow convention
for `h2-organic` samples: double-barbed curly arrows (one electron pair)
drawn as 8-point `polygon` polylines approximating a quadratic bezier
with two barbed head lines, plus the electron-pair dot convention (two
r=5 dots that visibly travel the arrow in staged `move` steps, then hide
on arrival) that keeps mechanism scenes mechanism-first. The tail always
starts at the electron pair being moved; atoms never move along the
arrow.

## Tests

Zero-dependency, Node built-in:

```sh
node --test "tests/*.test.js"
```

This validates every sample in `samples/` against `SPEC.md` via
`player/validate.js`, plus negative cases for the validator itself.

### Validate a single spec

`player/validate.js` also runs as a standalone CLI against `SPEC.md`:

```sh
node player/validate.js <spec.json>
```

Exit codes: `0` = valid spec, `2` = spec has validation errors, `1` = bad
arguments, unreadable file, or invalid JSON. Validation findings (exit `0`
/ `2`) print to stdout; usage, argument, file, and JSON errors (exit `1`)
print to stderr. The CLI is Node-only and guarded by
`require.main === module`, so the UMD/browser path is unchanged and the
module API is still exactly `{ validateSpec }`.

## Roadmap

See `ROADMAP.md`. The repo is developed in small reviewed slices by an
automated iteration loop (one issue → one PR → review → merge, every
15 minutes); humans are welcome via issues and PRs like any other repo.

## License

MIT — see `LICENSE`.

## Contributing

New here? Start with [CONTRIBUTING.md](CONTRIBUTING.md) — the zero-dependency
policy, the test gate, sample conventions, and branch/PR rules.
