# Roadmap

Phased build plan. The 15-minute iteration loop works this list issue by
issue; items become GitHub issues (the umbrella is #1).

## P0 — Foundation (done, initial commit)

- [x] `SPEC.md` v0.1 contract
- [x] `SYLLABUS.md` topic taxonomy (primary / secondary / JC, math + science, plus Primary Geography (PSLE) — the #644 proof subject; Languages/Literature out of scope)
- [x] `PROMPTS.md` generator templates
- [x] `player/`: SVG renderer, validator, demo page
- [x] `generator/`: prompt builder + OpenAI-compatible client
- [x] `web/`: single-page app (topic picker, key field, generate, play)
- [x] `samples/`: 3 hand-authored specs (fractions, Pythagoras, photosynthesis)
- [x] `tests/`: zero-dep `node --test` validation suite

## R-1 — Sample packs (loop priority: coverage across the syllabus)

All five packs shipped: 72 hand-authored samples, 70/70 syllabus slugs covered — including the Primary geography proof set from #644 (erosion, plate-tectonics, weather-climate). Languages and Literature stay out of #644's scope.

- [x] Primary math pack: decimals, percentage, ratio, area, speed
- [x] Primary science pack: water cycle, human body systems, forces
- [x] Secondary E-Math pack: trigonometry, mensuration, probability
- [x] Secondary science pack: electricity, acids/bases, cells
- [x] JC pack: differentiation intro, vectors, electromagnetism

## R-2 — Player capabilities

- [x] KaTeX rendering (`latex` shape kind; unicode `text` keeps working) — issue #3
- [x] Filmstrip navigation (one labeled button per scene) — issue #95
- [x] Export: record a scene sequence to WebM via canvas capture — issue #506 (PRs #508 slice 1, #510 slice 2, #512 slice 3); wired into the generator web app (issue #602, PR #603) and the sample gallery (issue #604, PR #605); #506 stays open pending end-to-end browser-download acceptance
- [x] Keyboard shortcuts and reduced-motion support — issue #93

## R-3 — Generator capabilities

- [x] Problem mode: question in → animated worked solution out (prompt + UI, shipped in the initial web UI + PROMPTS.md rule 7)
- [x] Misconception library: per-topic "wrong turn" beats the LLM must animate (67 seed entries across all bands, issues #101 #103 #105 #107 #109)
- [x] Spec repair pass: validator errors fed back to the LLM automatically — issue #27
- [x] Multi-model presets (OpenAI, Anthropic-via-proxy, local Ollama) — issue #99

## R-4 — Teaching integration

- [x] Embed API: `AnimathEmbed.mount(container, specOrSlug, opts)` for iframe use in lessons — issue #97
- [ ] Aceceed live-teaching pilot: generate an explainer mid-lesson from the
      tutor's whiteboard context (owner activity — real learners needed)
- [x] Teacher rubric: 6-dimension (0-120) quality score for generated specs, surfaced in the generator web app score panel — issue #111

## R-5 — Quality & docs

- [x] Headless render check in the loop (screenshot each sample per run) — 2026-10-09: shipped as the render-snapshot harness — tests/render-snapshot.test.js + tests/fixtures/render-snapshots.json + generator/tooling/gen-render-snapshots.js (issues #519, #521); fail-closed byte-determinism check of per-frame SVG strings on every suite run. Honest limit: SVG-level determinism, not pixel screenshots — no headless browser on the loop's VM and the repo is zero-dep.
- [x] CONTRIBUTING.md and issue templates — issue #125
- [x] Gallery page: all samples playable without an API key — issue #5
- [x] Static geometry audit: text overflow + label overlap check (generator/geometry.js) — issue #117

## Interactive teaching expansion (experimental, 2026-10-17)

The static `animath:0.1` player and 70 canonical syllabus topics remain valid.
The additive interactive work is tracked in #797 (pilot), #799 (registered
models), #800 (tutor/voice/slide anchor contract), #801 (agent/human
prepublication quality gate), #802 (versioned approved assets), and #803
(subject expansion). See `docs/INTERACTIVE_TEACHING_ROADMAP.md` and
`docs/INTERACTIVE_CAPABILITY_MATRIX.md`. This is not marked production-ready
until full CI/coverage/browser verification, host storage and independent
review pass. Current **reactive** gold-syllabus coverage is 8 of 70 topics.
