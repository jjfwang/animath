# Teachkit Interactive Teaching Roadmap — 2026-10-17

**Status:** Phase 1 pilot in progress under #797. Remaining phases are implementation work, not shipped product claims.

## Vision and design principles

Teachkit owns *validated, reusable teaching assets*: interactive models, animation timelines, diagrams, slides, practice items, presenter anchors and deterministic rendering. Aceceed owns session orchestration, adaptive instruction, student state, voice and access control. A student should predict → manipulate → observe → explain, not only watch an SVG video.

1. Keep the existing `animath:"0.1"` renderer, schema, samples and package imports backward compatible. Treat `interactive:"0.1"` as a **separate additive contract** until generalized capabilities are proven.
2. Separate the pedagogical model and science rules from rendering. No arbitrary JS execution/eval in model-supplied documents; allow only a known registry of validated deterministic simulators.
3. Generate heavy assets and validate **before** the live lesson. During teaching, commands update local state in milliseconds; never wait for generation or quality review to respond to a slider.
4. Persist immutable versioned artifacts by full curriculum hierarchy and model revision; preserve exact material/voice/slide beat references so replay is deterministic.
5. Agent review is the default. Escalate to an educator only if automatic gates cannot safely approve; no blocking review while a live session is running.
6. Use pedagogically meaningful transitions, accurate representations, accessible navigation and science-safe claims. A model's activity score is not a weather forecast.

## Reference interfaces

### Pre-generated interactive asset
```json
{
  "interactive": "0.1",
  "model": "water-cycle",
  "level": "secondary",
  "subject": "science",
  "topic": "water-cycle",
  "parameters": [
    {"id":"solar","label":"Solar energy","min":0,"max":100,"step":10,"default":60}
  ],
  "beats": [
    {"id":"overview","label":"Whole cycle","narration":"Follow one parcel of water through the cycle."}
  ]
}
```

The actual gold sample carries three parameters, five beats, a limitation statement and a comprehension check. The restricted pilot model is **not** a generic scientific formula evaluator. Future engine revisions introduce typed observable state, invariant checks, explicit simulation capability identifiers and safe declarative graph constraints.

### Live runtime
```js
const player = TeachkitInteractive.mount(element, approvedInteractiveSpec);
player.playBeat('condensation', 'tutor');
player.setParameter('cooling', 80, 'student');
player.answer(1, 'student');
const snapshot = player.getState();
const events = player.getHistory();
player.destroy();
```

Commands are synchronous and deterministic. `getHistory` returns a replay/analytics source, not a persistence substitute. A future version introduces `pauseForQuestion`, `seekBeat`, `highlight`, `resetBeat` and clock controls with explicit compatibility tests. Tutor commands must be checked by Aceceed authorization before crossing the session transport boundary.

## Implementation phases

| Phase | Priority | Core work | Exit gate |
|---|---|---|---|
| P1 Gold water-cycle model and interaction pilot | P0 | Build validated model spec and safe reactive evaluator; persistent whole-cycle visual, Secondary explanations, sliders, semantic beat controls, quiz and reset; preserve v0.1 | Testable model; tutor API; sample + demo; no changes to legacy samples |
| P2 Reusable simulation and manipulatives engine | P0 | Extract generic `simulation/registry`, typed parameters, domain invariant policies, semantic object graph, algebra/geometry/simulation tool APIs, graph and motion primitives, responsive layout | Three independently authored gold lessons with no bespoke renderer forks; deterministic replay |
| P3 Tutor/voice/slides orchestration | P1 | Semantic beat ID alignment across approved animation, slides and speech; clock and interruption policies; event bus `show/pause/seek/highlight/ask/answer`; student prediction gates | Exact beat/slide/speech anchor tested during speech interruption and correction; no blocking AI work in renderer |
| P4 Generation pipeline and quality gates | P1 | Shared objective/knowledge blueprint; typed author stages and repair; scientific-correctness and curriculum agent review, screenshot/pixel QA, misconception/label/legibility/ARIA reviews; failed/uncertain reviews escalate to human | Deterministic structural gate + independent agent review with evidence; only approved immutable revision delivered |
| P5 Durable assets, versioning and session observability | P1 | Content-addressed JSON, preview SVG, optional SVG/WebM clips, slide references and printable material in S3-compatible store; manifest metadata DB; curriculum & revision keys; replay logs | Identical content hash → identical playable asset; transactional publish, fallback, invalidation, retention/privacy policy |
| P6 Scale syllabus, accessibility and performance | P2 | Catalog of reusable visuals for primary/secondary/JC Math, Science, Geography; model capability matrix and gold benchmark; small-screen/touch/keyboard/reduced-motion; measurement and experiment design | Target coverage achieved on curated benchmarks; devices and accessibility validated; performance budget measured |

### Recommended deliverable breakdown

**P2:** safe declarative graph DSL; typed simulation registry; semantic object IDs; geometry/algebra pilot; content format converters and a 3-topic regression corpus.

**P3:** beat contract across materials; controller event types and auth; voice/speech timing anchors; stop/resume/prediction/adaptation; tested interruption recovery.

**P4:** shared lesson blueprint; science/curriculum fact gates with traceable provenance; human escalation queue; screenshot and geometry review (including text overflow on mobile); automated efficacy checks.

**P5:** manifest and artifact store; keyed generation idempotency; revisions and approvals; content-addressed export; retention and replay authorization.

**P6:** subject-specific capabilities and regression fixtures; browser matrix; student learning efficacy instrumented as attempts, prediction accuracy, misconception correction and exit-ticket transfer.

## Content persistence design (Aceceed-facing)

Storage path **must contain syllabus** and educational level, not just topic slug:

```
teaching/{curriculumId}/{curriculumRevision}/{level}/{track}/{subject}/{topic}/
  {assetRevision}/manifest.json
  {assetRevision}/interactive.json
  {assetRevision}/animation.json
  {assetRevision}/slides.json
  {assetRevision}/worksheet.json
  {assetRevision}/notes.json
  {assetRevision}/exit-ticket.json
  {assetRevision}/script.json
  {assetRevision}/renders/preview.svg
  {assetRevision}/renders/preview.webm   # optional
```

The manifest has `approvalStatus`, `approvedAt`, `reviewerType`, `sourceModel`, `promptVersion`, `simulationEngineVersion`, `sha256`, `locale`, `contentScope`, `objectivesHash`, `difficulty`, `beatMapping`, and references to the stored asset set. Production objects become immutable after publish. Changes create a new revision, re-run QA and atomically switch the manifest pointer. Paths are logical object keys, **not implemented local filesystem directories**.

Cache keys must include at least syllabus ID/revision, locale, level/track/subject/topic, desired objectives, difficulty, model schema/engine version, authoring prompt version and approved material revision. Student PII must not be part of shared asset keys. Personalized overlays should be separate session-specific state. The current `packCache` keyed by topic/level/subject is not sufficient for these requirements.

## Quality approval rules

- **Contract:** parse, version, finite bounded values, existing references, deterministic pure evaluation.
- **Science/curriculum:** phase-change accuracy and material conservation; differentiate invisible water vapour from droplets, condensation from rainfall. Substantiate models and assumptions; forbid unsupported quantitative/weather assertions.
- **Pedagogy:** relevant learning objectives; prediction before reveal; one misconception gate; level-correct vocabulary and explanation.
- **Visual/accessibility:** labels not clipped; contrast; keyboard and screen-reader affordances; responsive sizes; reduced motion; SVG/text export parity.
- **Runtime:** no LLM calls on manipulation; command authorization; event replay; interruption recoverability.
- **Approval:** reject on deterministic critical errors. Agent must return reasoned, recorded `approve/revise/uncertain`; `uncertain` or disagreement routes to human review, **before publication only**.

A 120-point heuristic rubric is valuable as a diagnostic, but is not a stand-alone evidence-based approval authority. Establish explicit blocker and threshold rules by sample-level evaluations and failure taxonomy.

## Performance and verification targets (proposed, not yet measured)

- Local control update target: p95 under **50 ms** on representative student devices.
- Initial embed load target: p95 under **2 s** on target school/mobile connection, excluding preparation generation.
- No network/model requests for a local beat/parameter change; no unbounded background timers.
- Full existing suite: `node --test "tests/*.test.js"` plus coverage; syntax check each edited JS; browser visual and accessibility checks on desktop and small mobile.
- Track learning outcome: prediction correctness, concept transfer/exit ticket, time to correction, session interruptions, generated artifact rejection rate, and student clarification events.

These are **acceptance targets**, not evidence of achieved latency.

## Rollout and rollback

Keep existing `AnimathPlayer.mount` unchanged. Interactive models load only when the separate feature route/API is explicitly requested, and unknown models fail closed. Roll out the approved Secondary water-cycle exemplar first, then gate by curriculum/topic cohort. Rollback means serving prior approved immutable content revision or switching to the existing static v0.1 animation; never regenerate synchronously as a fallback during teaching.

## Security considerations

Treat AI-authored specs as untrusted input. Reject arbitrary JavaScript, CSS expressions, URLs or HTML. Render text by `textContent`; only validated renderer-owned SVG template may use `innerHTML`. Server must authorize tutor commands against student session and audit critical events. Do not expose the LLM API key or teacher answer material to the learner view.

## Integration boundaries

Teachkit provides `getApprovedAsset(syllabusId, objectives)` (future), `mount`, `playBeat`, `setParameter`, `getState`, and deterministic event logs. Aceceed provides student identity, education policy, pedagogical progression, scheduling, live audio/speech, interaction authorization and material store orchestration. Voice emits semantic beat commands, **not arbitrary pixel coordinates**.

## Milestone tracking

- **#797**: implemented pilot work under review; phase P1.
- Follow-up issues: **P2 #799**, **P3 #800**, **P4 #801**, **P5 #802**, **P6 #803**. Do not treat a plan or an issue as implementation.
- Never merge a pilot without tests, independent review, and reproducible rendering evidence.
