#!/usr/bin/env python3
"""Bake a per-glyph advance table for the geometry audit's width model (issue #376).

The audit (generator/geometry.js) used to estimate every label's width as
0.6 x size x length -- a fixed average-glyph-advance guess that overestimates
real DejaVu Sans advances by up to 25% and produced 16 false-positive overflow
findings across the #373/#374/#375 triages. This script measures real advances
from DejaVu Sans (the reviewer's conservative gate font, wider than the
player's system-ui) with PIL and emits:

  1. a JS object literal fragment -> paste into the marked GENERATED block in
     generator/geometry.js (advances as fractions of the font size);
  2. tests/fixtures/widths.json -> PIL-measured (kerned) widths for a corpus
     of real sample labels, used by tests/geometry.test.js to prove the new
     model beats the old one and stays conservative.

Glyph coverage: printable ASCII (U+0020-U+007E) plus every non-ASCII code
point that actually appears in the samples corpus (samples/*.json text/tex
fields). Glyphs missing from DejaVu Sans are left OUT of the table --
geometry.js falls back to the old 0.6 estimate for unknown glyphs.

NOT a runtime dependency: PIL + DejaVu Sans are only needed to regenerate the
table. The baked table in geometry.js is zero-dep and browser-safe.

Regeneration (from the repo root):
    python3 generator/tooling/gen-glyph-table.py
then paste the printed literal into generator/geometry.js's GENERATED block
and run the test suite:
    node --test "tests/*.test.js"
"""
import json
import os
import sys

from PIL import ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAMPLES = os.path.join(REPO, "samples")
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
REF_SIZE = 1000  # measure at 1000px, express advances as fractions of size
TABLE_PRECISION = 4  # decimals in the baked table


def load_font():
    try:
        return ImageFont.truetype(FONT_PATH, REF_SIZE)
    except OSError:
        sys.exit("font not found: %s" % FONT_PATH)


def walk_shape_texts(obj, out):
    # Collect every string that the width model ever measures: text-shape
    # `text` fields and latex-shape `tex` fields (pre-strip -- the JS side
    # strips LaTeX commands before measuring).
    if isinstance(obj, dict):
        if obj.get("kind") == "text" and isinstance(obj.get("text"), str):
            out.append(("text", obj["text"], obj.get("size", 24)))
        elif obj.get("kind") == "latex" and isinstance(obj.get("tex"), str):
            out.append(("latex", obj["tex"], obj.get("size", 24)))
        for v in obj.values():
            walk_shape_texts(v, out)
    elif isinstance(obj, list):
        for v in obj:
            walk_shape_texts(v, out)


def corpus_codepoints(samples_dir):
    cps = set(range(0x20, 0x7F))  # printable ASCII
    for name in sorted(os.listdir(samples_dir)):
        if not name.endswith(".json") or name == "index.json":
            continue
        try:
            with open(os.path.join(samples_dir, name), encoding="utf-8") as f:
                spec = json.load(f)
        except (OSError, ValueError):
            continue
        found = []
        walk_shape_texts(spec, found)
        for _kind, s, _size in found:
            for ch in s:
                o = ord(ch)
                if o >= 0x20 and not (0xD800 <= o <= 0xDFFF):
                    cps.add(o)
    return cps


def main():
    font = load_font()
    cps = corpus_codepoints(SAMPLES)
    non_ascii = sorted(c for c in cps if c >= 0x7F)
    print("corpus: %d code points (%d non-ASCII)" % (len(cps), len(non_ascii)),
          file=sys.stderr)

    # Measure each glyph's advance. A zero advance on a non-space char means
    # the font lacks the glyph (.notdef) -- leave it out so the JS fallback
    # (0.6) applies instead of a bogus zero.
    advances = {}
    missing = []
    for cp in sorted(cps):
        ch = chr(cp)
        adv = font.getlength(ch) / REF_SIZE
        if adv == 0 and cp != 0x20:
            missing.append(cp)
            continue
        advances[cp] = round(adv, TABLE_PRECISION)
    if missing:
        print("missing from font (fallback 0.6 applies): %s"
              % " ".join("U+%04X" % c for c in missing), file=sys.stderr)

    # 1. JS literal fragment for generator/geometry.js.
    lines = ["var GLYPH_ADVANCES = {"]
    items = sorted(advances.items())
    for i, (cp, adv) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append("  0x%X: %s%s" % (cp, adv, comma))
    lines.append("};")
    print("\n".join(lines))

    # 2. Width fixture for tests/geometry.test.js: real (kerned) PIL widths
    #    for the triage anchor labels plus a deterministic spread of other
    #    real sample labels.
    labels = []
    seen = set()
    for name in sorted(os.listdir(SAMPLES)):
        if not name.endswith(".json") or name == "index.json":
            continue
        with open(os.path.join(SAMPLES, name), encoding="utf-8") as f:
            spec = json.load(f)
        found = []
        walk_shape_texts(spec, found)
        for kind, s, size in found:
            key = (kind, s, size)
            if key in seen or not s:
                continue
            seen.add(key)
            if kind == "latex":
                import re
                s = re.sub(r"\\[a-zA-Z]+", "", s)
                s = s.replace("{", "").replace("}", "")
            if not s:
                continue
            size = size if isinstance(size, (int, float)) and size > 0 else 24
            measured = font.getlength(s) / REF_SIZE * size
            labels.append({"text": s, "size": size,
                           "measured": round(measured, 1)})
    fixture_path = os.path.join(REPO, "tests", "fixtures", "widths.json")
    os.makedirs(os.path.dirname(fixture_path), exist_ok=True)
    with open(fixture_path, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("fixture: %d labels -> %s" % (len(labels), fixture_path),
          file=sys.stderr)


if __name__ == "__main__":
    main()
