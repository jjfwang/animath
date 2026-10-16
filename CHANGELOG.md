# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release PRs add entries under `Unreleased`, then move them into a new dated
version section when the release ships.

## [Unreleased]

### Added

- Student notes and teacher script spec contracts and validators
  (`validateNotes` and `validateScript` in `player/validate.js`, with
  declarations in `player/validate.d.ts`): SPEC.md gains "Student notes
  spec" and "Teacher script spec" sections pinning the notes shape
  (objectives, definitions, mechanism steps, worked example, trap) and
  the script shape (timed segments with optional cue, questions, and
  watchFor fields, total timing 5..120 minutes), both sharing the
  material-header conventions (issue #762).

- End-to-end worksheet and exit-ticket generation in the pipeline
  (`generator/pipeline.js`): `generateWorksheet` and `generateExitTicket`
  run the same unpack -> author -> repair stages as `generateSlides`,
  authoring via `buildWorksheetPrompts` / `buildExitTicketPrompts` and
  repairing against `validateWorksheet` / `validateExitTicket`
  (`deps.validateWorksheet` / `deps.validateExitTicket`, else
  `deps.validate`, else the built-in `player/validate.js` validators).
  The exports map gains four subpaths: `@jjfwang/teachkit/worksheet` and
  `@jjfwang/teachkit/exit-ticket` (the pipeline module under
  material-named subpaths) and `@jjfwang/teachkit/worksheet-prompt` and
  `@jjfwang/teachkit/exit-ticket-prompt` (the prompt builders);
  `@jjfwang/teachkit/pipeline` now also exposes `generateWorksheet` and
  `generateExitTicket` (issue #760).

- Printable worksheet and exit-ticket renderer (`player/printable.js`,
  subpath `@jjfwang/teachkit/printable`): `renderWorksheet` /
  `renderExitTicket` produce student sheets (prompts and choice texts
  only — teacher content is structurally absent, not flagged off) and
  `renderWorksheetAnswerKey` / `renderExitTicketAnswerKey` produce the
  teacher keys (correct answers, explanations, feedback, misconceptions).
  Every render validates first and throws on an invalid spec; all spec
  text is HTML-escaped. Ships with `player/printable.css` (teacher key
  starts a new printed page), a hand-authored `player/printable.d.ts`,
  and `player/printable-demo.html` rendering both gold samples
  (issue #758).

- Worksheet and exit-ticket prompt builders (`generator/build_worksheet_prompt.js`
  `buildWorksheetPrompts` and `generator/build_exit_ticket_prompt.js`
  `buildExitTicketPrompts`, each with a hand-authored `.d.ts` sibling):
  slide-style builders that author practice worksheets (misconception-built
  distractors, a per-question `explanation` answer key) and short formative
  exit tickets (exactly 3-5 questions, per-answer `feedback` keyed to the
  misconception), each embedding a trimmed water-cycle exemplar. Gold
  samples ship at `samples/worksheets/primary-science-water-cycle.json`
  and `samples/tickets/primary-science-water-cycle.json` (issue #756).


- End-to-end slide-deck generation in the pipeline (`generator/pipeline.js`):
  `generateSlides` runs the same unpack -> author -> repair stages as
  `generateAnimation`, but authors a teaching slide deck via
  `buildSlidePrompts` and repairs it against `validateSlides`
  (`deps.validateSlides`, else `deps.validate`, else the built-in
  `player/validate.js` validator). The exports map gains two subpaths:
  `@jjfwang/teachkit/slides` (the pipeline module under a slides-named
  subpath, exposing `generateAnimation` and `generateSlides`) and
  `@jjfwang/teachkit/slides-prompt` (`buildSlidePrompts` from
  `generator/build_slides_prompt.js`); `@jjfwang/teachkit/pipeline` now also
  exposes `generateSlides` (issue #747).

### Changed

- Package renamed `@jjfwang/animath` -> `@jjfwang/teachkit` and the
  repository URL moved to github.com/jjfwang/teachkit, following the repo
  rename (issue #749). The spec-format key `"animath": "0.1"` and the
  `Animath*` browser globals are unchanged. npm publish of the new name
  and deprecation of the old name happen at the next release cut.

## [0.2.0-beta.1] - 2026-10-16

Second registry beta of the animath library (`@jjfwang/animath`), published
under the `beta` dist-tag. Ships the generation engine on top of the beta.0
library surface: the automatic unpack -> author -> repair pipeline with
holistic staging for cycles and systems, the completed 19-subpath exports
map, the narrowed player public API, and the subject-generic validator
(any non-empty subject string, no hard-coded subject set).

### Added

- Package test scripts: `npm test` and `npm run test:coverage` now wrap the documented test-gate commands (`node --test "tests/*.test.js"` and the same command with `--experimental-test-coverage`), so consumers no longer need to memorize the raw commands from CONTRIBUTING.md (issue #738).

- Package exports map gains the `@jjfwang/animath/audit-samples` require
  subpath (`auditSampleFile` / `auditAllSamples`, from
  `generator/tooling/audit-samples.js`): the module already shipped in the
  tarball with a hand-authored `.d.ts` sibling, and is now reachable by its
  subpath name (issue #726).

- Package exports map gains three require subpaths for the WebM-export
  modules — `@jjfwang/animath/export-frames`, `@jjfwang/animath/export-record`
  and `@jjfwang/animath/export-ui`: all three already shipped in the tarball
  and are documented in the README and SPEC.md, and are now reachable by their
  subpath names, each with a hand-authored `.d.ts` sibling (issue #722).

- CLI machinery split out of the library modules (issue #709): the geometry
  audit CLI entry (usage, `parseArgs`, `main`, the `require.main` guard) moves
  from `generator/audit.js` to `generator/tooling/audit-cli.js` — run it via
  `node generator/tooling/audit-cli.js`; the Node-only sample walkers
  `auditSampleFile`/`auditAllSamples` move from `generator/geometry.js` to
  `generator/tooling/audit-samples.js`. The library subpaths now export only
  programmatic APIs, with hand-authored `.d.ts` files for the two new tooling
  modules, and the exports map gains `@jjfwang/animath/audit-cli`.

- Package exports map gains two require subpaths — `@jjfwang/animath/pipeline`
  (the end-to-end generate pipeline, `generateAnimation`, issue #693) and
  `@jjfwang/animath/unpack` (the unpack layer, `unpackTopic`, issue #685):
  both modules already shipped in the tarball with hand-authored `.d.ts`
  siblings, and are now reachable by their documented subpath names
  (issue #701).

- Staging strategy in the generate pipeline: the unpacker classifies a
  topic's shape (sequence, cycle, or system) and the author prompt stages
  scenes accordingly — a cycle (e.g. the water cycle) is staged as ONE
  holistic scene showing the whole loop at once with animated flows, instead
  of one scene per transition. The validator now accepts 1..8 scenes
  (SPEC.md updated).

- Generator unpack layer (`generator/unpack.js`): a topic is unpacked into
  ordered state transitions before authoring, so the generated scenes follow
  the topic's actual mechanism instead of a free-form draft (issue #685).
- Taste transfer in the author prompt: a trimmed hand-authored water-cycle
  exemplar plus five quality gates (label placement in clear space, per-scene
  caption, explain fields on key parts, emphasize on the mechanism beat, the
  misconception wrong turn played out visually) — bringing generated specs up
  to the hand-authored quality bar (issue #691).
- End-to-end generate pipeline (`generator/pipeline.js`): runs the
  unpack -> author -> repair stages automatically — one entry point that takes
  a topic and returns a validated animation spec; the web UI is unchanged
  (issue #693).
- Per-transition misconception beats: misconception-bank entries can name the
  unpack transition where the wrong turn plays out (matched against transition
  names), so the wrong-turn beat lands on its own transition's scene instead
  of anywhere in the spec (issue #695).

- End-to-end add-a-subject checklist in CONTRIBUTING.md covering the SPEC.md
  subject enum, `player/validate.js` SUBJECTS, the SYLLABUS.md section, the
  web/syllabus.js track, the generator misconception-bank entries, and the
  hand-authored sample + `samples/index.json` registration (issue #669).
- Misconception bank gains Slice 6: geography (erosion, plate-tectonics,
  weather-climate, grounded in the samples' misconception beats) plus the
  documented per-subject slice pattern; geography specs now earn the full
  wrong-turn-marker rubric check instead of the skip (issue #668).

### Changed

- RELEASING.md no longer claims no release exists: it records the first
  release (`0.2.0-beta.0`, published 2026-10-11, tag `v0.2.0-beta.0`) as
  shipped, marks the README registry-install follow-up (Step 8) done, and
  documents the prerelease dist-tag wrinkle in the publish/verify steps
  (`npm publish --tag beta`; consumers track with
  `npm install @jjfwang/animath@beta`) (issue #740).
- Validator no longer hard-codes the admitted subject set: `validateSpec`
  now accepts any non-empty `subject` string (SPEC.md updated), so library
  consumers can generate animations for any school subject, not only
  math/science/geography. `SUBJECTS` remains exported as the syllabus-known
  list for gallery/coverage (issue #734).
- Package `engines.node` floor rises from Node 16 to Node 18, because the
  `llm-client` subpath uses the global `fetch` (Node 18+); Node 16 consumers
  of that subpath previously hit "fetch is not defined" (issue #735).
- README "Install as a library" leads with the live registry command
  (`npm install @jjfwang/animath`), notes the beta pin
  (`npm install @jjfwang/animath@beta`), and keeps the git source fallback in
  one sentence; pending "once published" language removed (issue #666).
- User-facing language made subject-neutral: the package.json description and
  the web/index.html title and tagline (issue #670).
- `player/validate.js` exports SUBJECTS as the single source of truth for the
  allowed subject set; `tests/specs.test.js` now requires every validator
  subject to have sample coverage across levels (issue #671).
- `generator/build_prompt.js` throws visibly on a missing subject instead of
  silently defaulting to 'math' (issue #669).
- Gallery subject filter options now derive from `player/validate.js` SUBJECTS
  (Geography selectable in the sample gallery; hardcoded Math/Science options
  retained as fallback) (issue #679).
- `generator/build_prompt.js` accepts `opts.transitions`: one generated scene
  per unpacked transition, listed as numbered lines in the user message;
  absent or empty transitions leave the output byte-identical (issue #687).
- `player.version` and the web embed's `version` now derive from the
  `package.json` version (single source of truth) via the new
  `node generator/tooling/regen-version.js`, locked by `tests/version.test.js`
  — both were hardcoded `0.1` while the package was at `0.2.0-beta.0`
  (issue #706). The `0.1` in `player/validate.js` is the animath spec format
  version and is intentionally unchanged.
- Player public API narrowed: `player/player.js` now exports exactly
  `mount`, `version`, and `internals` — the 19 former top-level helper
  exports remain reachable via `player.internals` and are marked internal
  in `player/player.d.ts`, so consumers should depend only on
  `mount`/`version` (issue #707).
- `generator/audit.js` no longer requires `fs` or `path` at module load
  and no longer touches `__dirname` at load time: the Node-only functions
  (`readJson`, `manifestFiles`, `loadTriageVerdicts`, and the CLI `run`
  path) lazy-require the builtins they need, the triage-verdicts default
  path is computed lazily inside `loadTriageVerdicts`, and a pure
  separator-tolerant `basenameOf` replaces `path.basename` in the pure
  helpers, so the module loads in browser bundles (issues #708, #718).
- Repair loop default cap raised from 2 to 3 passes, locked in with tests
  (issue #689).

### Fixed

- Generator author prompt hard rule 5 now lists all eight validator shape
  kinds, including `sector` with its descriptor fields (`cx`, `cy`, `r`,
  `startAngle`, `endAngle`) and the not-moveable note, so generated
  pie-chart specs can use first-class sector descriptors; the `PROMPTS.md`
  mirror was regenerated by the same change (issue #730).

## [0.2.0-beta.0] - 2026-10-12

First registry beta of the animath library (`@jjfwang/animath`), published
under the `beta` dist-tag. Ships everything on main since 0.1.0: the
subject-agnostic generator prompt, Geography as a first-class subject (3
mechanism-first samples, 72 samples / 70 syllabus slugs total), the
measure-rubric-bands tooling, the scrub-slider fix, and the completed
test-coverage programme (1015 tests, ~99.9% lines).

### Added

- README "Install as a library" documents the ESM consumption pattern
  (default-import interop for the CJS+UMD charts entry; named imports are not
  detected by Node's ESM loader). `tests/esm-charts.test.js` runs a real ESM
  script importing the charts entry to prove the documented pattern works.

## [0.1.0] - 2026-10-11

The initial library release: animath becomes an installable npm package
(`@jjfwang/animath`), installable via `npm install github:jjfwang/animath`
(registry publish pending).

### Added

- `package.json` with name, version, and a 12-entry exports map
  (`.`, `./build-prompt`, `./charts`, `./geometry`, `./rubric`, `./audit`,
  `./misconceptions`, `./llm-client`, `./player`, `./player-validate`,
  `./embed`, `./package.json`) plus a `files` list shipping `generator/`,
  `player/`, `web/embed.js`, `web/embed.d.ts`, `README.md`, `CHANGELOG.md`,
  `LICENSE`, `PROMPTS.md`, and `SPEC.md`.
- Hand-authored TypeScript type definitions (10 `.d.ts` siblings) covering
  every exports-map subpath, exposed through the top-level `types` field.
- README "Install as a library" section documenting the install routes and
  the Node `>=16` engine requirement.
