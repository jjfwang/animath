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
