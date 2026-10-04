# animath

Animated math & science problems and concepts, generated on demand for the
Singapore syllabus — primary, secondary, and junior college.

**The idea:** a student picks what they need (level → subject → topic, or just
types a question). animath asks an LLM to produce an *animation spec* — a small
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
your animath checkout, and optionally pass `{ baseUrl: '/samples', autoplay: true }`.
Like the gallery, embedding fetches the sample JSON over HTTP — serve your
site with e.g. `python3 -m http.server` rather than `file://`, which Chrome
blocks for fetch.

## Singapore syllabus coverage

Primary (PSLE) · Secondary (O/N-level, E-Math & A-Math, Physics / Chemistry /
Biology) · JC (H2 Math / Physics / Chemistry / Biology). Full topic list with
slugs in `SYLLABUS.md`.

## Tests

Zero-dependency, Node built-in:

```sh
node --test "tests/*.test.js"
```

This validates every sample in `samples/` against `SPEC.md` via
`player/validate.js`, plus negative cases for the validator itself.

## Roadmap

See `ROADMAP.md`. The repo is developed in small reviewed slices by an
automated iteration loop (one issue → one PR → review → merge, every
15 minutes); humans are welcome via issues and PRs like any other repo.

## License

MIT — see `LICENSE`.
