# Roadmap

Phased build plan. The 15-minute iteration loop works this list issue by
issue; items become GitHub issues (the umbrella is #1).

## P0 — Foundation (done, initial commit)

- [x] `SPEC.md` v0.1 contract
- [x] `SYLLABUS.md` topic taxonomy (primary / secondary / JC, math + science)
- [x] `PROMPTS.md` generator templates
- [x] `player/`: SVG renderer, validator, demo page
- [x] `generator/`: prompt builder + OpenAI-compatible client
- [x] `web/`: single-page app (topic picker, key field, generate, play)
- [x] `samples/`: 3 hand-authored specs (fractions, Pythagoras, photosynthesis)
- [x] `tests/`: zero-dep `node --test` validation suite

## R-1 — Sample packs (loop priority: coverage across the syllabus)

All five packs shipped: 69 hand-authored samples, 67/67 syllabus slugs covered.

- [x] Primary math pack: decimals, percentage, ratio, area, speed
- [x] Primary science pack: water cycle, human body systems, forces
- [x] Secondary E-Math pack: trigonometry, mensuration, probability
- [x] Secondary science pack: electricity, acids/bases, cells
- [x] JC pack: differentiation intro, vectors, electromagnetism

## R-2 — Player capabilities

- [x] KaTeX rendering (`latex` shape kind; unicode `text` keeps working) — issue #3
- [x] Filmstrip navigation (one labeled button per scene) — issue #95
- [x] Export: record a scene sequence to WebM via canvas capture — issue #506 (PRs #508 slice 1, #510 slice 2, #512 slice 3); #506 stays open pending end-to-end browser-download acceptance
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
- [x] Teacher rubric: 5-dimension quality check teachers run on generations — issue #111

## R-5 — Quality & docs

- [x] Headless render check in the loop (screenshot each sample per run) — 2026-10-09: shipped as the render-snapshot harness — tests/render-snapshot.test.js + tests/fixtures/render-snapshots.json + generator/tooling/gen-render-snapshots.js (issues #519, #521); fail-closed byte-determinism check of per-frame SVG strings on every suite run. Honest limit: SVG-level determinism, not pixel screenshots — no headless browser on the loop's VM and the repo is zero-dep.
- [x] CONTRIBUTING.md and issue templates — issue #125
- [x] Gallery page: all samples playable without an API key — issue #5
- [x] Static geometry audit: text overflow + label overlap check (generator/geometry.js) — issue #117
