# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release PRs add entries under `Unreleased`, then move them into a new dated
version section when the release ships.

## [Unreleased]

### Added

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
