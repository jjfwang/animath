# teachkit

Animated problems and concepts across all school subjects, generated on demand for the
Singapore syllabus — primary, secondary, and junior college.

**The idea:** a student picks what they need (level → subject → topic, or just
types a question). teachkit asks an LLM to produce an *animation spec* — a small
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

The web app (`web/index.html`) also has a lesson-pack mode: select
**Lesson pack** before hitting **Generate** and teachkit generates a full
lesson pack for the picked topic — the animation plus a slide deck,
worksheet, student notes, exit ticket, and teacher script — shows the pack
manifest, renders the slide deck in-page with the slide presenter and the
worksheet, student notes, exit ticket, and teacher script in-page with the
printable renderers (the teacher answer keys stay hidden behind a
**Show teacher keys** toggle), and still offers each material as a JSON
download.

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
your teachkit checkout, and optionally pass `{ baseUrl: '/samples', autoplay: true }`.
Like the gallery, embedding fetches the sample JSON over HTTP — serve your
site with e.g. `python3 -m http.server` rather than `file://`, which Chrome
blocks for fetch.

## Export WebM

The Export WebM button (`#exportbtn`, with an `#exportstatus` status line,
`aria-live="polite"`) is wired on three pages: `player/demo.html` (the demo
bar — open any sample and press it), `web/index.html` (the generator app —
exports the spec just generated), and `web/gallery.html` (the sample gallery —
exports the currently mounted sample). It records the animation as a WebM
video file — handy for teachers embedding a clip in slides or worksheets.

The filename is `<slug>-YYYYMMDD-HHmmss.webm` (e.g.
`primary-math-fractions-addition-20261009-101825.webm`), so repeated exports never
overwrite each other. Three modules do the work:

- `player/export-frames.js` — DOM-free, deterministic per-frame SVG rendering
  (`renderFrame` / `frameMs` / `sceneFrameCount`): replays the scene timeline with
  the player's instant semantics and emits a standalone SVG string per frame.
- `player/export-record.js` — browser recording harness: rasterizes each frame to
  an offscreen canvas, feeds `canvas.captureStream()` into `MediaRecorder`
  (VP9 first, then VP8, then plain WebM), and resolves a WebM blob.
- `player/export-ui.js` — button glue: `attachExportUI` attaches the export
  controller to the page's button and status line (each page supplies
  `getSpec`/`getSlug`); on `web/index.html` and `web/gallery.html` the call is
  guarded on the export globals so the page stays unbroken if a script tag
  ever fails to load.

The export records the full scene sequence at normal playback pace — reduced-motion
users receive the same complete video. The button is a native `<button>`, so it is
keyboard-accessible. On browsers without `MediaRecorder` (checked by `supportCheck`,
fail-closed with human-readable reasons), the button is disabled and shows the
reason as a tooltip plus an "Export unavailable: <reason>" status message.

## Printable worksheets and exit tickets

`player/printable.js` renders a worksheet or exit-ticket spec (see
`SPEC.md`) to a printable HTML string — a student sheet plus a separate
teacher answer key, so teacher content can never leak onto the student
page:

```js
const { renderWorksheet, renderWorksheetAnswerKey, renderExitTicket, renderExitTicketAnswerKey } = require('@jjfwang/teachkit/printable');

const studentHtml = renderWorksheet(worksheetSpec); // prompts and choices only
const teacherHtml = renderWorksheetAnswerKey(worksheetSpec); // answers, explanations, misconceptions
```

The exit-ticket pair works the same way (`renderExitTicket` /
`renderExitTicketAnswerKey`, with per-answer feedback in the key). Link
`player/printable.css` for the sheet styling — in print, screen-only
controls are hidden and the teacher key starts on a fresh page. Every
render validates the spec first and throws on errors.
`player/printable-demo.html` shows both gold samples rendered end to end.
`player/pack-demo.html` shows full lesson packs on one page — all six
gold materials for the water cycle, for fractions addition, for
waves, for JC complex numbers, for secondary trigonometry,
for JC thermal physics, for secondary photosynthesis, for primary-geography erosion,
and for secondary chem-mole
(animation, slides, worksheet, notes, exit ticket, and script), each
under its own pack manifest header.

The same module renders student notes and a teacher script from their
specs (see `SPEC.md` "Student notes spec" / "Teacher script spec"):

```js
const { renderNotes, renderScript } = require('@jjfwang/teachkit/printable');

const notesHtml = renderNotes(notesSpec); // objectives, definitions, mechanism steps, worked example, trap
const scriptHtml = renderScript(scriptSpec); // timed segments with the summed total, cues, questions, watch-fors
```

`renderNotes` prints the objectives, the definition list, the ordered
mechanism steps, the worked example, and the trap (the misconception
plus why it is wrong). `renderScript` prints each timed segment in
order with a total-minutes line summed from the segments, showing the
cue, questions, and watch-for note only when a segment carries them.
Both validate first and throw on an invalid spec, and the demo page
renders the water-cycle notes and script gold samples alongside the
worksheet and exit ticket.

## Install as a library

Other projects can import the generator modules and the player directly:

```sh
npm install @jjfwang/teachkit
```

The first published line is `0.2.0-beta.0` — track the beta channel with
`npm install @jjfwang/teachkit@beta`, or install from source with
`npm install github:jjfwang/teachkit`.

```js
const { buildPrompts } = require('@jjfwang/teachkit/build-prompt');
const charts = require('@jjfwang/teachkit/charts');
const { auditGeometry } = require('@jjfwang/teachkit/geometry');
const { scoreSpec } = require('@jjfwang/teachkit/rubric');
const { validateSpec } = require('@jjfwang/teachkit/player-validate');
const { mount } = require('@jjfwang/teachkit/player');
const { generateAnimation } = require('@jjfwang/teachkit/pipeline');
const { unpackTopic } = require('@jjfwang/teachkit/unpack');
const { generateSlides } = require('@jjfwang/teachkit/slides');
const { buildSlidePrompts } = require('@jjfwang/teachkit/slides-prompt');
```

Validate a spec before mounting it — `validateSpec` returns an array of
error strings (empty = valid):

```js
const problems = validateSpec(spec);
if (problems.length) throw new Error('invalid animath spec: ' + problems.join('; '));
mount(el, spec); // el is a DOM element; mount re-validates and throws too
```

### Generate an animation end-to-end

The headline API is `@jjfwang/teachkit/pipeline`: it unpacks a topic into its
state transitions, authors a spec, and repairs it until it validates — prompt
in, animation out. You bring the LLM as `callChat` (any OpenAI-compatible
chat-completions endpoint); validation runs through your `validate` dep:

<!-- README_PIPELINE_EXAMPLE -->
```js
const { generateAnimation } = require('@jjfwang/teachkit/pipeline');
const { validateSpec } = require('@jjfwang/teachkit/player-validate');

// Your LLM, your key: callChat posts (system, user) to an OpenAI-compatible
// endpoint and resolves the assistant's raw text.
async function callChat(system, user) {
  const res = await fetch('https://api.example.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.ANIMATH_API_KEY
    },
    body: JSON.stringify({
      model: 'example-model',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

async function main() {
  return generateAnimation(
    { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
    { callChat, validate: validateSpec }
  );
}

module.exports = { callChat, main };
```
<!-- /README_PIPELINE_EXAMPLE -->

`main()` resolves with a spec that passed `validateSpec` — the repair loop
retries up to 3 times before failing. This snippet is
`tests/readme-pipeline-example.test.js`'s input: the test extracts it from this
README and runs it end to end against a stubbed `fetch`, so the docs cannot
drift from the real API.

### Generate a slide deck end-to-end

`generateSlides` is the slide-deck sibling of `generateAnimation`: it runs
the same unpack → author → repair stages, but authors a teaching slide deck
(title, objective, hook, concept, mechanism, example, practice, exit-ticket)
and repairs it against `validateSlides` until it validates. It is exported
from both `@jjfwang/teachkit/pipeline` and the dedicated
`@jjfwang/teachkit/slides` subpath (the same pipeline module, per the
`./presenter` precedent of a dedicated subpath):

```js
const { generateSlides } = require('@jjfwang/teachkit/slides');
// callChat is the same caller-supplied LLM call as the pipeline example
// above. deps.validateSlides is optional — when it and deps.validate are
// both omitted, the built-in validateSlides from
// @jjfwang/teachkit/player-validate is used.
const deck = await generateSlides(
  { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
  { callChat }
);
```

`deck` resolves as a slide-deck document that passed `validateSlides` — the
repair loop retries up to 3 times before failing. Need just the slide author
prompts (no pipeline)? `@jjfwang/teachkit/slides-prompt` exports
`buildSlidePrompts`, the prompt builder `generateSlides` drives:

```js
const { buildSlidePrompts } = require('@jjfwang/teachkit/slides-prompt');
const { system, user } = buildSlidePrompts({
  topic: 'water-cycle', topicLabel: 'Water cycle',
  level: 'primary', subject: 'science'
});
```

### Generate a worksheet end-to-end

`generateWorksheet` is the worksheet sibling of `generateAnimation`: it runs
the same unpack → author → repair stages, but authors a practice worksheet
(multiple-choice and short-answer questions with misconception-built
distractors and a per-question explanation answer key) and repairs it
against `validateWorksheet` until it validates. It is exported from both
`@jjfwang/teachkit/pipeline` and the dedicated
`@jjfwang/teachkit/worksheet` subpath (the same pipeline module):

```js
const { generateWorksheet } = require('@jjfwang/teachkit/worksheet');
// callChat is the same caller-supplied LLM call as the pipeline example
// above. deps.validateWorksheet is optional — when it and deps.validate
// are both omitted, the built-in validateWorksheet from
// @jjfwang/teachkit/player-validate is used.
const worksheet = await generateWorksheet(
  { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
  { callChat }
);
```

`worksheet` resolves as a worksheet document that passed
`validateWorksheet` — the repair loop retries up to 3 times before failing.
Need just the worksheet author prompts (no pipeline)?
`@jjfwang/teachkit/worksheet-prompt` exports `buildWorksheetPrompts`, the
prompt builder `generateWorksheet` drives:

```js
const { buildWorksheetPrompts } = require('@jjfwang/teachkit/worksheet-prompt');
const { system, user } = buildWorksheetPrompts({
  topic: 'water-cycle', topicLabel: 'Water cycle',
  level: 'primary', subject: 'science'
});
```

### Generate an exit ticket end-to-end

`generateExitTicket` is the exit-ticket sibling of `generateAnimation`: it
runs the same unpack → author → repair stages, but authors a short
end-of-lesson exit ticket (exactly 3-5 questions, per-answer feedback keyed
to the misconception) and repairs it against `validateExitTicket` until it
validates. It is exported from both `@jjfwang/teachkit/pipeline` and the
dedicated `@jjfwang/teachkit/exit-ticket` subpath (the same pipeline
module):

```js
const { generateExitTicket } = require('@jjfwang/teachkit/exit-ticket');
// callChat is the same caller-supplied LLM call as the pipeline example
// above. deps.validateExitTicket is optional — when it and deps.validate
// are both omitted, the built-in validateExitTicket from
// @jjfwang/teachkit/player-validate is used.
const ticket = await generateExitTicket(
  { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
  { callChat }
);
```

`ticket` resolves as an exit-ticket document that passed
`validateExitTicket` — the repair loop retries up to 3 times before failing.
Need just the exit-ticket author prompts (no pipeline)?
`@jjfwang/teachkit/exit-ticket-prompt` exports `buildExitTicketPrompts`,
the prompt builder `generateExitTicket` drives:

```js
const { buildExitTicketPrompts } = require('@jjfwang/teachkit/exit-ticket-prompt');
const { system, user } = buildExitTicketPrompts({
  topic: 'water-cycle', topicLabel: 'Water cycle',
  level: 'primary', subject: 'science'
});
```

### Generate student notes and a teacher script end-to-end

`generateNotes` and `generateScript` are the notes and script siblings of
`generateAnimation`: they run the same unpack -> author -> repair stages,
but author student notes (objectives, term/meaning definitions, ordered
mechanism steps, a worked example, and a trap naming the misconception)
and a teacher script (ordered segments with minute timings, say text, and
optional cue, questions, and watch-for notes), repairing against
`validateNotes` / `validateScript` until they validate. Each is exported
from both `@jjfwang/teachkit/pipeline` and a dedicated subpath (the same
pipeline module): `@jjfwang/teachkit/notes` and
`@jjfwang/teachkit/script`. Need just the author prompts (no pipeline)?
`@jjfwang/teachkit/notes-prompt` exports `buildNotesPrompts` and
`@jjfwang/teachkit/script-prompt` exports `buildScriptPrompts`:

```js
const { generateNotes } = require('@jjfwang/teachkit/notes');
// callChat is the same caller-supplied LLM call as the pipeline example
// above. deps.validateNotes is optional — when it and deps.validate are
// both omitted, the built-in validateNotes from
// @jjfwang/teachkit/player-validate is used.
const notes = await generateNotes(
  { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
  { callChat }
);
```

### Generate a full lesson pack

`generateLessonPack` (subpath `@jjfwang/teachkit/lesson-pack`) runs ONE
shared unpack stage, then authors all six materials from that single
unpack — the animation spec, slide deck, worksheet, student notes, exit
ticket, and teacher script — each through its existing builder,
validator, and repair discipline, so the whole pack shares one worked
example and one misconception set. A material that exhausts its repair
cap rejects the pack with that material named on `err.material`. The
resolved pack carries a `manifest` naming the topic slug (derived
deterministically from topic + level + subject: lowercase, runs of
non-alphanumeric characters collapsed to single hyphens), level, subject,
and generator version, plus the list of material keys present. Packs are
cached in memory by slug: a second call with the same slug resolves the
cached pack with no further LLM calls, `opts.force: true` regenerates
and replaces the cached entry, and the exported `clearPackCache()`
empties the cache. Generate a pack once before a session and reuse it
every session:

```js
const { generateLessonPack } = require('@jjfwang/teachkit/lesson-pack');
const pack = await generateLessonPack(
  { topic: 'The Water Cycle', level: 'Primary Science', subject: 'Science' },
  { callChat }
);
// pack.manifest.slug === 'the-water-cycle-primary-science-science'
// pack.animation / .slides / .worksheet / .notes / .exitTicket / .script
```

#### Generate a pack by syllabus id

`generateLessonPackForSyllabus` (exported from `@jjfwang/teachkit/lesson-pack`
and `@jjfwang/teachkit/pipeline`) takes a syllabus id instead of the
topic/level/subject options: either the composite `level/track/slug`
form or a bare topic slug. The id is resolved against the embedded
taxonomy (`@jjfwang/teachkit/syllabus` exports `SYLLABUS` and
`resolveSyllabusTopic`), an unknown or malformed id rejects before any
LLM call, and any explicit option you pass still wins over the resolved
values. The pack shares its cache entry with a direct
`generateLessonPack` call carrying the resolved topic, level, and
subject verbatim:

```js
const { generateLessonPackForSyllabus } = require('@jjfwang/teachkit/lesson-pack');
const pack = await generateLessonPackForSyllabus('primary/p-sci/water-cycle', {}, { callChat });
// pack.manifest.slug === 'water-cycle-primary-science'
const same = await generateLessonPackForSyllabus('water-cycle', {}, { callChat });
// same === pack (bare slug resolves to the same topic, cache hit)
```

Prefer the raw unpack layer? `unpackTopic` returns just the state transitions
(no authoring) — `callChat` receives the `{ system, user }` prompt pair:

```js
const { unpackTopic } = require('@jjfwang/teachkit/unpack');
const transitions = await unpackTopic(
  'water-cycle',
  { level: 'primary', subject: 'science' },
  (prompts) => callChat(prompts.system, prompts.user)
);
```

ESM consumers use default-import interop — the package ships CJS+UMD, so Node's
ESM loader does not detect named exports (`import { pieSectors }` throws).
Verified on Node 24 (issue #637):

```js
import charts from '@jjfwang/teachkit/charts';
const { pieSectors } = charts;
const sectors = pieSectors(480, 320, 200, [30, 50, 20]); // three sector descriptors
```

The snippet above is `tests/fixtures/esm-charts-entry.mjs`, exercised verbatim by
`tests/esm-charts.test.js`.

The generator modules are zero-dependency UMD, so they also work in
browsers via script tag, exposing namespaced globals (`AnimathCharts`,
`AnimathGeometry`, `AnimathRubric`, `AnimathPrompt`, ...). The player is DOM-based — load `player/player.css` and
`player/player.js` in the page and call `AnimathPlayer.mount(el, spec)`.
The player's public surface is `mount` and `version` only; internal helpers
live behind `AnimathPlayer.internals`.
`llm-client` needs your own OpenAI-compatible API key.

To publish a new version to the npm registry: `npm login`, bump
`version` in `package.json`, then `npm publish --access public`.

## Singapore syllabus coverage

Primary (PSLE) · Secondary (O/N-level) · JC (H2) — all subjects. Today's topic
list covers math and science, plus Primary Geography (PSLE) — the first proof
subject from #644, with erosion, plate-tectonics and weather-climate samples.
Languages and Literature stay out of #644's scope. Full topic list with
slugs in `SYLLABUS.md`.

## Teacher rubric

`generator/rubric.js` scores a generated spec 0-120 across six dimensions
(20 points each): contract validity (`player/validate.js` clean), pacing
(scene durations in the measured 6000-12000ms band, step gaps at most
3500ms), captions (every scene non-empty, at most 80 chars), pedagogy
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

In the generator web app (`web/index.html`) the rubric is wired into the
page: the page loads `../generator/rubric.js` alongside the other generator
scripts, and after `generateSpecWithRepair` resolves with a validated spec
it calls `window.AnimathRubric.scoreSpec(spec)` — guarded, so the page stays
unbroken if the script tag ever fails to load — and renders a compact score
panel next to the player: the total (out of 120) plus the six dimension
scores, each with its first note (`'no notes'` when a dimension recorded
none). The panel is a keyboard-reachable region (`role="region"`,
`tabindex="0"`), starts hidden, and hides again at the start of every
generation.

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
limitation). From `generator/tooling/audit-samples.js`, `auditAllSamples('samples')`
runs the audit over all
72 samples in `samples/index.json` and returns finding records
`{file, scene, kind, detail}`. Run the check (with coverage) via
`node --test --experimental-test-coverage "tests/*.test.js"` — every line
of the module is covered by `tests/geometry.test.js`.

The runnable developer entry point is `node generator/tooling/audit-cli.js`:
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

The generator web app (`web/index.html`) runs the audit on every generated
spec: the page loads `../generator/geometry.js` — the browser-loadable UMD
build (`window.AnimathGeometry`, exporting `auditGeometry` and
`classifyFindings`) — right after `generator/rubric.js`, and once
`generateSpecWithRepair` resolves with a validated spec, the success path runs
`auditGeometry` + `classifyFindings` on it and renders any findings classified
`genuine` as an amber advisory warning block (`#geomwarn`, `role="status"`)
between the rubric score panel and the player stage. The call is guarded on
`window.AnimathGeometry`, so the page stays unbroken if the script fails to
load; the player mounts and plays before the audit runs, and findings are
advisory-only — they never block playback and never feed the spec-repair loop
(owner decision delegated 2026-10-11, reversible).

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

Generator side: `generator/build_prompt.js` carries a chart-construction
instruction in the system prompt (after the explain-tooltips block, so the
numbered hard rules are untouched): pie slices as first-class `"sector"`
descriptors (`{cx, cy, r, startAngle, endAngle}`, one per value, with
value-proportional sweeps — angles in degrees, 0 is east, positive is
clockwise); bar charts as `"rect"` descriptors growing up from a visible
zero baseline; axes with `"nice"` tick values (1/2/2.5/5/10 steps) and a
few labeled tick marks; number lines as a baseline with tick marks and
centered text labels; area under a curve as a `"polygon"` whose points
close back to the axis baseline; chart grids as thin `"line"` descriptors
at the tick positions, drawn behind the data. `PROMPTS.md` mirrors the
instruction in its "System prompt" block, and `tests/charts-prompt.test.js`
locks the prompt content (the instruction phrases are present for every
level and kind, seeded topics keep it, and no `{{...}}` placeholder
survives the fill).

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

## Interactive teaching pilot (opt-in)

The existing `animath:"0.1"` player and its samples are unchanged. A new
`interactive:"0.1"` contract pilots a reactive, persistent, **qualitative**
Secondary Science water-cycle model with controls for solar energy, cooling
and droplet growth, five semantic tutor beats, a misconception check and
replayable session events. It is intentionally **not a weather forecast**.

Serve this repo over HTTP (as for the gallery) and open
[`player/interactive-demo.html`](player/interactive-demo.html). In an
existing page, include `player/interactive.css` and
`player/interactive.js`, then load the gold JSON from
`samples/interactive/secondary-science-water-cycle.json`:

```js
const { mount, createSession, validate } = require('@jjfwang/teachkit/interactive');
const problems = validate(interactiveSpec);
if (problems.length) throw new Error(problems.join('; '));
const controller = mount(containerElement, interactiveSpec); // browser DOM
controller.playBeat('condensation', 'tutor');
controller.setParameter('cooling', 80, 'student');
const snapshot = controller.getState();
const events = controller.getHistory(); // caller persists these if needed
controller.destroy();
```

`createSession(spec)` runs without the DOM for deterministic simulation and
tests. The new module uses no LLM at playback time and has no dependencies.
The library API does not currently store events or authorize live tutor
commands; the host must provide session storage and access control.
The complete design and future phases are in
[`docs/INTERACTIVE_TEACHING_ROADMAP.md`](docs/INTERACTIVE_TEACHING_ROADMAP.md).

### Registered multi-subject simulation engine

Use `@jjfwang/teachkit/simulations` in Node or the standalone browser script
`player/simulation-kit.js`. There are eight registered models with deterministic
parameters and visualizations (water cycle, fraction bars, uniform motion).
Open [the multi-subject demo](player/simulation-demo.html) to explore the three
gold samples and drive the returned controller with tutor commands. See
[SPEC.md](SPEC.md) for the strict versioned contract. This feature is
experimental; generic model expressions and arbitrary AI-generated code are
**not** accepted.

### Tutor beat/slide/speech synchronization adapter

The browser/Node module `@jjfwang/teachkit/tutor-bridge` maps visual
beat IDs to **specific slide IDs and speech cue IDs** in an immutable
manifest. `createTutorBridge(session,map,{clock})` accepts ordered commands
(`play`, `seek`, `pause`, `interrupt`, `resume`, `ask`, `parameter`,
`end`) and exposes state, student answers, speech progress and snapshots.
Duplicate/out-of-order commands do not alter the rendering state. Incorrect
checkpoints are flagged for adaptation after two attempts; there is no
repetitive automatic question loop. See
[`player/tutor-demo.html`](player/tutor-demo.html) and
`samples/simulations/water-cycle-anchor-map.json`.

**Integration boundary:** this module does not synthesize audio, persist
session history, authorize remote commands, or connect to Aceceed. The host
performs voice playback and slides presentation using the emitted beat IDs;
Teachkit controls the low-latency deterministic state contract only.

### Prepublication independent review (interactive assets)

`@jjfwang/teachkit/interactive-review` validates the trusted renderer's SVG,
strict simulation schema and teaching assertions **before** an asset can be
approved. `reviewAsset(spec,svg,validator,blueprint,{agent,human})` calls an
**injected external agent reviewer** and returns `approved`, `rejected` or
`human_required`. Automatic approval requires no deterministic errors, an
agent report covering scientific/curriculum/pedagogy/accessibility, confidence
at least 0.85, and zero findings. Reviewer unavailability, ambiguity or low
confidence escalates to a human rather than granting approval. Scientifically
failed reviews are rejected rather than overridden. Host controls LLM access,
reviewer independence/identity and human authorization. No agent runs in the
interactive playback loop. The gate does **not** replace pixel screenshot
validation; those checks require an external browser runner.

### Approved, syllabus-keyed persistent teaching materials

`@jjfwang/teachkit/approved-assets` publishes JSON/SVG/text assets under
`teaching/{curriculum}/{curriculumRevision}/{level}/{track}/{subject}/{topic}/{locale}/{objectivesHash}/{difficulty}/{assetRevision}`.
SHA-256 binds content and context into an immutable revision. Each approved
manifest lists per-file hashes and independent agent/human review evidence.
Production storage must implement `get`, immutable `put`, and an **atomic
compareAndSwap** pointer operation; `read` verifies every hash and rejects
missing/tampered/unapproved content. `rollback` atomically selects a previous
approved immutable revision. The Node-only `@jjfwang/teachkit/fs-assets`
adapter supplies durable single-host development/staging storage with
exclusive-file object writes and filesystem locks. For multi-server/AWS
production, inject S3/RDS/DynamoDB-backed storage and transactional CAS;
**the shipped in-memory test adapter is not durable**. All authorization and
reviewer identity checks must happen on the server. Never use student-identifying
data in shared content paths.


### Pre-generate, approve, store, then replay one interactive lesson

`@jjfwang/teachkit/interactive-service` wires the preparation and live
interfaces into one safe library boundary:

```js
const service = require('@jjfwang/teachkit/interactive-service');
const result = await service.prepareAndPublish({
  spec, blueprint, context, store: durableAdapter,
  reviewers: {agent: externalAgentReviewer, human: approvedHumanQueue},
  materials: {'anchors.json': JSON.stringify(beatAnchors), 'notes.md': notes}
});
if (result.status !== 'published') return result; // human_required or rejected
// Later, before the live session, load ONLY the previously approved revision.
const {controller, bridge, destroy} = await service.mountApproved({
  store: durableAdapter, context, container: stageElement
});
bridge?.command({sequence:1,type:'play',beatId:'observe'});
// End of lesson: destroy(); host also persists authorized event records.
```

`prepareAndPublish` runs review **before publication**. `mountApproved`
loads and hashes the stored manifest/spec, then mounts a synchronous,
deterministic simulation and an optional tutor bridge from `anchors.json`.
It does not require LLM inference or generation while students manipulate
controls. The host must supply authenticated real reviewers, authorized
commands, secure object storage and real slide/voice playback.

### Interactive coverage by syllabus

See the [reactive learning capability matrix](docs/INTERACTIVE_CAPABILITY_MATRIX.md):
8 registered interactive gold models for 8 distinct syllabus topics, spanning
Primary, Secondary and JC; the older fixed animation engine still covers
all 70 canonical syllabus topic slugs. Not every topic has a reactive model.
New demos include circuits, ideal gas, quadratic transformations,
transpiration and erosion. Use
`node generator/tooling/benchmark-interactive.js` for repeatable **Node-only**
per-beat model+SVG generation timing; real device paint/load must be tested separately.


### Pre-generate, approve, store, then replay one interactive lesson

`@jjfwang/teachkit/interactive-service` wires the preparation and live
interfaces into one safe library boundary:

```js
const service = require('@jjfwang/teachkit/interactive-service');
const result = await service.prepareAndPublish({
  spec, blueprint, context, store: durableAdapter,
  reviewers: {agent: externalAgentReviewer, human: approvedHumanQueue},
  materials: {'anchors.json': JSON.stringify(beatAnchors), 'notes.md': notes}
});
if (result.status !== 'published') return result; // human_required or rejected
// Later, before the live session, load ONLY the previously approved revision.
const {controller, bridge, destroy} = await service.mountApproved({
  store: durableAdapter, context, container: stageElement
});
bridge?.command({sequence:1,type:'play',beatId:'observe'});
// End of lesson: destroy(); host also persists authorized event records.
```

`prepareAndPublish` runs review **before publication**. `mountApproved`
loads and hashes the stored manifest/spec, then mounts a synchronous,
deterministic simulation and an optional tutor bridge from `anchors.json`.
It does not require LLM inference or generation while students manipulate
controls. The host must supply authenticated real reviewers, authorized
commands, secure object storage and real slide/voice playback.
