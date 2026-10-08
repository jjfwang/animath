/* animath static geometry audit — R-5 headless sample check, slice 1.
 *
 * auditGeometry(spec[, fileName]) walks a spec scene by scene, collects every
 * `show`-step `text`/`latex` shape at its show-time position, and returns an
 * array of finding records: { file, scene, kind, detail }, where kind is
 * 'overflow' (a text box crossing the canvas edge, or a latex anchor outside
 * the canvas), 'overlap' (two text boxes whose intersection area exceeds
 * the tolerance below), or 'text-shape-overlap' (a text/latex label box
 * intersecting a non-text shape's bounding box, per issue #172). Empty array
 * = clean. Never throws on invalid input: null specs, empty scenes, missing
 * size/text all return [] (or skip the shape).
 *
 * KNOWN LIMITATION (per issue #117 acceptance 3): auditGeometry is a
 * static snapshot — shapes moved by later `move` steps are audited at
 * their show-time position. SPEC.md v0 `move` verbs interpolate a shape
 * from its current position over dur_ms, so a static audit cannot know
 * the rest position without simulating the scene timeline; like
 * generator/rubric.js, auditGeometry collects shapes at their `show`
 * steps only. A shape moved off-canvas mid-scene is therefore not
 * flagged — a documented, conservative trade-off, not a bug.
 * The time-sampled replacement is auditGeometrySampled (issue #363):
 * reviewers no longer need the manual 100ms audit the run-274 lesson
 * prescribed — the library function simulates the timeline itself.
 * auditGeometry's contract is unchanged.
 *
 * WIDTH MODEL (per-glyph advances, measured — run 376):
 * label width = size × Σ per-glyph advances, from the GLYPH_ADVANCES table
 * baked below (PIL-measured DejaVu Sans advances, fractions of size; the
 * reviewer's conservative gate font, wider than the player's system-ui —
 * run-87 lesson). The old 0.6 × size × length average-advance guess
 * overestimated real advances by up to 25% (16 false-positive overflow
 * findings across the #373/#374/#375 triages) and is kept only as the
 * fallback for glyphs absent from the table. Glyph coverage: printable
 * ASCII + every non-ASCII code point used by the samples corpus; surrogate
 * pairs are combined into single code points. Kerning is deliberately not
 * modelled — the unkerned per-glyph sum is >= the kerned rendered width in
 * the overwhelming majority of cases, so the estimate stays conservative;
 * the documented residual margin is WIDTH_MARGIN_PX (2px — the worst
 * underestimate measured over the 1632-label corpus in
 * tests/fixtures/widths.json at generation time).
 * height ≈ size × 1.2. Size defaults to 24 when missing or non-numeric,
 * mirroring generator/rubric.js textBudget (SPEC.md/player.js render
 * default is 28; the audit uses 24 to stay consistent with the rubric's
 * existing text-tier convention). The box is BASELINE-ANCHORED vertically:
 * player/player.js renders <text x y> directly, and SVG y is the alphabetic
 * baseline, not the box top — so top = y - size (conservative ascent),
 * bottom = y + 0.2 × size (descender budget), keeping the ≈ 1.2 × size
 * height. The old top-at-y model produced false-positive bottom overflows
 * (15 of 119 audit findings in the review round) and was blind to baselines
 * in [0, 0.8 × size) whose real glyph top is off-canvas. Horizontally the
 * box origin is resolved from align: 'start' (default, per SPEC.md line 64
 * and player/player.js `'text-anchor': opts.align || 'start'`) anchors the
 * left edge at x; 'middle' centers the box on x; 'end' puts the right edge
 * at x.
 *
 * OVERLAP TOLERANCE: a pair is flagged only when the intersection area
 * exceeds 1% of the smaller box's area, so grazing adjacency (touching
 * edges, sub-pixel kissing) is not reported.
 *
 * LATEX SHAPES: anchor-in-canvas check only (x/y within 0..W/H). KaTeX
 * rendered width is not statically computable, so no width estimate is
 * attempted — documented, not a gap. For the TEXT-VS-SHAPE check only, a
 * latex label gets a conservative estimated box: the foreignObject is
 * top-left anchored at (x, y) (player/player.js), its width estimated with
 * the same per-glyph model applied to the tex source with LaTeX commands
 * and braces stripped, height = size x 1.2. Wide over-estimates are possible;
 * the manual triage step is the backstop.
 *
 * TEXT-VS-SHAPE (issue #172): every text/latex label box is compared against
 * every non-text shape bounding box in the same scene. rect/circle/line/
 * arrow/polygon get exact boxes (polygon from its vertex extents; line/arrow
 * from the endpoint bbox); sector gets the bbox of the actual wedge (center
 * + sampled arc over its angle span), which is tighter than the full-circle
 * box and still sound. Zero-area shapes and unknown kinds are skipped. Two deliberate exemptions, per the issue's
 * genuine-vs-noise rules: (1) centered-on — a label whose box CENTER sits
 * inside the shape's box was placed on the shape deliberately (a chip's
 * number, a label centered inside a bar/cell, an annotation riding a curve
 * or wire), not a defect; refined (issue #461) so a circle smaller than the
 * label never counts as its host — a small circle covering a label's center
 * is ON the label (e.g. a dot transiently parked on it), not a deliberate
 * placement; (2) point anchors — circles with r <= 10
 * (probe/marker dots) are points by design, so a label grazing one
 * (at most a quarter of the dot's disk area intersecting the label box)
 * is not a defect; a dot parked on the label — more than a quarter-disk
 * of intersection — is a genuine text-smudging overlap and is flagged
 * (issue #465 refined this from the old blanket r<=10 rule, which masked
 * genuine dot-on-label parks). Like the rest
 * of the audit, shapes moved by later `move` steps are compared at their
 * show-time position (the KNOWN LIMITATION above) — a label grazing a
 * moving shape's rest position stays a manual-triage call, and it counts
 * as genuine when found.
 *
 * auditSampleFile(path) and auditAllSamples(dir) are Node-only helpers over
 * samples/index.json (they require('fs')); the core auditGeometry works in
 * browser and Node (no DOM, no deps).
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AnimathGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULT_W = 960;
  var DEFAULT_H = 540;
  var DEFAULT_SIZE = 24;      // mirrors rubric.js textBudget's missing-size tier
  var ADVANCE = 0.6;          // fallback advance (fraction of size) for glyphs
                              // absent from the GLYPH_ADVANCES table (run 376)
  var ASCENT = 1.0;           // conservative ascent above the baseline, as a multiple of size
  var DESCENDER = 0.2;        // descender budget below the baseline, as a multiple of size
                              // (ASCENT + DESCENDER = 1.2 keeps the old box height)
  var OVERLAP_TOLERANCE = 0.01; // intersection > 1% of smaller box => flag
  var POINT_R = 10; // circles with r <= 10 count as point anchors (issue #172)
  var LINE_PAD = 2; // line/arrow bbox fattening per side, so touching a wire counts

  /* ---- generated per-glyph advance table (issue #376) ----
   * GENERATED by generator/tooling/gen-glyph-table.py -- do not edit by hand.
   * PIL-measured DejaVu Sans advances as fractions of the font size (the
   * reviewer's conservative gate font, wider than the player's system-ui).
   * Coverage: printable ASCII + every non-ASCII code point used by the
   * samples corpus at generation time. To regenerate: run the script and
   * replace the var GLYPH_ADVANCES literal below (the script also refreshes
   * tests/fixtures/widths.json), then re-run the suite.
   */
  var GLYPH_ADVANCES = {
    0x20: 0.3179,
    0x21: 0.4009,
    0x22: 0.46,
    0x23: 0.8379,
    0x24: 0.6362,
    0x25: 0.9502,
    0x26: 0.7798,
    0x27: 0.2749,
    0x28: 0.3901,
    0x29: 0.3901,
    0x2A: 0.5,
    0x2B: 0.8379,
    0x2C: 0.3179,
    0x2D: 0.3608,
    0x2E: 0.3179,
    0x2F: 0.3369,
    0x30: 0.6362,
    0x31: 0.6362,
    0x32: 0.6362,
    0x33: 0.6362,
    0x34: 0.6362,
    0x35: 0.6362,
    0x36: 0.6362,
    0x37: 0.6362,
    0x38: 0.6362,
    0x39: 0.6362,
    0x3A: 0.3369,
    0x3B: 0.3369,
    0x3C: 0.8379,
    0x3D: 0.8379,
    0x3E: 0.8379,
    0x3F: 0.5308,
    0x40: 1.0,
    0x41: 0.6841,
    0x42: 0.686,
    0x43: 0.6983,
    0x44: 0.77,
    0x45: 0.6318,
    0x46: 0.5752,
    0x47: 0.7749,
    0x48: 0.752,
    0x49: 0.2949,
    0x4A: 0.2949,
    0x4B: 0.6558,
    0x4C: 0.5571,
    0x4D: 0.8628,
    0x4E: 0.748,
    0x4F: 0.7871,
    0x50: 0.603,
    0x51: 0.7871,
    0x52: 0.6948,
    0x53: 0.6348,
    0x54: 0.6108,
    0x55: 0.7319,
    0x56: 0.6841,
    0x57: 0.9888,
    0x58: 0.6851,
    0x59: 0.6108,
    0x5A: 0.6851,
    0x5B: 0.3901,
    0x5C: 0.3369,
    0x5D: 0.3901,
    0x5E: 0.8379,
    0x5F: 0.5,
    0x60: 0.5,
    0x61: 0.6128,
    0x62: 0.6348,
    0x63: 0.5498,
    0x64: 0.6348,
    0x65: 0.6152,
    0x66: 0.352,
    0x67: 0.6348,
    0x68: 0.6338,
    0x69: 0.2778,
    0x6A: 0.2778,
    0x6B: 0.5791,
    0x6C: 0.2778,
    0x6D: 0.9741,
    0x6E: 0.6338,
    0x6F: 0.6118,
    0x70: 0.6348,
    0x71: 0.6348,
    0x72: 0.4111,
    0x73: 0.521,
    0x74: 0.3921,
    0x75: 0.6338,
    0x76: 0.5918,
    0x77: 0.8179,
    0x78: 0.5918,
    0x79: 0.5918,
    0x7A: 0.5249,
    0x7B: 0.6362,
    0x7C: 0.3369,
    0x7D: 0.6362,
    0x7E: 0.8379,
    0xB0: 0.5,
    0xB1: 0.8379,
    0xB2: 0.4009,
    0xB3: 0.4009,
    0xB7: 0.3179,
    0xB9: 0.4009,
    0xBD: 0.9692,
    0xD7: 0.8379,
    0xF7: 0.8379,
    0x394: 0.6841,
    0x3A6: 0.7871,
    0x3A9: 0.7642,
    0x3B4: 0.6118,
    0x3B8: 0.6118,
    0x3BB: 0.5918,
    0x3BC: 0.6362,
    0x3C0: 0.602,
    0x3C3: 0.6338,
    0x3C9: 0.8374,
    0x2013: 0.5,
    0x2014: 1.0,
    0x2019: 0.3179,
    0x201C: 0.5181,
    0x201D: 0.5181,
    0x2026: 1.0,
    0x2074: 0.4009,
    0x2075: 0.4009,
    0x2077: 0.4009,
    0x2078: 0.4009,
    0x207A: 0.5278,
    0x207B: 0.5278,
    0x2080: 0.4009,
    0x2082: 0.4009,
    0x2083: 0.4009,
    0x2084: 0.4009,
    0x2190: 0.8379,
    0x2192: 0.8379,
    0x21CF: 0.8379,
    0x21D2: 0.8379,
    0x2212: 0.8379,
    0x2248: 0.8379,
    0x2260: 0.8379,
    0x2264: 0.8379,
    0x2705: 0.6001,
    0x2713: 0.8379,
    0x2715: 0.8379,
    0x2717: 0.8379,
    0x274C: 0.6001
  };

  // Advance for one code point, or the 0.6 fallback for unknown glyphs
  // (documented in the WIDTH MODEL comment above).
  function advanceOf(code) {
    var a = GLYPH_ADVANCES[code];
    return (typeof a === 'number' && a > 0) ? a : ADVANCE;
  }

  // Estimated label width: size x the sum of per-glyph advances. Iterates
  // by code point (UTF-16 surrogate pairs combined into one code point),
  // so astral-plane glyphs measure as a single glyph. Kerning is not
  // modelled: the unkerned sum is >= the kerned rendered width in the
  // overwhelming majority of cases, keeping the estimate conservative.
  function widthOf(text, size) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < text.length) {
        var lo = text.charCodeAt(i + 1);
        if (lo >= 0xDC00 && lo <= 0xDFFF) {
          c = 0x10000 + ((c - 0xD800) << 10) + (lo - 0xDC00);
          i++;
        }
      }
      w += advanceOf(c);
    }
    return w * size;
  }

  // Documented residual underestimate margin: the worst (measured - estimate)
  // over the 1632-label corpus in tests/fixtures/widths.json at generation
  // time, rounded up. The model is conservative within this margin.
  var WIDTH_MARGIN_PX = 2;

  function isObj(v) { return v !== null && typeof v === 'object'; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function canvasOf(spec) {
    var c = spec && spec.canvas;
    return { W: num(c && c.width, DEFAULT_W), H: num(c && c.height, DEFAULT_H) };
  }

  function sceneLabel(scene, i) {
    var id = scene && scene.id;
    return (typeof id === 'string' && id.length > 0) ? id : 'scene ' + (i + 1);
  }

  function alignOf(shape) {
    var a = shape && shape.align;
    return (a === 'middle' || a === 'end') ? a : 'start';
  }

  // Bounding box for a text shape, or null when there is nothing to audit.
  function textBox(shape) {
    if (!isObj(shape) || shape.kind !== 'text') return null;
    var t = shape.text;
    if (typeof t !== 'string' || t.length === 0) return null;
    var size = num(shape.size, DEFAULT_SIZE);
    var w = widthOf(t, size);
    var x = num(shape.x, 0);
    var y = num(shape.y, 0);
    var a = alignOf(shape);
    var left = a === 'middle' ? x - w / 2 : (a === 'end' ? x - w : x);
    // SVG text y is the alphabetic baseline: glyphs rise ~1.0*size above it
    // (conservative ascent) and descend ~0.2*size below it.
    return {
      id: shape.id || '?', left: left, top: y - ASCENT * size,
      right: left + w, bottom: y + DESCENDER * size
    };
  }

  function checkOverflow(box, scene, file, canvas, out) {
    if (box.left < 0 || box.right > canvas.W || box.top < 0 || box.bottom > canvas.H) {
      out.push({
        file: file, scene: scene, kind: 'overflow',
        detail: box.id + ': text box extends outside the ' + canvas.W + 'x' + canvas.H + ' canvas'
      });
    }
  }

  function checkLatexAnchor(shape, scene, file, canvas, out) {
    var x = num(shape.x, 0);
    var y = num(shape.y, 0);
    if (x < 0 || x > canvas.W || y < 0 || y > canvas.H) {
      out.push({
        file: file, scene: scene, kind: 'overflow',
        detail: (shape.id || '?') + ': latex anchor outside the ' + canvas.W + 'x' + canvas.H + ' canvas'
      });
    }
  }

  // Visible-glyph estimate for a KaTeX `tex` source: strip backslash
  // commands (\frac, \cdot, ...) and braces, count what remains.
  // Visible-glyph source for a KaTeX `tex`: LaTeX commands and braces
  // stripped, returned as a string for the per-glyph width model.
  function latexVisible(tex) {
    return String(tex).replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
  }

  // Estimated bounding box for a latex label (top-left anchored at x/y,
  // like the player's foreignObject), or null when nothing to audit.
  function latexBox(shape) {
    if (!isObj(shape) || shape.kind !== 'latex') return null;
    var t = shape.tex;
    if (typeof t !== 'string' || t.length === 0) return null;
    var size = num(shape.size, DEFAULT_SIZE);
    var x = num(shape.x, 0);
    var y = num(shape.y, 0);
    var w = widthOf(latexVisible(t), size);
    return {
      id: shape.id || '?', left: x, top: y,
      right: x + w, bottom: y + (ASCENT + DESCENDER) * size
    };
  }

  // Bounding box for a non-text shape, or null when there is nothing to
  // audit (zero-area shapes, unknown kinds, text/latex labels).
  function shapeBox(shape) {
    if (!isObj(shape)) return null;
    var id = shape.id || '?';
    switch (shape.kind) {
      case 'rect': {
        var w = num(shape.w, 0);
        var h = num(shape.h, 0);
        if (w <= 0 || h <= 0) return null;
        var x = num(shape.x, 0);
        var y = num(shape.y, 0);
        return { id: id, left: x, top: y, right: x + w, bottom: y + h };
      }
      case 'circle': {
        var r = num(shape.r, 0);
        if (r <= 0) return null;
        var cx = num(shape.cx, 0);
        var cy = num(shape.cy, 0);
        return { id: id, left: cx - r, top: cy - r, right: cx + r, bottom: cy + r };
      }
      case 'line':
      case 'arrow': {
        var x1 = num(shape.x1, 0);
        var y1 = num(shape.y1, 0);
        var x2 = num(shape.x2, 0);
        var y2 = num(shape.y2, 0);
        if (x1 === x2 && y1 === y2) return null;
        // Fattened by LINE_PAD: a 1-D segment box has zero area, so the pad
        // makes "ink touching a wire" reportable (the arrowhead base is
        // covered too). Conservative on diagonal wires, documented as such.
        return {
          id: id,
          left: Math.min(x1, x2) - LINE_PAD, top: Math.min(y1, y2) - LINE_PAD,
          right: Math.max(x1, x2) + LINE_PAD, bottom: Math.max(y1, y2) + LINE_PAD
        };
      }
      case 'polygon': {
        var pts = shape.points;
        if (!Array.isArray(pts) || pts.length === 0) return null;
        var l = Infinity, tp = Infinity, ri = -Infinity, b = -Infinity;
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          if (!Array.isArray(p) || p.length < 2) continue;
          var px = num(p[0], 0);
          var py = num(p[1], 0);
          if (px < l) l = px;
          if (py < tp) tp = py;
          if (px > ri) ri = px;
          if (py > b) b = py;
        }
        if (l === Infinity) return null;
        return { id: id, left: l, top: tp, right: ri, bottom: b };
      }
      case 'sector': {
        var sr = num(shape.r, 0);
        if (sr <= 0) return null;
        var scx = num(shape.cx, 0);
        var scy = num(shape.cy, 0);
        // Tighter than the full-circle box: the bbox of the actual wedge
        // (center + sampled arc). Still a sound over-approximation — angles
        // only narrow the real sector — but it no longer flags labels sitting
        // in the wedge's empty quadrants.
        var a0 = num(shape.startAngle, 0);
        var a1 = num(shape.endAngle, 0);
        var span = a1 - a0;
        while (span < 0) span += 360;
        var pts = [[scx, scy]];
        if (span >= 360) {
          pts.push([scx - sr, scy - sr], [scx + sr, scy + sr]);
        } else {
          for (var deg = 0; deg <= span; deg += 15) {
            var rad = (a0 + deg) * Math.PI / 180;
            pts.push([scx + sr * Math.cos(rad), scy + sr * Math.sin(rad)]);
          }
          var rad1 = (a0 + span) * Math.PI / 180;
          pts.push([scx + sr * Math.cos(rad1), scy + sr * Math.sin(rad1)]);
        }
        var l = Infinity, tp = Infinity, ri = -Infinity, b = -Infinity;
        for (var pi = 0; pi < pts.length; pi++) {
          var qx = pts[pi][0];
          var qy = pts[pi][1];
          if (qx < l) l = qx;
          if (qy < tp) tp = qy;
          if (qx > ri) ri = qx;
          if (qy > b) b = qy;
        }
        return { id: id, left: l, top: tp, right: ri, bottom: b };
      }
      default: return null;
    }
  }

  // A label whose box center sits inside a shape's box was placed ON the
  // shape deliberately (a value chip's number, a label centered inside a
  // bar/cell, an annotation riding a curve or wire) — never a finding.
  // Full containment is a special case of this rule.
  //
  // Refined (issue #461): a small circle cannot host a label. When the
  // shape is a circle whose box is smaller than the label's box, the
  // circle is ON the label — an intruder, e.g. a moving dot transiently
  // parked on a label (the #458 defect: a food dot's flight parked at the
  // label's box center, hiding 143 real ink px from the audit) — not a
  // deliberate label-on-shape placement, so the exemption does not fire.
  // Rects/bars/chips keep the center-inside rule (a plaque can host a
  // centered label that overflows it), as do lines/arrows (an annotation
  // rides the wire) and the other kinds.
  function isCenteredOn(label, shapeBox, shapeKind) {
    var cx = (label.left + label.right) / 2;
    var cy = (label.top + label.bottom) / 2;
    if (!(cx >= shapeBox.left && cx <= shapeBox.right &&
          cy >= shapeBox.top && cy <= shapeBox.bottom)) return false;
    if (shapeKind === 'circle' && boxArea(shapeBox) < boxArea(label)) return false;
    return true;
  }

  // Probe/marker dots (r <= 10) are point anchors by design — a label
  // grazing one is not a defect. A dot only grazes when its box
  // intersection with the label box covers at most 1/4 of the dot's disk
  // area (pi*r^2): the bbox intersection upper-bounds the dot's actual ink
  // on the label, so the comparison is conservative. Below that line the
  // dot is at most edge-kissing; above it a dot visibly parks on the
  // label and is flagged. (Issue #465: the old blanket r<=10 rule exempted
  // such parks — e.g. the bio-reproduction s3 'pod' label buried under
  // four r=8 dots — masking genuine text-smudging overlaps. A parked dot
  // can never be exempt by construction, since its intersection always
  // exceeds the quarter-disk cap.)
  function isPointShape(label, shapeBox, shape) {
    if (shape.kind !== 'circle' || num(shape.r, 0) > POINT_R) return false;
    var r = num(shape.r, 0);
    return intersectArea(label, shapeBox) <= Math.PI * r * r / 4;
  }

  function boxArea(B) {
    return Math.max(0, B.right - B.left) * Math.max(0, B.bottom - B.top);
  }

  function intersectArea(A, B) {
    var ix = Math.min(A.right, B.right) - Math.max(A.left, B.left);
    var iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    return (ix > 0 && iy > 0) ? ix * iy : 0;
  }

  function checkTextShapeOverlaps(labels, shapes, scene, file, out) {
    labels.forEach(function (L) {
      shapes.forEach(function (S) {
        var sb = S.box;
        if (isCenteredOn(L, sb, S.shape && S.shape.kind)) return;
        if (isPointShape(L, sb, S.shape)) return;
        var area = intersectArea(L, sb);
        var smaller = Math.min(boxArea(L), boxArea(sb));
        if (area > OVERLAP_TOLERANCE * smaller) {
          out.push({
            file: file, scene: scene, kind: 'text-shape-overlap',
            detail: L.id + ' collides with ' + sb.id +
              ' (' + Math.round(area) + 'px^2 intersection)',
            ids: [L.id, sb.id]
          });
        }
      });
    });
  }

  function checkOverlaps(boxes, scene, file, out) {
    for (var a = 0; a < boxes.length; a++) {
      for (var b = a + 1; b < boxes.length; b++) {
        var A = boxes[a];
        var B = boxes[b];
        var area = intersectArea(A, B);
        var smaller = Math.min(boxArea(A), boxArea(B));
        if (area > OVERLAP_TOLERANCE * smaller) {
          out.push({
            file: file, scene: scene, kind: 'overlap',
            detail: A.id + ' overlaps ' + B.id + ' (' + Math.round(area) + 'px^2 intersection)',
            ids: [A.id, B.id]
          });
        }
      }
    }
  }

  function auditGeometry(spec, fileName) {
    var file = (typeof fileName === 'string' && fileName.length > 0) ? fileName : null;
    var findings = [];
    var canvas = canvasOf(spec);
    var scenes = (spec && Array.isArray(spec.scenes)) ? spec.scenes : [];
    scenes.forEach(function (scene, i) {
      var label = sceneLabel(scene, i);
      var boxes = [];   // text boxes: overflow + text-vs-text bands
      var labels = [];  // text + latex label boxes: text-vs-shape band
      var shapes = [];  // non-text shape boxes with their source shape
      var steps = (scene && Array.isArray(scene.steps)) ? scene.steps : [];
      steps.forEach(function (step) {
        var shape = step && step.do === 'show' && step.shape;
        if (!isObj(shape)) return;
        if (shape.kind === 'text') {
          var box = textBox(shape);
          if (box) {
            boxes.push(box);
            labels.push(box);
            checkOverflow(box, label, file, canvas, findings);
          }
        } else if (shape.kind === 'latex') {
          checkLatexAnchor(shape, label, file, canvas, findings);
          var lbox = latexBox(shape);
          if (lbox) labels.push(lbox);
        } else {
          var sbox = shapeBox(shape);
          if (sbox) shapes.push({ box: sbox, shape: shape });
        }
      });
      checkOverlaps(boxes, label, file, findings);
      checkTextShapeOverlaps(labels, shapes, label, file, findings);
    });
    return findings;
  }

  // ---- time-sampled geometry audit (issue #363) ----
  //
  // auditGeometrySampled(spec[, fileName]) steps each scene timeline at
  // SAMPLE_DT ms, interpolates `move` steps per SPEC.md v0 (each move runs
  // from the shape's current spot over dur_ms; sequential and overlapping
  // moves compose), respects show/hide sequencing, and re-runs the same
  // three bands with the same two exemptions (centered-on, point anchors).
  // Findings share the record shape { file, scene, kind, detail }; detail
  // carries a time band ([300-700ms], or [300ms] for a single sample)
  // instead of the static audit's px^2 intersection (the area varies along
  // a path, so it cannot key a band). A finding seen at non-consecutive
  // samples is reported once per contiguous band. Additive: auditGeometry
  // above is untouched.
  var SAMPLE_DT = 100; // ms — the manual run-274 audit's step, now canonical

  // Position/size fields the player interpolates, per SPEC.md v0 move
  // semantics (mirrors player/player.js POS_FIELDS).
  var MOVE_FIELDS = {
    text: ['x', 'y'],
    latex: ['x', 'y'],
    rect: ['x', 'y', 'w', 'h'],
    circle: ['cx', 'cy', 'r'],
    line: ['x1', 'y1', 'x2', 'y2'],
    arrow: ['x1', 'y1', 'x2', 'y2'],
    polygon: ['points']
  };

  function copyShape(s) {
    var c = Object.assign({}, s);
    if (Array.isArray(s.points)) c.points = s.points.slice();
    return c;
  }

  function lerpNum(a, b, p) { return a + (b - a) * p; }

  // Pointwise polygon interpolation, guarded like the player: malformed
  // input returns undefined and the field is skipped, never throws.
  function interpPointsSampled(fromPts, toPts, p) {
    if (!Array.isArray(fromPts) || !Array.isArray(toPts) ||
        fromPts.length !== toPts.length) return undefined;
    var out = [];
    for (var i = 0; i < toPts.length; i++) {
      var a = fromPts[i], b = toPts[i];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2 ||
          typeof a[0] !== 'number' || typeof a[1] !== 'number' ||
          typeof b[0] !== 'number' || typeof b[1] !== 'number' ||
          !isFinite(a[0]) || !isFinite(a[1]) || !isFinite(b[0]) || !isFinite(b[1])) return undefined;
      out.push([lerpNum(a[0], b[0], p), lerpNum(a[1], b[1], p)]);
    }
    return out;
  }

  // Shape with `to` applied at progress p (0 = from, 1 = to). Only
  // numeric fields interpolate; anything else is skipped, never throws.
  // `to` is collector-validated (an object); unlisted kinds (e.g. sector)
  // have no MOVE_FIELDS entry and keep their show-time geometry.
  function lerpShape(from, to, p) {
    var out = copyShape(from);
    var fields = MOVE_FIELDS[from.kind];
    if (!fields) return out;
    fields.forEach(function (f) {
      var tv = to[f];
      if (f === 'points') {
        var pts = interpPointsSampled(from.points, tv, p);
        if (pts !== undefined) out.points = pts;
        return;
      }
      if (typeof tv !== 'number' || !isFinite(tv)) return;
      out[f] = lerpNum(num(from[f], tv), tv, p);
    });
    return out;
  }

  // Interpolated state of one shown shape at time t. Moves run in
  // (at_ms, step-order); each move starts from the shape's state at its
  // own at_ms ("from its current spot", SPEC.md v0), so sequential and
  // overlapping moves compose. dur_ms <= 0 means instant.
  function stateAt(showShape, moves, t) {
    var state = copyShape(showShape);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      if (t < m.atMs) break;
      var start = stateAt(showShape, moves.slice(0, i), m.atMs);
      var p = m.durMs > 0 ? Math.min(1, (t - m.atMs) / m.durMs) : 1;
      state = lerpShape(start, m.to, p);
    }
    return state;
  }

  // Show/hide/move events per shape id, in collector order. Only steps
  // with usable addressing land here: shows need an object shape with a
  // non-empty string id, hide/move need a non-empty string target, moves
  // need an object `to`. Never throws on junk steps.
  function sceneEvents(steps) {
    var byId = {};
    steps.forEach(function (step, si) {
      if (!isObj(step)) return;
      var atMs = num(step.at_ms, 0);
      var id;
      if (step.do === 'show' && isObj(step.shape) &&
          typeof step.shape.id === 'string' && step.shape.id.length > 0) {
        id = step.shape.id;
        (byId[id] = byId[id] || { shows: [], hides: [], moves: [] })
          .shows.push({ atMs: atMs, order: si, shape: step.shape });
      } else if (step.do === 'hide' &&
          typeof step.target === 'string' && step.target.length > 0) {
        id = step.target;
        (byId[id] = byId[id] || { shows: [], hides: [], moves: [] })
          .hides.push({ atMs: atMs, order: si });
      } else if (step.do === 'move' &&
          typeof step.target === 'string' && step.target.length > 0 &&
          isObj(step.to)) {
        id = step.target;
        (byId[id] = byId[id] || { shows: [], hides: [], moves: [] })
          .moves.push({ atMs: atMs, order: si, to: step.to,
            // Mirror the player (player.js move case): dur_ms || 800, so a
            // missing or zero dur_ms animates over 800ms, never instant.
            durMs: num(step.dur_ms, 800) || 800 });
      }
    });
    return byId;
  }

  // Interpolated, visibility-resolved shape for one id at time t, or null
  // when nothing is on stage. The latest show at-or-before t (at_ms, then
  // step order) is the base; a hide wins when it is later; only moves
  // after that show participate.
  function visibleState(rec, t) {
    var show = null;
    rec.shows.forEach(function (s) {
      if (s.atMs <= t &&
          (!show || s.atMs > show.atMs || (s.atMs === show.atMs && s.order > show.order))) show = s;
    });
    if (!show) return null;
    var hidden = false;
    rec.hides.forEach(function (h) {
      if (h.atMs <= t &&
          (h.atMs > show.atMs || (h.atMs === show.atMs && h.order > show.order))) hidden = true;
    });
    if (hidden) return null;
    var moves = rec.moves.filter(function (m) {
      return m.atMs > show.atMs || (m.atMs === show.atMs && m.order > show.order);
    });
    moves.sort(function (a, b) { return (a.atMs - b.atMs) || (a.order - b.order); });
    return stateAt(show.shape, moves, t);
  }

  function bandOf(a, b) { return a === b ? '[' + a + 'ms]' : '[' + a + '-' + b + 'ms]'; }

  function auditGeometrySampled(spec, fileName) {
    var file = (typeof fileName === 'string' && fileName.length > 0) ? fileName : null;
    var findings = [];
    var canvas = canvasOf(spec);
    var scenes = (spec && Array.isArray(spec.scenes)) ? spec.scenes : [];
    scenes.forEach(function (scene, i) {
      var label = sceneLabel(scene, i);
      var steps = (scene && Array.isArray(scene.steps)) ? scene.steps : [];
      var byId = sceneEvents(steps);
      var ids = Object.keys(byId);
      var end = num(scene && scene.duration_ms, 0);
      if (!(end > 0)) {
        end = 0;
        steps.forEach(function (step) {
          if (isObj(step)) end = Math.max(end, num(step.at_ms, 0));
        });
      }
      // Open time bands, keyed on the stable (kind, participants) part of
      // the finding; closed and emitted when a sample no longer shows them.
      // Overlap findings also carry structured `band` {start,last} and
      // `ids` [a,b] for the motion-band classifier (issue #382); the
      // record contract {file, scene, kind, detail} is unchanged.
      var open = {};
      var order = [];
      function emit(key) {
        var b = open[key];
        var rec = {
          file: file, scene: label, kind: b.kind,
          detail: b.detail + ' ' + bandOf(b.start, b.last)
        };
        if (b.ids) {
          rec.band = { start: b.start, last: b.last };
          rec.ids = b.ids;
        }
        findings.push(rec);
        delete open[key];
        order.splice(order.indexOf(key), 1);
      }
      function note(key, kind, detail, t, seen, ids) {
        seen[key] = true;
        var b = open[key];
        if (!b) {
          open[key] = { kind: kind, detail: detail, start: t, last: t,
            ids: ids || null };
          order.push(key);
        } else {
          b.last = t;
        }
      }
      function closeUnseen(seen) {
        order.slice().forEach(function (key) {
          if (!seen[key]) emit(key);
        });
      }
      for (var t = 0; t <= end; t += SAMPLE_DT) {
        var seen = {};
        var boxes = [];   // text boxes: overflow + text-vs-text bands
        var labels = [];  // text + latex label boxes: text-vs-shape band
        var shapes = [];  // non-text shape boxes: text-vs-shape band
        ids.forEach(function (id) {
          var st = visibleState(byId[id], t);
          if (!st) return;
          if (st.kind === 'text') {
            var box = textBox(st);
            if (box) {
              boxes.push(box);
              labels.push(box);
              if (box.left < 0 || box.right > canvas.W ||
                  box.top < 0 || box.bottom > canvas.H) {
                note(st.id + '|overflow', 'overflow',
                  st.id + ': text box extends outside the ' +
                    canvas.W + 'x' + canvas.H + ' canvas', t, seen);
              }
            }
          } else if (st.kind === 'latex') {
            var x = num(st.x, 0);
            var y = num(st.y, 0);
            if (x < 0 || x > canvas.W || y < 0 || y > canvas.H) {
              note(st.id + '|latex-overflow', 'overflow',
                st.id + ': latex anchor outside the ' +
                  canvas.W + 'x' + canvas.H + ' canvas', t, seen);
            }
            var lbox = latexBox(st);
            if (lbox) labels.push(lbox);
          } else {
            var sbox = shapeBox(st);
            if (sbox) shapes.push({ box: sbox, shape: st });
          }
        });
        noteOverlaps(boxes, t, seen, note);
        noteTextShape(labels, shapes, t, seen, note);
        closeUnseen(seen);
      }
      order.slice().forEach(emit);
    });
    return findings;
  }

  function noteOverlaps(boxes, t, seen, note) {
    for (var a = 0; a < boxes.length; a++) {
      for (var b = a + 1; b < boxes.length; b++) {
        var A = boxes[a];
        var B = boxes[b];
        var area = intersectArea(A, B);
        var smaller = Math.min(boxArea(A), boxArea(B));
        if (area > OVERLAP_TOLERANCE * smaller) {
          note(A.id + '|' + B.id + '|overlap', 'overlap',
            A.id + ' overlaps ' + B.id, t, seen, [A.id, B.id]);
        }
      }
    }
  }

  function noteTextShape(labels, shapes, t, seen, note) {
    labels.forEach(function (L) {
      shapes.forEach(function (S) {
        var sb = S.box;
        if (isCenteredOn(L, sb, S.shape && S.shape.kind)) return;
        if (isPointShape(L, sb, S.shape)) return;
        var area = intersectArea(L, sb);
        var smaller = Math.min(boxArea(L), boxArea(sb));
        if (area > OVERLAP_TOLERANCE * smaller) {
          note(L.id + '|' + sb.id + '|ts', 'text-shape-overlap',
            L.id + ' collides with ' + sb.id, t, seen, [L.id, sb.id]);
        }
      });
    });
  }

  // ---- motion-band + staging classification (issues #382, #384) ----
  //
  // classifyFindings(spec, findings) marks each overlap finding
  // (kind 'overlap' or 'text-shape-overlap', carrying structured
  // `ids` [a,b] — time-banded findings from auditGeometrySampled also
  // carry `band` {start,last}) as 'intentional-motion',
  // 'intentional-staging', or 'genuine':
  //
  //   intentional-motion iff
  //     (a) the band TOUCHES a move-step flight interval
  //         [atMs, atMs + durMs] of EITHER involved shape (inclusive —
  //         covers the band inside the flight as well as the band's edge
  //         meeting the flight's start, i.e. the scripted entrance/exit
  //         park staging the triages classified as motion, e.g. #373's
  //         300ms striker park); and
  //     (b) both shapes' rest positions are clear — the audit's own band
  //         check re-run on the shapes' rest states (after their last
  //         move) reports nothing, with the same tolerance and the same
  //         centered-on / point-anchor exemptions.
  //   intentional-staging iff the finding is not intentional-motion and
  //     the two shapes' visibility intervals never intersect — sequential
  //     same-slot labels (read1/read2, q/q2, lab1/lab2/lab3) whose static
  //     boxes overlap but which are never on screen together. Visibility
  //     intervals come from show/hide step times (a hide closes the open
  //     range; a re-show while visible keeps it open) and intersect iff
  //     the two shapes share at least one 100ms audit sample — the
  //     audit's existing tolerance. A pair brought co-visible by a
  //     move-step flight (its band was observed, so the ranges share that
  //     sample) stays genuine, as do static park/staging duplicates of
  //     motion-classified pairs.
  //   everything else -> 'genuine'.
  //
  // A flight of a third, uninvolved shape never masks a finding: only the
  // two participants' flights count. A band that starts in flight but
  // persists at rest fails (b) and stays genuine. Rest-clear treats a
  // hidden/absent shape as clear (no rest box); a label that lands
  // centered on a chip is clear via the centered-on exemption, exactly as
  // the audit itself would report at rest.
  //
  // Returns [{ finding, verdict, flight, staging }] where flight is
  // { id, startMs, endMs } for intentional-motion (null otherwise) and
  // staging is { aId, bId, aRanges, bRanges } for intentional-staging
  // (null otherwise), aRanges/bRanges the grid-aligned
  // [firstSample, lastSample] visibility ranges of the two shapes.
  //
  // KNOWN LIMITATION (run-274 lesson): bands are 100ms samples — a
  // sub-100ms graze between samples is invisible to the audit and
  // therefore to the classifier. Flight intervals come from the spec's own
  // move steps (scripted motion only); anything the player does at runtime
  // is not classified. Like the static audit, move-shifted shapes are
  // compared at their show-time position for visibility purposes only —
  // visibility itself never moves, so flights cannot create or destroy
  // co-visibility.
  //
  // Never throws on junk: null specs, missing scenes/ids, findings without
  // ids, and ids with no show events all yield verdict 'genuine'.
  function sceneEndMs(scene, steps) {
    var end = num(scene && scene.duration_ms, 0);
    if (!(end > 0)) {
      end = 0;
      steps.forEach(function (step) {
        if (isObj(step)) end = Math.max(end, num(step.at_ms, 0));
      });
    }
    return end;
  }

  function sceneByLabel(scenes, label) {
    for (var i = 0; i < scenes.length; i++) {
      if (sceneLabel(scenes[i], i) === label) return scenes[i];
    }
    return null;
  }

  // -> [{ id, startMs, endMs }] flight intervals for one shape id
  function flightIntervals(byId, id) {
    var rec = byId[id];
    if (!rec) return [];
    return rec.moves.map(function (m) {
      return { id: id, startMs: m.atMs, endMs: m.atMs + m.durMs };
    });
  }

  // The band touches the flight (inclusive on both ends — a sample exactly
  // at the flight boundary is mid-flight at p = 0 or 1). Covers the full
  // band inside the flight AND the band's edge meeting the flight's start
  // (the scripted entrance/exit park staging the triages classified as
  // motion, e.g. #373's 300ms striker park).
  function bandTouchesFlight(band, f) {
    return band.start <= f.endMs && band.last >= f.startMs;
  }

  // Rest state of one shape id at tRest: { label, box, shape } or null
  // when hidden/absent/boxless (counts as clear).
  function restStateFor(byId, id, tRest) {
    var rec = byId[id];
    if (!rec) return null;
    var st = visibleState(rec, tRest);
    if (!st) return null;
    if (st.kind === 'text') {
      var tb = textBox(st);
      return tb ? { label: true, box: tb, shape: st } : null;
    }
    if (st.kind === 'latex') {
      var lb = latexBox(st);
      return lb ? { label: true, box: lb, shape: st } : null;
    }
    var sb = shapeBox(st);
    return sb ? { label: false, box: sb, shape: st } : null;
  }

  function boxesOverlap(A, B) {
    var area = intersectArea(A, B);
    return area > OVERLAP_TOLERANCE * Math.min(boxArea(A), boxArea(B));
  }

  // True when the two rest states would NOT reproduce this finding —
  // i.e. the audit's own band check, re-run at rest.
  function restClear(kind, restA, restB) {
    if (!restA || !restB) return true;
    if (kind === 'overlap') return !boxesOverlap(restA.box, restB.box);
    // text-shape-overlap: ids[0] is the label; same two exemptions as the
    // audit band, so a label landing centered on its chip reads clear.
    if (isCenteredOn(restA.box, restB.box, restB.shape && restB.shape.kind)) return true;
    if (isPointShape(restA.box, restB.box, restB.shape)) return true;
    return !boxesOverlap(restA.box, restB.box);
  }

  // Visibility ranges for one shape id: [firstSample, lastSample] ranges on
  // the audit's 100ms grid, derived from show/hide step times in (atMs,
  // step-order). A hide closes the open range (hide wins ties, per
  // visibleState); a re-show while visible keeps the range open (the latest
  // show wins, never closes). A range left open at the end runs through the
  // scene's last grid sample. A show/hide window covering no grid sample
  // contributes no range — the audit could never observe the shape, so it
  // counts as never visible here. Never throws on junk: unknown ids yield
  // [].
  function visibilityRanges(byId, id, endMs) {
    var rec = byId[id];
    if (!rec) return [];
    var events = [];
    rec.shows.forEach(function (s) {
      events.push({ atMs: s.atMs, order: s.order, open: true });
    });
    rec.hides.forEach(function (h) {
      events.push({ atMs: h.atMs, order: h.order, open: false });
    });
    events.sort(function (a, b) { return (a.atMs - b.atMs) || (a.order - b.order); });
    var ranges = [];
    var start = null;
    function closeRange(hideMs) {
      // grid samples t with start <= t < hideMs
      var first = Math.ceil(start / SAMPLE_DT) * SAMPLE_DT;
      var last = Math.floor((hideMs - 1) / SAMPLE_DT) * SAMPLE_DT;
      if (last >= first) ranges.push([first, last]);
      start = null;
    }
    events.forEach(function (e) {
      if (e.open) {
        if (start === null) start = e.atMs;
      } else if (start !== null) {
        closeRange(e.atMs);
      }
    });
    if (start !== null) {
      var first = Math.ceil(start / SAMPLE_DT) * SAMPLE_DT;
      var last = Math.floor(endMs / SAMPLE_DT) * SAMPLE_DT;
      if (last >= first) ranges.push([first, last]);
    }
    return ranges;
  }

  // True when the two grid-aligned range sets share at least one audit
  // sample. This is the audit's existing tolerance (SAMPLE_DT) applied to
  // visibility — a sub-100ms co-visibility sliver between samples is
  // invisible to the audit, so it does not count as co-visible here
  // either.
  function rangesShareSample(rangesA, rangesB) {
    for (var i = 0; i < rangesA.length; i++) {
      for (var j = 0; j < rangesB.length; j++) {
        if (Math.max(rangesA[i][0], rangesB[j][0]) <=
            Math.min(rangesA[i][1], rangesB[j][1])) return true;
      }
    }
    return false;
  }

  function classifyFindings(spec, findings) {
    var scenes = (spec && Array.isArray(spec.scenes)) ? spec.scenes : [];
    var list = Array.isArray(findings) ? findings : [];
    return list.map(function (f) {
      var verdict = 'genuine';
      var flight = null;
      var staging = null;
      if (isObj(f) && (f.kind === 'overlap' || f.kind === 'text-shape-overlap') &&
          Array.isArray(f.ids) && f.ids.length === 2) {
        var scene = sceneByLabel(scenes, f.scene);
        if (scene) {
          var steps = Array.isArray(scene.steps) ? scene.steps : [];
          var byId = sceneEvents(steps);
          if (isObj(f.band)) {
            var flights = flightIntervals(byId, f.ids[0])
              .concat(flightIntervals(byId, f.ids[1]));
            for (var i = 0; i < flights.length; i++) {
              if (!bandTouchesFlight(f.band, flights[i])) continue;
              var tRest = sceneEndMs(scene, steps);
              [f.ids[0], f.ids[1]].forEach(function (id) {
                var rec = byId[id];
                if (rec) rec.moves.forEach(function (m) {
                  if (m.atMs + m.durMs > tRest) tRest = m.atMs + m.durMs;
                });
              });
              if (restClear(f.kind,
                  restStateFor(byId, f.ids[0], tRest),
                  restStateFor(byId, f.ids[1], tRest))) {
                verdict = 'intentional-motion';
                flight = flights[i];
              }
              break;
            }
          }
          if (verdict === 'genuine') {
            var endMs = sceneEndMs(scene, steps);
            var rangesA = visibilityRanges(byId, f.ids[0], endMs);
            var rangesB = visibilityRanges(byId, f.ids[1], endMs);
            if (rangesA.length > 0 && rangesB.length > 0 &&
                !rangesShareSample(rangesA, rangesB)) {
              verdict = 'intentional-staging';
              staging = {
                aId: f.ids[0], bId: f.ids[1],
                aRanges: rangesA, bRanges: rangesB
              };
            }
          }
        }
      }
      return { finding: f, verdict: verdict, flight: flight, staging: staging };
    });
  }

  function baseName(p) {
    var s = String(p);
    var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
    return i < 0 ? s : s.slice(i + 1);
  }

  // Node-only: audit one sample file by path. Unreadable/invalid files
  // yield [] rather than throwing.
  function auditSampleFile(path) {
    var fs = require('fs');
    try {
      var parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
      return auditGeometry(parsed, baseName(path));
    } catch (ignore) {
      return [];
    }
  }

  // Node-only: audit every file listed in <dir>/index.json (default
  // 'samples'). Malformed manifests yield [] rather than throwing.
  function auditAllSamples(dir) {
    var fs = require('fs');
    var base = (typeof dir === 'string' && dir.length > 0) ? dir : 'samples';
    var manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(base + '/index.json', 'utf8'));
    } catch (ignore) {
      return [];
    }
    if (!Array.isArray(manifest)) return [];
    var out = [];
    manifest.forEach(function (name) {
      if (typeof name !== 'string' || name.length === 0) return;
      Array.prototype.push.apply(out, auditSampleFile(base + '/' + name));
    });
    return out;
  }

  return {
    auditGeometry: auditGeometry,
    // Estimated label width in px for a text string at a font size, using
    // the per-glyph advance table (issue #376). Exported so tests can
    // compare the model against PIL-measured widths directly.
    estimateTextWidth: widthOf,
    auditGeometrySampled: auditGeometrySampled,
    classifyFindings: classifyFindings,
    auditSampleFile: auditSampleFile,
    auditAllSamples: auditAllSamples
  };
});
