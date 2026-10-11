# Contributing to animath

This repo is developed in small, reviewed slices (one issue → one PR → review → merge).
Contributions follow the same contract.

## Source of truth

1. `SPEC.md` — the animation spec contract. If code and spec disagree, the code is wrong.
   Never silently reinterpret the spec in code; if the spec itself looks wrong, implement
   to spec and open a docs issue.
2. `README.md` — documented behavior.
3. `SYLLABUS.md` — the topic taxonomy (PSLE → O/N-level → H2).

## Zero-dependency policy

Vanilla JS + SVG, no build step, no dependencies. Every module must run in both
Node (tests) and the browser (player/generator/web) unless documented otherwise —
follow the existing UMD pattern (`typeof module !== 'undefined'` export guard).

## The test gate

Every change passes all three before a PR opens:

1. `node --test "tests/*.test.js"` — the full suite, green. (Quoted glob: the
   bare `tests/` directory form fails on some Node builds.) This also validates
   every sample in `samples/` via `player/validate.js`.
2. `node --check <edited-file>.js` — every edited `.js` file must pass a syntax check.
3. Coverage — `node --test --experimental-test-coverage "tests/*.test.js"`: every
   new or changed line must be covered. Uncovered new code is not mergeable.
   Tests are `node:test` + `assert/strict`, zero dependencies.

## Geometry audit CLI

`node generator/audit.js <file...> | --all` runs the static and time-sampled
geometry audits from `generator/geometry.js` over sample files and prints
findings with their time bands (e.g. `[400-500ms]`). Exit codes: 0 clean,
1 findings, 2 usage/file error — so it is CI-able. Run it on any sample PR
before review.

## Sample conventions

- Hand-authored JSON in `samples/`, pretty-printed.
- `SPEC.md` verbs and step kinds only; unicode math only, no LaTeX — the
  validator rejects backslash commands. (KaTeX-rendered `latex` steps exist in
  shipped samples; author them the same way, never with raw TeX outside `latex`.)
- `validateSpec` must report zero errors for every new/changed sample.
- Register new samples in `samples/index.json` and `player/demo.html`.
- Move steps carry exactly the target kind's position fields: circle → `cx/cy`,
  rect/text → `x/y`.

## Branch / PR conventions

- One branch per PR: `laowang/issue-<n>-<slug>` (or any `laowang/*` branch).
- One issue = one PR = one merge. The PR body states `Closes #<n>`.
- State the user-visible value in one line (`User value: …`).
- Releases follow `RELEASING.md` (owner action; the registry publish needs
  `npm login`).

## Hard rule

Never commit `.github/workflows/` files — the CI integration lacks the
Workflows permission and will reject them. Docs, templates, and other
`.github/` content are fine.

## Adding a new subject

Subjects are a scattered enum: `SPEC.md`, `player/validate.js`, `SYLLABUS.md`,
`web/syllabus.js`, `generator/misconceptions.js`, and `samples/` all name
them independently. Follow this checklist end to end — in this order — so a
new subject lands with zero surprise test failures:

1. **`SPEC.md` first.** Add the subject to the `subject` enum table. SPEC is
   the highest authority: if code and spec disagree, the code is wrong.
2. **`player/validate.js` SUBJECTS** (line 13). Append the subject; the
   validator's set is the single source of truth the taxonomy tests derive
   from.
3. **`SYLLABUS.md`.** Add a section with the new subject's topic tables, and
   update the "Notes for the generator" line against `SPEC.md` §subject and
   SUBJECTS so it names the current set again.
4. **`web/syllabus.js`.** Add at least one track carrying the new subject —
   the picker must expose what the validator accepts, or the web UI can never
   pick it.
5. **`generator/misconceptions.js`.** Add misconception entries for the new
   topics. Optional: a generic line is the fallback, but a subject without
   entries reads hollow.
6. **A hand-authored sample.** Add at least one spec with the new subject and
   register it in `samples/index.json`. This is required: the per-subject
   sample-coverage test locks every SUBJECTS subject to ≥1 sample.
7. **Run the suite.** `tests/syllabus.test.js` and `tests/specs.test.js` derive
   the allowed/required subject set from `player/validate.js` SUBJECTS — if the
   checklist above was followed in full, the suite is green. A failure message
   names the exact checklist step it maps to.
