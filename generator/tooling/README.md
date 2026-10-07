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
