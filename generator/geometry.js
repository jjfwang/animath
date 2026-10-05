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
 * KNOWN LIMITATION (per issue #117 acceptance 3): shapes moved by later
 * `move` steps are audited at their show-time position. SPEC.md v0 `move`
 * verbs interpolate a shape from its current position over dur_ms, so a
 * static audit cannot know the rest position without simulating the scene
 * timeline; like generator/rubric.js, this module collects shapes at their
 * `show` steps only. A shape moved off-canvas mid-scene is therefore not
 * flagged — a documented, conservative trade-off, not a bug.
 *
 * WIDTH MODEL (font-metric-based, not char-count — run 87's lesson):
 * label width ≈ 0.6 × size × text.length (average glyph advance),
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
 * the same font-metrics model applied to the tex source with LaTeX commands
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
 * or wire), not a defect; (2) point anchors — circles with r <= 10
 * (probe/marker dots) are points by design, so a label touching one is not
 * a defect. Like the rest
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
  var ADVANCE = 0.6;          // average glyph advance as a fraction of size
  var ASCENT = 1.0;           // conservative ascent above the baseline, as a multiple of size
  var DESCENDER = 0.2;        // descender budget below the baseline, as a multiple of size
                              // (ASCENT + DESCENDER = 1.2 keeps the old box height)
  var OVERLAP_TOLERANCE = 0.01; // intersection > 1% of smaller box => flag
  var POINT_R = 10; // circles with r <= 10 count as point anchors (issue #172)
  var LINE_PAD = 2; // line/arrow bbox fattening per side, so touching a wire counts

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
    var w = ADVANCE * size * t.length;
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
  function latexVisible(tex) {
    return String(tex).replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').length;
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
    var w = ADVANCE * size * latexVisible(t);
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
  function isCenteredOn(label, shapeBox) {
    var cx = (label.left + label.right) / 2;
    var cy = (label.top + label.bottom) / 2;
    return cx >= shapeBox.left && cx <= shapeBox.right &&
           cy >= shapeBox.top && cy <= shapeBox.bottom;
  }

  // Probe/marker dots (r <= 10) are point anchors by design — a label
  // touching one is not a defect.
  function isPointShape(shape) {
    return shape.kind === 'circle' && num(shape.r, 0) <= POINT_R;
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
        if (isCenteredOn(L, sb)) return;
        if (isPointShape(S.shape)) return;
        var area = intersectArea(L, sb);
        var smaller = Math.min(boxArea(L), boxArea(sb));
        if (area > OVERLAP_TOLERANCE * smaller) {
          out.push({
            file: file, scene: scene, kind: 'text-shape-overlap',
            detail: L.id + ' collides with ' + sb.id +
              ' (' + Math.round(area) + 'px^2 intersection)'
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
            detail: A.id + ' overlaps ' + B.id + ' (' + Math.round(area) + 'px^2 intersection)'
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
    auditSampleFile: auditSampleFile,
    auditAllSamples: auditAllSamples
  };
});
