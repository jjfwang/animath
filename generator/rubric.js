/* animath teacher rubric — R-4 (+#131): 6-dimension quality score for generated specs.
 *
 * scoreSpec(spec) -> { score, maxScore, dimensions } with six dimensions
 * worth 20 points each (120 total): contract validity, pacing, captions,
 * pedagogy, canvas bounds, mechanism density. A teacher (or the review step)
 * scores a generated spec before showing it to a student. Non-object input
 * scores 0 with a reason and never throws.
 *
 * MEASURED BANDS — computed live over the 69 hand-authored samples
 * (330 scenes, 3415 consecutive step gaps), not invented:
 * - Scene duration_ms: min 6000, max 12000, p5 6000, p95 11000
 *   (SPEC.md allows 4000-12000). The rubric scores the tighter measured
 *   band 6000-12000; a spec inside the SPEC range but outside the measured
 *   band loses pacing points only.
 * - Step spacing (consecutive at_ms gaps, sorted): min 0, max 3700, p5 50,
 *   p95 1600. Any gap > 3700 loses pacing points.
 * - Scene count: 4-8 across the samples (SPEC.md allows 2-8).
 * - Canvas: every sample is 960x540; specs without a canvas default to it.
 * - Captions: all 330 non-empty, 11-61 chars, p95 50. Bound: non-empty,
 *   at most 80 chars.
 * - Text char budget by rendered size (each tier sits above its measured
 *   maximum): size >= 48 -> 24 chars; 32-44 -> 70; 24-30 -> 100;
 *   <= 22 -> 60. Shapes without a numeric size are scored as size 24.
 *   latex shapes carry tex source, not rendered labels, so they get a
 *   separate looser budget of 150 chars.
 *
 * PEDAGOGY HEURISTICS — documented as heuristics, owner-reversible:
 * - kind "problem" follows PROMPTS.md "state the problem -> plan -> solve
 *   -> box the answer": at least 3 scenes plus an answer beat in the final
 *   scene (caption/narration matching /\b(answer|solved|solution|boxed)\b/i,
 *   or an emphasize step there). Zero of the 69 samples are kind "problem",
 *   so this check is untested against ground truth; concept specs are never
 *   failed on it.
 * - When the topic resolves through misconceptionFor() in
 *   generator/build_prompt.js (the reusable lookup — misconceptions.js
 *   holds only the data map, do not copy it), the spec should carry one
 *   wrong-turn marker beat, matched by
 *   /watch out|common mistake|many students|easy to think|\btrap\b|a mistake|
 *   wrong answer|tempting to/i over caption+narration. Measured: only 18/69
 *   exemplars match, so this sub-check is worth at most half the pedagogy
 *   dimension and is skipped when the topic does not resolve.
 * Skip-if-inapplicable: an inapplicable pedagogy sub-check is skipped and
 * the dimension max adjusts (20 with one applicable sub-check, 0 with none,
 * lowering maxScore accordingly).
 *
 * MECHANISM HEURISTICS — documented as heuristics, owner-reversible:
 * - A scene is mechanism-bearing when it shows a genuine state transition:
 *   at least one move step; or staged build (>= 2 show steps of diagram
 *   shapes — rect/circle/line/arrow/polygon, not text/latex — whose
 *   axis-aligned bboxes intersect, ordered across consecutive at_ms beats);
 *   or staged transform (a hide of a diagram shape followed within 1600ms,
 *   the measured p95 consecutive step gap, by a show of a diagram shape
 *   whose bbox intersects the hidden shape's bbox). Which steps were
 *   counted is recorded in the dimension notes.
 * - Bboxes: rect -> (x,y,w,h); circle -> (cx±r, cy±r); line/arrow ->
 *   min/max of x1,x2,y1,y2; polygon -> min/max of points. Shapes with
 *   missing or non-numeric bbox fields count as no-bbox (cannot intersect)
 *   and never throw.
 * - Dimension score = round(20 * mechanism-bearing scenes / total scenes);
 *   a fully text-only spec scores 0.
 *
 * Dependency note: needs player/validate.js and generator/build_prompt.js
 * (in the browser, web/index.html must load them before this file). No
 * circular imports: build_prompt.js only requires misconceptions.js.
 *
 * Works in browser and Node (no DOM, no deps).
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node:coverage ignore next */
  else global.AnimathRubric = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Sibling deps: validateSpec (player/validate.js) and misconceptionFor
  // (generator/build_prompt.js — the reusable lookup, not a copy of the
  // data). In Node we require them; in the browser we fall back to the
  // globals set by web/index.html, defaulting to safe no-ops.
  function loadSiblings() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return {
        validateSpec: require('../player/validate.js').validateSpec,
        misconceptionFor: require('./build_prompt.js').misconceptionFor
      };
    } /* node:coverage ignore next */
    var g = typeof window !== 'undefined' ? window : globalThis;
    var v = g.AnimathValidate && g.AnimathValidate.validateSpec;
    var m = g.AnimathPrompt && g.AnimathPrompt.misconceptionFor;
    return {
      validateSpec: (typeof v === 'function') ? v : function () { return ['rubric: spec validator not loaded']; },
      misconceptionFor: (typeof m === 'function') ? m : function () { return null; }
    };
  }
  var SIBLINGS = loadSiblings();
  var validateSpec = SIBLINGS.validateSpec;
  var misconceptionFor = SIBLINGS.misconceptionFor;

  var DIM_MAX = 20;
  var MIN_DURATION = 6000;   // measured band (SPEC.md allows 4000)
  var MAX_DURATION = 12000;  // measured band (== SPEC.md max)
  var MAX_GAP = 3700;        // measured max consecutive step gap
  var MAX_CAPTION = 80;      // measured max 61, p95 50
  var DEFAULT_W = 960;
  var DEFAULT_H = 540;
  var LATEX_BUDGET = 150;    // tex source, not rendered label
  var WRONG_TURN_RE = /watch out|common mistake|many students|easy to think|\btrap\b|a mistake|wrong answer|tempting to/i;
  var ANSWER_BEAT_RE = /\b(answer|solved|solution|boxed)\b/i;

  function dim(name, score, max, notes) {
    return { name: name, score: score, max: max, notes: notes };
  }

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  function sceneSteps(scene) {
    return (scene && Array.isArray(scene.steps)) ? scene.steps : [];
  }

  function sceneLabel(scene, i) {
    return (scene && scene.id) || ('scenes[' + i + ']');
  }

  // Char budget tier by rendered text size; non-numeric size -> size 24 tier.
  function textBudget(size) {
    var s = (typeof size === 'number' && isFinite(size)) ? size : 24;
    if (s >= 48) return 24;
    if (s >= 32) return 70;
    if (s >= 24) return 100;
    return 60;
  }

  // --- dimension 1: contract validity ------------------------------------

  function scoreContract(spec) {
    var errors = validateSpec(spec);
    if (!errors || errors.length === 0) {
      return dim('contract validity', DIM_MAX, DIM_MAX, []);
    }
    var notes = [];
    errors.slice(0, 5).forEach(function (e) { notes.push(e); });
    if (errors.length > 5) notes.push('... and ' + (errors.length - 5) + ' more');
    return dim('contract validity', 0, DIM_MAX, notes);
  }

  // --- dimension 2: pacing -------------------------------------------------

  function scorePacing(spec) {
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    if (scenes.length === 0) return dim('pacing', 0, DIM_MAX, ['no scenes to pace']);
    var notes = [];
    var ok = 0;
    scenes.forEach(function (scene, i) {
      var id = sceneLabel(scene, i);
      var bad = [];
      var dur = scene ? scene.duration_ms : undefined;
      if (typeof dur !== 'number' || dur < MIN_DURATION || dur > MAX_DURATION) {
        bad.push(id + ': duration_ms ' + dur + ' outside the measured band ' +
          MIN_DURATION + '-' + MAX_DURATION);
      }
      var ats = sceneSteps(scene).map(function (st) { return st && st.at_ms; })
        .filter(function (t) { return typeof t === 'number' && isFinite(t); })
        .sort(function (a, b) { return a - b; });
      for (var k = 1; k < ats.length; k++) {
        var gap = ats[k] - ats[k - 1];
        if (gap > MAX_GAP) {
          bad.push(id + ': step gap ' + gap + 'ms exceeds the measured max ' + MAX_GAP + 'ms');
          break;
        }
      }
      if (bad.length === 0) ok++;
      else notes.push.apply(notes, bad);
    });
    return dim('pacing', Math.round(DIM_MAX * ok / scenes.length), DIM_MAX, notes);
  }

  // --- dimension 3: captions -----------------------------------------------

  function scoreCaptions(spec) {
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    if (scenes.length === 0) return dim('captions', 0, DIM_MAX, ['no scenes to caption']);
    var notes = [];
    var ok = 0;
    scenes.forEach(function (scene, i) {
      var id = sceneLabel(scene, i);
      var cap = scene ? scene.caption : undefined;
      if (typeof cap === 'string' && cap.trim() && cap.length <= MAX_CAPTION) ok++;
      else notes.push(id + ': caption must be non-empty and at most ' + MAX_CAPTION + ' chars');
    });
    return dim('captions', Math.round(DIM_MAX * ok / scenes.length), DIM_MAX, notes);
  }

  // --- dimension 4: pedagogy -------------------------------------------------
  // Heuristics (see module header): skip-if-inapplicable, denominator adjusts.

  function finalScene(spec) {
    var scenes = spec.scenes;
    return scenes[scenes.length - 1];
  }

  function hasAnswerBeat(scene) {
    var text = ((scene && scene.caption) || '') + ' ' + ((scene && scene.narration) || '');
    if (ANSWER_BEAT_RE.test(text)) return true;
    var steps = sceneSteps(scene);
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] && steps[i].do === 'emphasize') return true;
    }
    return false;
  }

  function hasWrongTurnMarker(spec) {
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i];
      var text = ((sc && sc.caption) || '') + ' ' + ((sc && sc.narration) || '');
      if (WRONG_TURN_RE.test(text)) return true;
    }
    return false;
  }

  function scorePedagogy(spec) {
    var notes = [];
    var checks = [];
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    if (spec.kind === 'problem') {
      var sceneCountOk = scenes.length >= 3;
      var beatOk = scenes.length > 0 && hasAnswerBeat(finalScene(spec));
      var pass = sceneCountOk && beatOk;
      checks.push({ name: 'worked-solution arc', pass: pass });
      if (pass) {
        notes.push('worked-solution arc: answer beat present in the final scene');
      } else if (!sceneCountOk) {
        notes.push('worked-solution arc: kind "problem" needs at least 3 scenes (has ' +
          scenes.length + ')');
      } else {
        notes.push('worked-solution arc: no answer beat in the final scene ' +
          '(no /\\b(answer|solved|solution|boxed)\\b/i in caption/narration, no emphasize step)');
      }
    } else {
      notes.push('worked-solution arc: skipped (heuristic applies to kind "problem" only)');
    }
    var topic = (typeof spec.topic === 'string') ? spec.topic : '';
    if (topic && misconceptionFor(topic)) {
      var markerOk = hasWrongTurnMarker(spec);
      checks.push({ name: 'wrong-turn marker', pass: markerOk });
      if (markerOk) notes.push('wrong-turn marker: marker beat present');
      else notes.push('wrong-turn marker: no scene matches the marker heuristic');
    } else {
      notes.push('wrong-turn marker: skipped (topic "' + topic + '" not in the misconception library)');
    }
    if (checks.length === 0) {
      notes.push('no applicable pedagogy checks for this spec');
      return dim('pedagogy', 0, 0, notes);
    }
    var weight = DIM_MAX / checks.length;
    var s = 0;
    checks.forEach(function (c) { if (c.pass) s += weight; });
    return dim('pedagogy', Math.round(s), DIM_MAX, notes);
  }

  // --- dimension 5: canvas bounds + text budgets -----------------------------

  function shapeOutOfBounds(shape, W, H) {
    switch (shape.kind) {
      case 'text':
      case 'latex':
        return shape.x < 0 || shape.y < 0 || shape.x > W || shape.y > H;
      case 'rect':
        return shape.x < 0 || shape.y < 0 || shape.x + shape.w > W || shape.y + shape.h > H;
      case 'circle':
        return shape.cx - shape.r < 0 || shape.cy - shape.r < 0 ||
          shape.cx + shape.r > W || shape.cy + shape.r > H;
      case 'line':
      case 'arrow':
        return shape.x1 < 0 || shape.y1 < 0 || shape.x1 > W || shape.y1 > H ||
          shape.x2 < 0 || shape.y2 < 0 || shape.x2 > W || shape.y2 > H;
      case 'polygon': {
        var pts = shape.points;
        if (!Array.isArray(pts)) return false;
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          if (!Array.isArray(p) || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  function textBudgetIssue(shape) {
    if (shape.kind === 'text') {
      var t = shape.text;
      if (typeof t === 'string') {
        var budget = textBudget(shape.size);
        if (t.length > budget) {
          return 'text is ' + t.length + ' chars, over the budget of ' + budget +
            ' for size ' + shape.size;
        }
      }
    } else if (shape.kind === 'latex') {
      var tex = shape.tex;
      if (typeof tex === 'string' && tex.length > LATEX_BUDGET) {
        return 'tex source is ' + tex.length + ' chars, over the latex budget of ' + LATEX_BUDGET;
      }
    }
    return null;
  }

  function scoreCanvas(spec) {
    var W = (spec.canvas && typeof spec.canvas.width === 'number') ? spec.canvas.width : DEFAULT_W;
    var H = (spec.canvas && typeof spec.canvas.height === 'number') ? spec.canvas.height : DEFAULT_H;
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    var shapes = [];
    scenes.forEach(function (scene, i) {
      sceneSteps(scene).forEach(function (step) {
        if (step && step.do === 'show' && step.shape && typeof step.shape === 'object') {
          shapes.push({ shape: step.shape, scene: sceneLabel(scene, i) });
        }
      });
    });
    if (shapes.length === 0) return dim('canvas bounds', 0, DIM_MAX, ['no shapes to check']);
    var notes = [];
    var ok = 0;
    shapes.forEach(function (entry) {
      var shape = entry.shape;
      var label = entry.scene + '/' + (shape.id || '?');
      var failed = false;
      if (shapeOutOfBounds(shape, W, H)) {
        failed = true;
        notes.push(label + ': extends outside the ' + W + 'x' + H + ' canvas');
      }
      var issue = textBudgetIssue(shape);
      if (issue) {
        failed = true;
        notes.push(label + ': ' + issue);
      }
      if (!failed) ok++;
    });
    return dim('canvas bounds', Math.round(DIM_MAX * ok / shapes.length), DIM_MAX, notes);
  }

  // --- dimension 6: mechanism density ----------------------------------------
  // Heuristic (see module header): a scene is mechanism-bearing when it shows
  // a genuine state transition — move steps, a staged diagram build, or a
  // staged diagram rebuild. Owner-reversible.

  var STAGE_MS = 1600; // measured p95 consecutive step gap

  function num(x) {
    return (typeof x === 'number' && isFinite(x)) ? x : undefined;
  }

  function atMsOf(step) {
    var t = num(step && step.at_ms);
    return (t === undefined) ? 0 : t;
  }

  // Axis-aligned bbox of a diagram shape, or null for non-diagram shapes
  // (text/latex/unknown kinds) and for shapes with missing or non-numeric
  // bbox fields — those count as no-bbox and never throw.
  function shapeBbox(shape) {
    var x0, y0, x1, y1;
    switch (shape.kind) {
      case 'rect': {
        var x = num(shape.x), y = num(shape.y), w = num(shape.w), h = num(shape.h);
        if (x === undefined || y === undefined || w === undefined || h === undefined) return null;
        x0 = x; y0 = y; x1 = x + w; y1 = y + h;
        break;
      }
      case 'circle': {
        var cx = num(shape.cx), cy = num(shape.cy), r = num(shape.r);
        if (cx === undefined || cy === undefined || r === undefined) return null;
        x0 = cx - r; y0 = cy - r; x1 = cx + r; y1 = cy + r;
        break;
      }
      case 'line':
      case 'arrow': {
        var x1n = num(shape.x1), y1n = num(shape.y1);
        var x2n = num(shape.x2), y2n = num(shape.y2);
        if (x1n === undefined || y1n === undefined || x2n === undefined || y2n === undefined) return null;
        x0 = Math.min(x1n, x2n); y0 = Math.min(y1n, y2n);
        x1 = Math.max(x1n, x2n); y1 = Math.max(y1n, y2n);
        break;
      }
      case 'polygon': {
        var pts = shape.points;
        if (!Array.isArray(pts) || pts.length === 0) return null;
        var xs = [], ys = [];
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var px = p && num(p[0]), py = p && num(p[1]);
          if (px === undefined || py === undefined) return null;
          xs.push(px); ys.push(py);
        }
        x0 = Math.min.apply(null, xs); y0 = Math.min.apply(null, ys);
        x1 = Math.max.apply(null, xs); y1 = Math.max.apply(null, ys);
        break;
      }
      default:
        return null;
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function bboxesIntersect(a, b) {
    return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
  }

  function shapeRef(entry) {
    return entry.id || 'a diagram shape';
  }

  // Evidence strings for one scene; empty when the scene is not
  // mechanism-bearing.
  function sceneMechanism(scene) {
    var evidence = [];
    var byId = {};  // diagram-shape bboxes keyed by shown id
    var shows = []; // { at_ms, bbox, id }
    var hides = []; // { target, at_ms }
    sceneSteps(scene).forEach(function (step) {
      if (!step) return;
      if (step.do === 'move') {
        evidence.push('move step at ' + atMsOf(step) + 'ms');
      } else if (step.do === 'show' && step.shape && typeof step.shape === 'object') {
        var bb = shapeBbox(step.shape);
        var id = step.shape.id;
        shows.push({ at_ms: atMsOf(step), bbox: bb, id: id });
        if (typeof id === 'string') byId[id] = bb;
      } else if (step.do === 'hide' && typeof step.target === 'string') {
        hides.push({ target: step.target, at_ms: atMsOf(step) });
      }
    });
    // Staged build: two diagram shows at consecutive beats sharing a region.
    var ordered = shows.slice().sort(function (a, b) { return a.at_ms - b.at_ms; });
    for (var i = 1; i < ordered.length; i++) {
      var prev = ordered[i - 1], cur = ordered[i];
      if (prev.bbox && cur.bbox && bboxesIntersect(prev.bbox, cur.bbox)) {
        evidence.push('staged build: ' + shapeRef(prev) + ' and ' + shapeRef(cur) +
          ' share a diagram region (' + prev.at_ms + 'ms, ' + cur.at_ms + 'ms)');
        break;
      }
    }
    // Staged transform: a hide followed within STAGE_MS by an intersecting
    // show — the diagram is rebuilt or replaced.
    hides.forEach(function (h) {
      var old = byId[h.target];
      if (!old) return;
      for (var j = 0; j < shows.length; j++) {
        var gap = shows[j].at_ms - h.at_ms;
        if (gap >= 0 && gap <= STAGE_MS && shows[j].bbox &&
            bboxesIntersect(old, shows[j].bbox)) {
          evidence.push('rebuild: ' + shapeRef(shows[j]) + ' replaces ' + h.target +
            ' within ' + gap + 'ms');
          return;
        }
      }
    });
    return evidence;
  }

  function scoreMechanism(spec) {
    var scenes = Array.isArray(spec.scenes) ? spec.scenes : [];
    if (scenes.length === 0) return dim('mechanism density', 0, DIM_MAX, ['no scenes to score']);
    var notes = [];
    var ok = 0;
    scenes.forEach(function (scene, i) {
      var id = sceneLabel(scene, i);
      var evidence = sceneMechanism(scene);
      if (evidence.length > 0) {
        ok++;
        notes.push(id + ': ' + evidence.join('; '));
      } else {
        notes.push(id + ': no mechanism (no move steps, no staged diagram build or rebuild)');
      }
    });
    return dim('mechanism density', Math.round(DIM_MAX * ok / scenes.length), DIM_MAX, notes);
  }

  // --- entry point -----------------------------------------------------------

  function scoreSpec(spec) {
    if (!isObj(spec)) {
      return {
        score: 0,
        maxScore: 0,
        dimensions: [dim('invalid input', 0, 0,
          ['spec must be a non-null object; scored 0 without throwing'])]
      };
    }
    var dimensions = [
      scoreContract(spec),
      scorePacing(spec),
      scoreCaptions(spec),
      scorePedagogy(spec),
      scoreCanvas(spec),
      scoreMechanism(spec)
    ];
    var score = 0;
    var maxScore = 0;
    dimensions.forEach(function (d) { score += d.score; maxScore += d.max; });
    return { score: score, maxScore: maxScore, dimensions: dimensions };
  }

  return { scoreSpec: scoreSpec };
});
