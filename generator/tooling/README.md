# generator/tooling

Regeneration scripts for baked data in the generator. Nothing here is a
runtime dependency — these scripts run on a maintainer machine and their
outputs are committed to the repo.

## gen-glyph-table.py (issue #376)

Measures DejaVu Sans glyph advances with PIL and bakes the per-glyph
advance table used by the geometry audit's width model
(`generator/geometry.js`, `GLYPH_ADVANCES`).

Requirements: Python 3, PIL (Pillow), DejaVu Sans installed at
`/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` (edit `FONT_PATH` in
the script if yours lives elsewhere).

What it does (from the repo root):

    python3 generator/tooling/gen-glyph-table.py > /tmp/glyph-table.inc.js

1. Gathers the glyph corpus: printable ASCII (U+0020–U+007E) plus every
   non-ASCII code point appearing in `samples/*.json` text/tex fields.
2. Measures each glyph's advance at 1000px with PIL, expressed as a
   fraction of the font size (4 decimals). Glyphs missing from the font
   are left out — `geometry.js` falls back to the old 0.6 estimate for
   them.
3. Prints the `var GLYPH_ADVANCES = { ... };` literal: paste it over the
   GENERATED block in `generator/geometry.js` (keep the surrounding
   comments and the `advanceOf`/`widthOf` functions).
4. Writes `tests/fixtures/widths.json`: PIL-measured (kerned) widths for
   every distinct sample label, used by `tests/geometry.test.js` to prove
   the model beats the old 0.6 average and stays conservative.

Then re-run the suite: `node --test "tests/*.test.js"`. The width-model
tests assert the documented invariants (mean abs error under half the old
model's; no underestimate beyond `WIDTH_MARGIN_PX`); if a regenerated
table breaks them, the table — not the tests — is wrong.

## gen-render-snapshots.js (issue #519)

Renders every frame of every scene of every sample at a 1fps stride and
bakes sha256 hashes of the resulting SVG into
`tests/fixtures/render-snapshots.json`, locking per-frame SVG determinism
across all samples.

Requirements: Node, zero dependencies.

What it does (from the repo root):

    node generator/tooling/gen-render-snapshots.js

1. Iterates `samples/*.json` except `index.json`; for each scene renders
   `renderFrame(spec, sceneIdx, frameMs(i, 1))` via `player/export-frames.js`
   (the DOM-free deterministic frame contract) and sha256-hashes each
   frame's SVG.
2. Writes `tests/fixtures/render-snapshots.json` shaped
   `{ sampleBasename: { sceneId: [hashes...] } }` and prints a summary line
   (samples, scenes, frames — currently 69 / 332 / 3070).

Then re-run the suite: `node --test "tests/*.test.js"`. The snapshot test
(`tests/render-snapshot.test.js`) fails closed: it asserts the manifest's
sample/scene keys match the on-disk `samples/` listing exactly, then for
every scene renders each frame twice — asserting the two renders are
byte-identical (the determinism guard) — and asserts each hash equals the
manifest entry. The manifest is never regenerated implicitly; a missing
sample/scene, a missing frame, or any render-output change fails the suite.

Change-then-regenerate loop: edit the renderer (or a sample), watch the
snapshot test fail, re-run the script to adopt the new hashes deliberately,
and commit the regenerated manifest. Sample-count drift is intentional:
adding a sample or scene fails the test until you regen.

Honest limits: the manifest samples at 1fps, not the player's 30fps live
stride — a full-30fps audit is offline (CI/maintainer) work; the 1fps
manifest costs ~1s of suite time for render+hash x2 (3070 frames). The
regen script itself is not covered by the test suite (same precedent as
`gen-glyph-table.py`); its acceptance is the demonstrated
change-fails/regen-passes loop plus review reading the script against the
test's consumption.

## build-data-graphs-charts.js (issue #610)

Provenance for the chart geometry baked into
`samples/primary-math-data-graphs.json`: the chart toolkit
`generator/charts.js` ships with its first adopted consumers in that
sample. This script replays the toolkit calls for the literal inputs and
prints the resulting descriptor fragments, so the baked values are
auditable without reading the compacted sample JSON.

Requirements: Node, zero dependencies.

What it does (from the repo root):

    node generator/tooling/build-data-graphs-charts.js

1. Prints the s1 favourite-fruit pie descriptors: `pieSectors` output for
   the 6/3/3 vote split, pie centred at (300,330) with radius 150
   (startAngle 0 = east, clockwise), emitted as the `wApples`,
   `wBananas`, `wGrapes` sector shapes.
2. Prints the s3 favourite-sport bar descriptors: `barLayout` move-to
   targets for the soccer/badminton/swimming values on the
   x=135/y=280/w=360/h=130 plot rect (gap 5/12 verbatim); the chart
   geometry lives in the move-step `to` targets — the static rects are
   the h=0 initial state.
3. Prints the s4 shop-B sales axis ticks: `axisTicks(0, 200, 3)` yields
   [0,100,200], carried by the `t0B`/`t100B`/`t200B` text labels. The s4
   axis-A ticks ([0,25,50]) stay hand-authored — `axisTicks(0, 50, n)`
   cannot reproduce them without a visual change (issue #610 scope
   exclusion).

Then re-run the suite: `node --test "tests/*.test.js"`. The adoption
test (`tests/charts-adoption.test.js`) asserts the same equality
independently of this script — it requires `generator/charts.js`
directly and compares the toolkit outputs against the in-sample
descriptors, so a drifted sample fails the test even if the script
prints the wrong values.

Honest limits: the script prints descriptor fragments to stdout — it
does not rewrite the sample. Like `gen-render-snapshots.js` (issue
#519 precedent), the script itself is not covered by the test suite;
its acceptance is review reading it against the test's consumption.

## regen-prompt-mirror.js (issue #620)
Regenerates the PROMPTS.md "## System prompt" fenced block from the
evaluated SYSTEM_TEMPLATE in `generator/build_prompt.js`, spliced in
byte-for-byte. The block is locked to the template by
`tests/prompt-mirror.test.js` (issue #618): if the template changes, the
doc is regenerated from it — never hand-edited (issue #619's lock).

Requirements: Node, zero dependencies.

What it does (from the repo root):

    node generator/tooling/regen-prompt-mirror.js

1. Reads the evaluated SYSTEM_TEMPLATE (require from the repo root, no
   deps) and locates the fenced block in PROMPTS.md between the exact
   markers the prompt-mirror test parses (`## System prompt\n\n` + fence
   ... first closing fence), so the script and the test agree on the
   block boundaries.
2. Splices the template in byte-for-byte — no added trailing newline,
   no whitespace drift. The file is rewritten only when the block
   changed; on a clean mirror the run is a no-op and prints one summary
   line.
3. Fails closed (non-zero exit, clear message) when the markers are
   missing, or when the template itself contains a fence line (which
   would make the block end ambiguous) — it never writes garbage.

Then re-run the suite: `node --test "tests/*.test.js"`. The prompt-mirror
tests assert the block stays byte-identical to the evaluated template and
exercise the script itself: the pure replacement function
`regenPromptMirror(doc, template)` (string-in/string-out) is covered for
replace, idempotence, missing-marker, and fence-ambiguity cases, and the
`run()`/`cli()` path is covered via temp-file round-trips — every new
line is covered, unlike `gen-render-snapshots.js`, whose "not covered"
precedent issue #620 explicitly overrides for this script.

Round-trip guarantee: on a clean mirror the script is a no-op; on a
drifted block it restores byte-identity. The demonstrated acceptance is
the covered suite plus review reading the script against the test's
markers. Like the other scripts here, this is maintainer-side: it never
runs as part of the app.

## regen-version.js (issue #706)

Regenerates the hardcoded `version` literals in the UMD exports of
`player/player.js` and `web/embed.js` from the `package.json` version. A
runtime `require('../package.json')` is impossible in the browser and the
repo has a zero-build-step rule, so the version is baked in by this
maintainer-side script and locked by `tests/version.test.js` — if either
export drifts from `package.json`, the suite fails.

Requirements: Node, zero dependencies.

What it does (from the repo root):

    node generator/tooling/regen-version.js

1. Reads the `version` from `package.json`.
2. In each of `player/player.js` and `web/embed.js`, replaces the single
   `version: '<literal>'` in the exported api object with
   `version: '<package.json version>'`. A file is rewritten only when its
   literal changed; on a clean mirror the run is a no-op and prints one
   summary line.
3. Fails closed (non-zero exit, clear message) when a source has no version
   literal, has more than one (ambiguous which is the export), or the
   version is empty, not a string, or contains a quote or backslash.

Then re-run the suite: `node --test "tests/*.test.js"`. The version tests
assert both runtime exports equal `pkg.version` and exercise the script
itself: the pure replacement function `regenVersion(src, version)`
(string-in/string-out) is covered for replace, idempotence, missing,
ambiguous, and invalid-version cases, and the `run()`/`cli()`/`launch()`
paths are covered via temp-file round-trips — every new line is covered,
following the issue #620 precedent set by `regen-prompt-mirror.js`.

Release procedure: bump `package.json`, run this script, run the suite, and
commit the regenerated literals — never hand-edit them.

Scope note: the `0.1` enforced by `player/validate.js` is the animath spec
format version, not the package version, and is intentionally untouched.

## measure-rubric-bands.js (issue #663)

Re-derives the "MEASURED BANDS" numbers documented in `generator/rubric.js`
live from `samples/*.json` (except `index.json`) — the corpus the rubric's
constants were fitted to. Re-run it whenever samples are added, removed, or
edited, and update the rubric's comment and constants from its output when
a band genuinely shifts.

Requirements: Node, zero dependencies.

What it does (from the repo root):

    node generator/tooling/measure-rubric-bands.js

1. Scans every sample: scene `duration_ms` values; consecutive `at_ms`
   gaps per scene (numeric finite values sorted ascending, differenced —
   the same construction `scorePacing` uses); scene counts; caption
   lengths; per-size-tier text char maxima (a missing/non-numeric size is
   scored as size 24, mirroring `textBudget`; only `show` steps are
   scanned, like the canvas-bounds dimension); latex `tex` maxima; the
   kind `"problem"` count; and the wrong-turn marker match rate over
   topics that resolve via the shared `generator/build_prompt.js`
   `misconceptionFor` lookup (the marker regex must stay byte-identical
   to `WRONG_TURN_RE` in `generator/rubric.js`).
2. Prints the derivation as JSON: `durationMs` / `stepGapMs` /
   `sceneCount` / `captions` bands (min/max plus nearest-rank p5/p95),
   `textTierMaxChars` per tier, `latexTexMaxChars`, `kindProblem`,
   `topicsResolving`, `wrongTurnMatches`. Null bands on an empty corpus
   (a samples dir holding only `index.json`) instead of a throw.

Then re-run the suite: `node --test "tests/*.test.js"`. The lock test
(`tests/tooling-bands.test.js`) requires the script's `measure()` directly
(no subprocess) and asserts each rubric constant equals the live
measurement (`MIN_DURATION`/`MAX_DURATION` vs the duration min/max,
`MAX_GAP` vs the gap max, `STAGE_MS` vs the gap p95) and every char budget
sits above its measured maximum; it also runs the CLI and asserts its
JSON output matches `measure()` exactly, and exercises the script's
guard branches (index.json / non-json exclusion, kind `"problem"`,
sizeless text, a resolving-but-unmarked topic, an empty corpus) against
temp fixture dirs. When a band shifts, update the "MEASURED BANDS"
comment in `generator/rubric.js` and change only the constants the
measurement genuinely moved — never the scoring-logic shape. The budgets
are rounded up from the measured maxima (e.g. the `<=22` tier's measured
max of 72 became a budget of 80).

Round-trip guarantee: on an unchanged corpus the script prints the numbers
already documented and the lock test passes; on a drifted corpus the lock
test fails until the rubric is re-derived from the script's output.

## audit-verdicts.json — triage-verdict records (issue #495)

`generator/audit-verdicts.json` records human-triage verdicts for genuine
geometry-audit findings that were verified (e.g. by PIL-rendered inspection)
to be acceptable as-is — so they stop re-surfacing as genuine on every
`--all` run instead of being fixed.

Record format (an array of objects; all seven fields are required strings):

    { "file": "secondary-e-trigonometry.json", "scene": "s1",
      "label": "labHyp", "shape": "hyp",
      "verdict": "deliberate-placement",
      "evidence": "PIL render: label deliberately set against the hypotenuse",
      "date": "2026-10-09" }

`verdict` is one of `deliberate-placement` (the overlap is real but intended)
or `box-model-artifact` (the audit's text-box model flags a graze with no
visible overlap on the rendered frame). `file` is the sample basename;
`scene` is the scene id; `label`/`shape` are the two ids from the finding's
`"<L> collides with <R>"` detail.

Matching: a genuine finding whose `(file, scene, label, shape)` matches a
record moves into the `triage-verified` section of the report and no longer
counts as genuine (triage-verified lines do not trigger exit 1). The matcher
only parses the `collides with` detail phrasing; findings with other phrasing
never match. The records file lives next to `generator/audit.js` so `--dir`
variants still load it.

Adding a record (workflow): new records only via issue -> PR -> review, each
citing the triage evidence (what was inspected, what was seen). Only record a
finding that current `node generator/audit.js --all` still lists as genuine —
a seed that no longer surfaces gets no record. Removing a record (or editing
its key fields) makes the line genuine again on the next run.

Fail-closed: if the file is unreadable, malformed, or holds an unknown
verdict, the CLI exits 2 with a clear message rather than silently ignoring
the records.
