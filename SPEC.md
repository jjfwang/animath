# teachkit Animation Spec — v0.1

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
| `subject` | string                            | required non-empty string — any school subject; math\|science\|geography are the syllabus-covered subjects |
| `topic`   | string                            | slug from `SYLLABUS.md`                            |
| `kind`    | `"concept"` \| `"problem"`        | concept = explain an idea; problem = pose then solve |
| `canvas`  | `{width, height}`                 | pixels; `960 × 540` recommended                    |
| `scenes`  | Scene[1..8]                       | played in order (1 scene = holistic cycle/system staging) |

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

## Playback

The reference player (`player/player.js`) advances a spec through a small
playback state machine. The relevant state fields are `sceneIdx` (current
scene), `sceneTime` (ms into the current scene), `playing`, `lastTick`
(timestamp of the previous frame), and `fired` (per-scene record of steps
already triggered):

- When playback reaches the end of a non-final scene, the player advances
  to the next scene and keeps playing. `tick()` calls
  `goScene(state.sceneIdx + 1, 0)`, then re-arms playback directly —
  `state.playing = true; state.lastTick = now` — instead of calling
  `play()`: `tick()` already schedules the next animation frame itself
  (`state.raf = requestAnimationFrame(tick)`), and a second frame request
  would run the loop twice as fast.
- When the final scene ends, playback stops. `tick()` calls `pause()`
  (cancelling the scheduled frame, flipping `state.playing` off) and
  leaves the final frame on screen —
  `renderSceneAt(state.sceneIdx, scene.duration_ms, true)`.
- Manual navigation always lands paused: the prev/next buttons, the
  filmstrip, and the keyboard prev/next shortcuts go through `goScene()`,
  which calls `pause()` before jumping; the scrub slider calls `pause()`
  directly and then renders the scrubbed position. The restart button is
  the deliberate exception — `goScene(0, 0)` followed by `play()` — so it
  lands on the first scene playing.
- `play()` pressed at or past the end of a scene seeks before playing: at
  the end of a non-final scene it jumps to the next scene from 0
  (`goScene(state.sceneIdx + 1, 0)`); at the end of the final scene it
  restarts the final scene from 0
  (`renderSceneAt(state.sceneIdx, 0, reducedMotion)`). Either way it then
  sets `state.playing = true`, `state.lastTick = performance.now()` and
  schedules the frame loop.

The player mounts paused on the first frame (`renderSceneAt(0, 0,
reducedMotion)`); playback starts when the user presses play.

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

## Slide spec

A slide deck is the teaching-material companion to an animation spec: an
ordered set of slides for presenting a topic before or alongside the
animation. `validateSlides` in `player/validate.js` enforces this contract
and returns a `string[]` of errors, exactly like `validateSpec` (empty =
valid).

Deck fields:

| field     | type                                   | notes                                  |
|-----------|----------------------------------------|----------------------------------------|
| `title`   | string                                 | required non-empty                     |
| `level`   | `"primary"` \| `"secondary"` \| `"jc"` |                                        |
| `subject` | string                                 | required non-empty — any school subject, not restricted to the syllabus-known list |
| `topic`   | string                                 | required non-empty                     |
| `slides`  | Slide[]                                | required non-empty array               |

Slide fields:

| field     | type   | notes |
|-----------|--------|-------|
| `kind`    | string | required, one of `title` \| `objective` \| `hook` \| `concept` \| `mechanism` \| `example` \| `practice` \| `exit-ticket` |
| `heading` | string | optional; a slide must have a heading or non-empty `bullets` (or both) |
| `bullets` | string[] | optional; every entry a non-empty string |
| `notes`   | string | optional speaker notes; must be a string when present (empty allowed) |
| `visual`  | string \| object | optional; see below |

A `visual` is valid in exactly two forms: (a) a non-empty string — an
animation scene id; or (b) a descriptor object with a non-empty `sceneId`
and/or a `kind` naming a shape kind from the Shapes section (when both
fields are present, both must be valid). Anything else — `null`, a number,
an array, an empty string, `{}`, an empty `sceneId` with no valid `kind`,
an unknown `kind` with no valid `sceneId` — is a **dangling visual
reference** and is rejected.

Ordering rules: a `title` slide is required and must be first; an
`exit-ticket` slide is required and must be last; an `objective` slide is
not required, but when one is present it must come before the first
`concept` or `mechanism` slide. No other ordering constraints apply.

## Worksheet spec

A worksheet is the practice-material companion to an animation spec: an
ordered set of questions a student answers on paper or in class, with an
answer key for the teacher. `validateWorksheet` in `player/validate.js`
enforces this contract and returns a `string[]` of errors, exactly like
`validateSpec` (empty = valid).

Worksheet fields:

| field       | type       | notes                                  |
|-------------|------------|----------------------------------------|
| `title`     | string     | required non-empty                     |
| `level`     | `"primary"` \| `"secondary"` \| `"jc"` |                                        |
| `subject`   | string     | required non-empty — any school subject, not restricted to the syllabus-known list |
| `topic`     | string     | required non-empty                     |
| `questions` | Question[] | required array of at least 1 question  |

The worksheet answer key is the set of per-question `explanation` fields
(see the Question table below): the explanation for a question states why
its answer is correct, and it may name the misconception it addresses via
the question's `misconception` field.

## Exit ticket spec

An exit ticket is the short end-of-lesson check for a topic: a small set
of questions whose answers tell the teacher what to reteach next lesson.
`validateExitTicket` in `player/validate.js` enforces this contract and
returns a `string[]` of errors, exactly like `validateSpec` (empty =
valid).

Exit ticket fields:

| field       | type       | notes                                  |
|-------------|------------|----------------------------------------|
| `title`     | string     | required non-empty                     |
| `level`     | `"primary"` \| `"secondary"` \| `"jc"` |                                        |
| `subject`   | string     | required non-empty — any school subject, not restricted to the syllabus-known list |
| `topic`     | string     | required non-empty                     |
| `questions` | Question[] | required array of 3 to 5 questions     |

Exit-ticket feedback is the per-question `feedback` field (see the
Question table below): feedback is written per answer, telling the student
what their answer shows, and it is keyed to a misconception via the
question's `misconception` field when the answer reveals one.

## Question (worksheet and exit ticket)

Worksheet and exit-ticket questions share one shape:

| field           | type    | notes |
|-----------------|---------|-------|
| `id`            | string  | required non-empty; unique within the document |
| `prompt`        | string  | required non-empty — the question text |
| `kind`          | `"multiple-choice"` \| `"short-answer"` | required |
| `choices`       | Choice[] | multiple-choice only: required array of at least 2 choices |
| `answer`        | string  | short-answer only: required non-empty — the expected answer |
| `explanation`   | string  | optional; the worksheet answer-key explanation — must be a non-empty string when present |
| `feedback`      | string  | optional; the exit-ticket per-answer feedback — must be a non-empty string when present |
| `misconception` | string  | optional; names the misconception the `explanation` or `feedback` addresses — must be a non-empty string when present |

A `Choice` is an object `{text, correct}`: `text` is a required non-empty
string, and `correct` marks the right answer — exactly one choice in a
multiple-choice question must carry `correct: true`; every other choice
omits `correct` or sets it to `false`.

## Student notes spec

Student notes are the study-material companion to an animation spec: a
short set of notes a student reads before or after a lesson.
`validateNotes` in `player/validate.js` enforces this contract and
returns a `string[]` of errors, exactly like `validateSpec` (empty =
valid).

Notes fields:

| field            | type       | notes                                  |
|------------------|------------|----------------------------------------|
| `title`          | string     | required non-empty                     |
| `level`          | `"primary"` \| `"secondary"` \| `"jc"` |                                        |
| `subject`        | string     | required non-empty — any school subject, not restricted to the syllabus-known list |
| `topic`          | string     | required non-empty                     |
| `objectives`     | string[]   | required non-empty array; every entry a non-empty string |
| `definitions`    | Definition[] | required array of at least 1 definition |
| `mechanismSteps` | string[]   | required non-empty array; every entry a non-empty string |
| `workedExample`  | string     | required non-empty |
| `trap`           | object     | required; see below |

A `Definition` is an object `{term, meaning}`: both `term` and
`meaning` are required non-empty strings.

The `trap` is an object `{misconception, explanation}`: both
`misconception` and `explanation` are required non-empty strings. The
misconception names the common wrong turn for this topic, and the
explanation states why it is wrong and what to do instead.

## Teacher script spec

A teacher script is the delivery companion to an animation spec: a
timed sequence of segments a teacher follows while teaching a topic.
`validateScript` in `player/validate.js` enforces this contract and
returns a `string[]` of errors, exactly like `validateSpec` (empty =
valid).

Script fields:

| field      | type      | notes                                  |
|------------|-----------|----------------------------------------|
| `title`    | string    | required non-empty                     |
| `level`    | `"primary"` \| `"secondary"` \| `"jc"` |                                        |
| `subject`  | string    | required non-empty — any school subject, not restricted to the syllabus-known list |
| `topic`    | string    | required non-empty                     |
| `segments` | Segment[] | required non-empty array               |

Segment fields:

| field       | type     | notes |
|-------------|----------|-------|
| `minutes`   | number   | required positive number |
| `say`       | string   | required non-empty — what the teacher says |
| `cue`       | string   | optional; must be a non-empty string when present |
| `questions` | string[] | optional; must be an array when present, every entry a non-empty string |
| `watchFor`  | string   | optional; must be a non-empty string when present — the student response or misconception to watch for |

Total timing: the `minutes` values of all segments must sum to
5..120 minutes (inclusive). The total is only evaluated when every
segment has a positive numeric `minutes` value.

## Lesson pack spec

A lesson pack is the bundle `generateLessonPack` in
`generator/pipeline.js` returns for one topic: all six teaching
materials for the topic, authored together so they agree with each
other. `generateLessonPackForSyllabus` is the syllabus-keyed entry
point to the same contract (see Cache below).

Pack shape: an object with exactly the keys `manifest`, `animation`,
`slides`, `worksheet`, `notes`, `exitTicket`, `script`. Each material
value is a spec that validates clean against its own section of this
document: `animation` via `validateSpec`, `slides` via
`validateSlides`, `worksheet` via `validateWorksheet`, `notes` via
`validateNotes`, `exitTicket` via `validateExitTicket`, and `script`
via `validateScript`.

Manifest shape: `manifest` has exactly the keys `slug`, `topic`,
`level`, `subject`, `version`, `materials`.

- `slug` is derived deterministically from the call's `topic`,
  `level`, and `subject` options, in that order. Each part is
  trimmed, lowercased, every run of non-alphanumeric characters is
  collapsed to a single hyphen, and edge hyphens are stripped; empty
  parts are dropped and the remaining parts are joined with hyphens.
  If every part is empty the slug is `untitled`.
- `topic`, `level`, and `subject` echo the resolved call options.
- `version` is the generator (package) version in Node, and the
  string `unknown` in the browser, where no package version is
  available.
- `materials` is exactly the six material keys in pack order:
  `animation`, `slides`, `worksheet`, `notes`, `exitTicket`,
  `script`.

Shared unpack: one shared unpack stage authors all six materials, so
the whole pack shares one set of transitions (with the topic's
misconceptions attached), one worked example, and one misconception
set. Materials are authored sequentially in pack order.

Failure semantics: a missing `deps.callChat`, or a missing validator
for any material, rejects before any authoring happens. Each material
is authored through its builder, validator, and repair loop (repair
cap `opts.maxRepairs`, default 3); a material that exhausts its
repair cap rejects the whole pack, and the rejection error carries
`err.material` naming the failed material key and `err.problems`
holding that material's validator problems.

Cache: packs are cached in memory by manifest slug. A repeat call
whose slug is already cached resolves the cached pack object with
zero further LLM calls, unless `opts.force` is `true`, which
regenerates the pack and replaces the cached entry. The exported
`clearPackCache` empties the cache. `generateLessonPackForSyllabus`
resolves its syllabus id first — an unresolvable id rejects before
any LLM call — then merges the resolved `topic`, `topicLabel`,
`level`, and `subject` under any explicit non-undefined options, and
delegates to `generateLessonPack`, so a syllabus-keyed call and the
equivalent direct call share one cache entry.

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

## Interactive teaching extension (independent of animath v0.1)

`interactive:"0.1"` is an additive, opt-in artifact type implemented by
`player/interactive.js`. It is **not** a new value for `animath`, and existing
animation documents remain `animath:"0.1"` with unchanged validation and
player controls. Consumers must explicitly mount with
`TeachkitInteractive.mount(container, interactiveSpec)`.

### Pilot scope: secondary science, water cycle

Required fields: `interactive:"0.1"`, `model:"water-cycle"`,
`title` (nonempty <=100 chars), `level:"secondary"`, `subject:"science"`,
`topic:"water-cycle"`, `disclaimer` (<=300 chars, explicitly states the
model is not a forecast/weather prediction), `parameters`, `beats`,
`check`.

`parameters` must contain exactly three unique entries:
`solar`, `cooling`, `growth`. Each entry has `id`, `label`,
`min:0`, `max:100`, `step:10`, and an integer default divisible by 10
in 0–100. These are **illustrative relative activity controls**; they are
not physical measurement units. The model illustrates a *single parcel's*
progression from solar-driven water-vapour supply through cooling and droplet
growth. `evaluate` returns `evaporation=solar`,
`condensation=min(evaporation,cooling)`,
`precipitation=min(condensation,growth)`, `collection=precipitation`.
This is a qualitative mechanism illustration and must not be marketed as a
weather, cloud-cover, rainfall or evaporation-rate predictor.

`beats` must contain unique ids `overview`, `evaporation`,
`condensation`, `precipitation`, `collection`; each has a bounded,
nonempty `label` and `narration`. The `check` has `question` (text),
`options` (2–4 text answers), `correctIndex` (valid zero-based integer),
and `explanation` (text). These are static, vetted content strings;
interactive specs do not contain executable expressions or HTML.

### Controller and events

`createSession(spec)` is DOM-free. `mount(container,spec)` renders the
responsive interactive water-cycle view. Both expose `getState()`,
`getHistory()`, `setParameter(id,value,source?)`,
`playBeat(id,source?)`, `answer(index,source?)`, `reset(source?)`,
`on(callback)` and `destroy()`. Sources are `student` (default) or
`tutor`. Invalid commands throw and must not mutate the state. Events
have monotonic local `seq`, `type`, `source`, `detail` and a full
immutable-by-copy state snapshot. Sync and auth are the host's concern;
events must be persisted by the Aceceed session service if durable replay
is needed. No network request is made for state changes.

Version `0.1` supports only the built-in water-cycle model. Unknown models
fail validation; a future spec revision may add a safe declarative graph DSL
and a registry of proven domain simulators. Do **not** insert arbitrary
model-authored functions into the renderer.

See `samples/interactive/secondary-science-water-cycle.json`,
`player/interactive-demo.html`, and
`docs/INTERACTIVE_TEACHING_ROADMAP.md`.

## Multi-subject simulations v0.2 (experimental)

The additive `simulation:"0.2"` contract in `player/simulation-kit.js` supports eight
registered models: `water-cycle` (Primary Science), `fraction-bars` (Primary Math),
`uniform-motion` (Secondary Physics), `ohms-law` (Secondary Physics),
`ideal-gas` (JC Physics), `quadratic-curve` (JC Mathematics),
`transpiration` (Primary Science), and `erosion` (Primary Geography). It does not change the legacy
`animath:"0.1"` spec or the standalone `interactive:"0.1"` water-cycle pilot.

Each JSON spec includes `simulation`, `model`, `title`, `level`,
`subject`, `topic`, `disclaimer`, bounded `parameters` with
`id,label,min,max,step,default`, uniquely identified narrated `beats`,
and an `check` with question, options, answer index and explanation.
A simulator is selected only by a **hard-coded allowlisted model ID**. The
spec is never executed as code, and label/title strings are HTML-escaped.

`TeachkitSimulations.createSession(spec)` and `mount(container,spec)`
share a controller: `setParameter`, `playBeat`, `answer`, `reset`,
`on`, `getState`, `getHistory`, `destroy`. Commands are synchronous,
validate all parameter invariants before committing a change, and emit
ordered copy-protected event snapshots. Fraction numerator must not exceed
denominator; water-cycle outputs are illustrative non-forecast activity;
uniform motion assumes constant speed with metres/seconds.

Samples live in `samples/simulations/`; the browser demo is
`player/simulation-demo.html` (serve via HTTP).


## Tutor synchronization adapter (experimental)

For a `simulation:0.2` spec, a tutor map must contain **exactly one**
`{beatId, slideId, speechCue}` for every visual beat. IDs are bounded
hierarchical strings and must be unique within the map. The bridge validates
this mapping before the lesson. Session commands carry positive monotonic
`sequence` integers. Duplicates are ignored; gaps and unknown beat IDs
throw without state mutation. Speech progress is local milliseconds from the
current cue and must be monotonic. Interruptions pause playback and preserve
position; explicit seek re-aligns the slide, voice cue and visual beat.
Checkpoints pause the bridge; after two unsuccessful responses the bridge
reports `needsAdaptation` instead of automatically repeating a question.
The host authorizes remote commands and drives real audio/slides. This is a
pure event-state synchronization **contract**, not an audio synthesis service.

## Interactive prepublication review contract

`generator/interactive-review.js` requires deterministic validation, SVG
safety and a lesson blueprint with an exact `syllabusId` and objectives.
An external reviewer must return `status` (approve/revise/uncertain),
`reviewerId`, 0–1 `confidence`, `findings`, and four explicit check statuses:
scientific, curriculum, pedagogy and accessibility (pass/fail/uncertain).
An agent report is **not trusted** unless these fields validate. Automatic
approval requires agent `approve`, confidence >=0.85, all checks pass and
zero findings. Provider failure/uncertainty returns `human_required`.
The host authenticates reviewers; this library never calls an LLM while a
student manipulates a visualization. See #801.

## Approved artifact storage (experimental)

`generator/approved-assets.js` enforces lowercase path-safe syllabus,
revision, level, track, subject, topic, locale, objectives hash and
difficulty components. Required generation context: promptVersion and
engineVersion. Assets are named .json/.svg/.txt/.md and include an
`interactive.json` or `animation.json` visual. The pack is SHA-256
addressed; all objects are immutable and a single `current.json` pointer
is updated through host-supplied atomic compare-and-swap. The manifest
records `approvalStatus:approved`, typed reviewer evidence and per-file
hashes. Reads verify item hashes **and** the complete revision hash. An
unapproved or malformed report cannot publish. Rollback requires an already
approved revision and uses CAS. No LLM calls occur at read/playback time.

The Node-only `generator/fs-object-store.js` adapter is suitable for a
single local/staging host. It uses filesystem locks for CAS. Distributed
production **must** use its own durable store with strongly consistent CAS,
object immutability, tenant isolation, backup and auditing. A crashed local
process can leave a `.lock` directory that an operator must inspect/remove.
