/* animath static geometry audit — R-5 headless sample check, slice 1.
 *
 * auditGeometry(spec[, fileName]) walks a spec scene by scene, collects every
 * `show`-step `text`/`latex` shape at its show-time position, and returns an
 * array of finding records: { file, scene, kind, detail }, where kind is
 * 'overflow' (a text box crossing the canvas edge, or a latex anchor outside
 * the canvas) or 'overlap' (two text boxes whose intersection area exceeds
 * the tolerance below). Empty array = clean. Never throws on invalid input:
 * null specs, empty scenes, missing size/text all return [] (or skip the
 * shape).
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
 * existing text-tier convention). The box's top edge is the shape's y and
 * its horizontal origin is resolved from align: 'start' (default, per
 * SPEC.md line 64 and player/player.js `'text-anchor': opts.align ||
 * 'start'`) anchors the left edge at x; 'middle' centers the box on x;
 * 'end' puts the right edge at x.
 *
 * OVERLAP TOLERANCE: a pair is flagged only when the intersection area
 * exceeds 1% of the smaller box's area, so grazing adjacency (touching
 * edges, sub-pixel kissing) is not reported.
 *
 * LATEX SHAPES: anchor-in-canvas check only (x/y within 0..W/H). KaTeX
 * rendered width is not statically computable, so no width estimate is
 * attempted — documented, not a gap.
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
  var LINE_HEIGHT = 1.2;      // box height as a multiple of size
  var OVERLAP_TOLERANCE = 0.01; // intersection > 1% of smaller box => flag

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
    var h = LINE_HEIGHT * size;
    var x = num(shape.x, 0);
    var y = num(shape.y, 0);
    var a = alignOf(shape);
    var left = a === 'middle' ? x - w / 2 : (a === 'end' ? x - w : x);
    return { id: shape.id || '?', left: left, top: y, right: left + w, bottom: y + h };
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

  function checkOverlaps(boxes, scene, file, out) {
    for (var a = 0; a < boxes.length; a++) {
      for (var b = a + 1; b < boxes.length; b++) {
        var A = boxes[a];
        var B = boxes[b];
        var ix = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        var iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ix > 0 && iy > 0) {
          var area = ix * iy;
          var smaller = Math.min(
            (A.right - A.left) * (A.bottom - A.top),
            (B.right - B.left) * (B.bottom - B.top)
          );
          if (area > OVERLAP_TOLERANCE * smaller) {
            out.push({
              file: file, scene: scene, kind: 'overlap',
              detail: A.id + ' overlaps ' + B.id + ' (' + Math.round(area) + 'px^2 intersection)'
            });
          }
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
      var boxes = [];
      var steps = (scene && Array.isArray(scene.steps)) ? scene.steps : [];
      steps.forEach(function (step) {
        var shape = step && step.do === 'show' && step.shape;
        if (!isObj(shape)) return;
        if (shape.kind === 'text') {
          var box = textBox(shape);
          if (box) {
            boxes.push(box);
            checkOverflow(box, label, file, canvas, findings);
          }
        } else if (shape.kind === 'latex') {
          checkLatexAnchor(shape, label, file, canvas, findings);
        }
      });
      checkOverlaps(boxes, label, file, findings);
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
