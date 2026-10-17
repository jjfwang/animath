# Interactive Syllabus Capability Matrix — 2026-10-17

This is a **verified inventory**, not a claim of universal animation coverage.

## Registered reactive models

| School band | Subject/track | Syllabus topic slug | Registered model | Output and student manipulation |
|---|---|---|---|---|
| Primary | Math | `fractions` | `fraction-bars` | Shade numerator/denominator; model validates one whole |
| Primary | Science | `plant-systems` | `transpiration` | Illustrative light, wind and humidity effects |
| Primary | Geography | `erosion` | `erosion` | Conceptual energy/resistance relation |
| Primary | Science | `water-cycle` | `water-cycle` | Vapour supply, cooling, droplet growth mechanisms |
| Secondary | Physics | `phys-kinematics` | `uniform-motion` | Constant speed, elapsed time and displacement magnitude |
| Secondary | Physics | `phys-electricity` | `ohms-law` | Current/voltage/resistance/power for an ideal ohmic resistor |
| JC | H2 Physics | `h2-thermal` | `ideal-gas` | Ideal gas pressure as Kelvin temperature/volume vary |
| JC | H2 Mathematics | `h2-functions-graphs` | `quadratic-curve` | Vertex, curvature and graph transformation |

**Current coverage = 8 distinct canonical syllabus topic slugs out of 70 in `SYLLABUS.md` (about 11.4%).**
All 70 topics still have legacy `animath:"0.1"` animation coverage; only the **eight listed topics** have the v0.2 *reactive* model exemplars. The experimental Secondary water-cycle interactive v0.1 lesson is a non-canonical extension; it is not counted as a separate MOE syllabus topic. The registered v0.2 water-cycle gold model correctly targets Primary Science.

A model may be reusable for other related topics, but doing so requires a validated pedagogical lesson, not an unsupported claim that one renderer implements every topic.

## Verification matrix

| Gate | Current automation | Remaining verification |
|---|---|---|
| Strict spec and bounded parameters | `tests/simulation-kit.test.js`, `tests/simulation-expansion.test.js` | Full Node suite |
| Model mathematical/scientific invariants | Eight gold samples and domain tests | Independent science reviewer/teacher check |
| Semantic tutor/slide/speech cue alignment | `tests/tutor-bridge.test.js`, water-cycle anchor manifest | Host real audio and slides integration; interruptions on real devices |
| Agent approval | `tests/interactive-review.test.js` with stubbed reviewers | Real independent model provider and human escalation queue |
| Approval and persistent revision | `tests/approved-assets.test.js`, `tests/fs-object-store.test.js` | Production S3 + DB CAS, secrets, access policies |
| Live parameter-to-SVG latency | `node generator/tooling/benchmark-interactive.js` | Browser paint p95 <50 ms on actual target phones |
| Initial embed and network | No device benchmark in this PR | p95 <2 s measured on school/mobile connection |
| Keyboard navigation | Native labelled sliders and buttons in demo | Browser automated keyboard/focus cycle on iOS/Android/web |
| Screen readers and low vision | Semantic text and SVG `aria-label` | VoiceOver/TalkBack/desktop assistive testing |
| Reduced motion | CSS media query | Browser matrix and high-contrast/a11y visual review |
| Pedagogical transfer | Checkpoints and event log | Real student prediction/exit-ticket efficacy study |
| All-syllabus reactive coverage | Eight validated topic families | Remaining **62** canonical topic slugs require separate suitability/reuse decisions and gold samples |

## Subject-specific guardrails

- A conceptual activity bar is **not** a scientific measurement or weather forecast. The water-cycle, transpiration and coastal-erosion models have explicit limitations.
- Ohm's law assumes an ohmic conductor with constant temperature. Do not extrapolate to non-ohmic devices.
- Ideal-gas law uses Kelvin, litres, 1 mole and equilibrium; real gas deviations are out of model.
- Quadratic graph requires nonzero `a`; steep curves are viewport clipped rather than misrepresented as bounded.
- The tutor bridge must not invent a beat/slide/speech anchor mapping. Invalid and out-of-order commands fail closed.
- Accessibility and screen-size evidence cannot be replaced by textual source inspections.

## Rollout recommendation

Start with eight approved exemplars under feature gating, and keep the existing 72 hand-authored legacy animation samples as fallback. Assets should be generated and approved before the live session, keyed by curriculum path and version. Run a small real-user study for misconception correction and explanation quality before expanding automatic rollout. Teaching-material generation and agent review **must never block manipulation of an approved visualization during a live lesson**.

## Implementation tracking

P1 pilot #797, reusable engine #799, tutor bridge #800, review gate #801, durable artifact store #802, subject expansion #803. All require final real Node/CI/browser verification and independent review before being called production-ready.

## Interactive test and benchmark commands

From a Node 18+ checkout, run:

```sh
npm run test:interactive       # all nine interactive-specific test suites
npm test                       # entire repository regression suite
npm run test:coverage          # entire suite with Node coverage reporting
npm run bench:interactive      # local model+SVG computation only
node --check player/interactive.js
node --check player/simulation-kit.js
node --check player/tutor-bridge.js
node --check generator/interactive-review.js
node --check generator/approved-assets.js
node --check generator/interactive-service.js
```

Browser approval requires rendering the demo pages at small-phone and desktop sizes, verifying keyboard/focus/VoiceOver/TalkBack and reduced-motion, and testing speech interruption in the actual Aceceed host. No Node benchmark or mocked reviewer substitutes for those tests.
