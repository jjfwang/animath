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

One issue per pack; each pack is 4–6 hand-checked specs that validate clean
and play correctly in the demo page.

- [ ] Primary math pack: decimals, percentage, ratio, area, speed
- [ ] Primary science pack: water cycle, human body systems, forces
- [ ] Secondary E-Math pack: trigonometry, mensuration, probability
- [ ] Secondary science pack: electricity, acids/bases, cells
- [ ] JC pack: differentiation intro, vectors, electromagnetism

## R-2 — Player capabilities

- [ ] KaTeX rendering (`latex` shape kind; unicode `text` keeps working)
- [ ] Scene thumbnails / filmstrip navigation
- [ ] Export: record a scene sequence to WebM via canvas capture
- [ ] Keyboard shortcuts and reduced-motion support

## R-3 — Generator capabilities

- [ ] Problem mode: question in → animated worked solution out (prompt + UI)
- [ ] Misconception library: per-topic "wrong turn" beats the LLM must animate
- [ ] Spec repair pass: validator errors fed back to the LLM automatically
- [ ] Multi-model presets (OpenAI, Anthropic-via-proxy, local Ollama)

## R-4 — Teaching integration

- [ ] Embed API: `animath.embed(spec|topic)` for iframe use in lessons
- [ ] Aceceed live-teaching pilot: generate an explainer mid-lesson from the
      tutor's whiteboard context
- [ ] Teacher rubric: 5-dimension quality check teachers run on generations

## R-5 — Quality & docs

- [ ] Headless render check in the loop (screenshot each sample per run)
- [ ] CONTRIBUTING.md and issue templates
- [ ] Gallery page: all samples playable without an API key
