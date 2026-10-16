/* animath spec validator v0.1 — reference implementation of SPEC.md.
 * Returns an array of error strings; empty means valid.
 * Works in browser and Node (no DOM, no deps).
 */
(function (global, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AnimathValidate = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LEVELS = ['primary', 'secondary', 'jc'];
  // SUBJECTS is the syllabus-known list, used for gallery/coverage — NOT
  // an admission list: validateSpec accepts any non-empty subject string.
  var SUBJECTS = ['math', 'science', 'geography'];
  var KINDS = ['concept', 'problem'];
  var VERBS = ['show', 'hide', 'move', 'emphasize', 'caption'];
  var SHAPES = ['text', 'rect', 'circle', 'line', 'arrow', 'polygon', 'latex', 'sector'];
  var MOVEABLE = ['text', 'rect', 'circle', 'line', 'arrow', 'latex', 'polygon'];
  var HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
  // Dash pattern: one or more numbers separated by whitespace (e.g. "6 4").
  var DASH = /^\d+(\.\d+)?(\s+\d+(\.\d+)?)*$/;

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  // Width profile for tapered arrows (issue #164): [tailWidth, headWidth],
  // exactly two positive numbers. Shared by the show-time check and the
  // move-time `widths` field check.
  function isWidths(x) {
    return Array.isArray(x) && x.length === 2 && isNum(x[0]) && x[0] > 0 && isNum(x[1]) && x[1] > 0;
  }

  function checkShape(shape, errors, where) {
    var p = where + '.shape';
    if (!shape || typeof shape !== 'object') { errors.push(p + ': must be an object'); return; }
    if (typeof shape.id !== 'string' || !shape.id) errors.push(p + '.id: required non-empty string');
    if (SHAPES.indexOf(shape.kind) === -1) {
      errors.push(p + '.kind: must be one of ' + SHAPES.join('|'));
      return;
    }
    function num(field) {
      if (!isNum(shape[field])) errors.push(p + '.' + field + ': required number');
    }
    switch (shape.kind) {
      case 'text':
        num('x'); num('y');
        if (typeof shape.text !== 'string') errors.push(p + '.text: required string');
        if (shape.text && /\\[a-zA-Z]+/.test(shape.text)) {
          errors.push(p + '.text: LaTeX commands are not supported in text shapes — use unicode math or a latex shape');
        }
        if (shape.align !== undefined && ['start', 'middle', 'end'].indexOf(shape.align) === -1) {
          errors.push(p + '.align: must be start|middle|end');
        }
        if (shape.size !== undefined && !isNum(shape.size)) errors.push(p + '.size: must be a number');
        break;
      case 'latex':
        num('x'); num('y');
        if (typeof shape.tex !== 'string' || !shape.tex) errors.push(p + '.tex: required non-empty string');
        if (shape.size !== undefined && !isNum(shape.size)) errors.push(p + '.size: must be a number');
        break;
      case 'rect': num('x'); num('y'); num('w'); num('h'); break;
      case 'circle': num('cx'); num('cy'); num('r'); break;
      case 'line':
        num('x1'); num('y1'); num('x2'); num('y2');
        // dash is optional; absent or empty string = solid.
        if (shape.dash !== undefined && shape.dash !== '') {
          if (typeof shape.dash !== 'string' || !DASH.test(shape.dash.trim())) {
            errors.push(p + '.dash: must be a string of space-separated numbers like "6 4"');
          }
        }
        break;
      case 'arrow':
        num('x1'); num('y1'); num('x2'); num('y2');
        // widths is optional; [tailWidth, headWidth] for a tapered shaft.
        if (shape.widths !== undefined && !isWidths(shape.widths)) {
          errors.push(p + '.widths: must be an array of two positive numbers [tailWidth, headWidth]');
        }
        // dash is optional; absent or empty string = solid. Ignored on a
        // tapered shaft (SPEC.md), but still validated here when present.
        if (shape.dash !== undefined && shape.dash !== '') {
          if (typeof shape.dash !== 'string' || !DASH.test(shape.dash.trim())) {
            errors.push(p + '.dash: must be a string of space-separated numbers like "6 4"');
          }
        }
        break;
      case 'polygon':
        if (!Array.isArray(shape.points) || shape.points.length < 3 ||
            !shape.points.every(function (pt) { return Array.isArray(pt) && pt.length === 2 && isNum(pt[0]) && isNum(pt[1]); })) {
          errors.push(p + '.points: required array of [x,y] pairs (min 3)');
        }
        break;
      case 'sector':
        // Not moveable in v0: intentionally absent from MOVEABLE above.
        num('cx'); num('cy');
        if (!isNum(shape.r) || shape.r <= 0) errors.push(p + '.r: required positive number');
        num('startAngle'); num('endAngle');
        break;
    }
    // "Explain me this" tooltip text (issue #173): any shape kind may
    // carry it; it must be a string when present. The player shows the
    // tooltip; empty or whitespace-only strings are inert.
    if (shape.explain !== undefined && typeof shape.explain !== 'string') {
      errors.push(p + '.explain: must be a string when present');
    }
    ['fill', 'stroke', 'color'].forEach(function (f) {
      if (shape[f] !== undefined && (typeof shape[f] !== 'string' ||
          !(HEX.test(shape[f]) || shape[f] === 'none'))) {
        errors.push(p + '.' + f + ': must be a CSS hex color or "none"');
      }
    });
  }

  function validateSpec(spec) {
    var errors = [];
    if (!spec || typeof spec !== 'object') return ['spec: must be an object'];
    if (spec.animath !== '0.1') errors.push('animath: must be "0.1"');
    if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push('title: required non-empty string');
    if (LEVELS.indexOf(spec.level) === -1) errors.push('level: must be ' + LEVELS.join('|'));
    if (typeof spec.subject !== 'string' || !spec.subject.trim()) errors.push('subject: required non-empty string');
    if (typeof spec.topic !== 'string' || !spec.topic.trim()) errors.push('topic: required non-empty slug string');
    if (KINDS.indexOf(spec.kind) === -1) errors.push('kind: must be ' + KINDS.join('|'));
    if (!spec.canvas || !isNum(spec.canvas.width) || !isNum(spec.canvas.height)) {
      errors.push('canvas: required {width,height} numbers');
    }
    // 1..8 scenes: a single holistic scene is legitimate staging for a
    // cycle or system topic (owner direction 2026-10-12) — the whole loop
    // or system is visible at once, so splitting it would hide the concept.
    if (!Array.isArray(spec.scenes) || spec.scenes.length < 1 || spec.scenes.length > 8) {
      errors.push('scenes: required array of 1..8 scenes');
      return errors;
    }
    var sceneIds = {};
    spec.scenes.forEach(function (scene, i) {
      var w = 'scenes[' + i + ']';
      if (!scene || typeof scene !== 'object') { errors.push(w + ': must be an object'); return; }
      if (typeof scene.id !== 'string' || !scene.id) errors.push(w + '.id: required non-empty string');
      else if (sceneIds[scene.id]) errors.push(w + '.id: duplicate scene id "' + scene.id + '"');
      else sceneIds[scene.id] = true;
      if (typeof scene.caption !== 'string' || !scene.caption.trim()) errors.push(w + '.caption: required non-empty string');
      if (typeof scene.narration !== 'string' || !scene.narration.trim()) errors.push(w + '.narration: required non-empty string');
      if (!isNum(scene.duration_ms) || scene.duration_ms < 4000 || scene.duration_ms > 12000) {
        errors.push(w + '.duration_ms: required number 4000..12000');
      }
      if (!Array.isArray(scene.steps) || scene.steps.length === 0) {
        errors.push(w + '.steps: required non-empty array');
        return;
      }
      var shown = {};   // shape id -> shape kind, in at_ms order
      var pointCount = {};   // shape id -> polygon vertex count at show time
      var shapeIds = {};
      var lastAt = -1;
      scene.steps.forEach(function (step, j) {
        var s = w + '.steps[' + j + ']';
        if (!step || typeof step !== 'object') { errors.push(s + ': must be an object'); return; }
        if (!isNum(step.at_ms) || step.at_ms < 0 || (isNum(scene.duration_ms) && step.at_ms >= scene.duration_ms)) {
          errors.push(s + '.at_ms: required number, 0 <= at_ms < duration_ms');
        }
        if (step.at_ms < lastAt) errors.push(s + '.at_ms: steps should be ordered ascending');
        lastAt = step.at_ms;
        if (VERBS.indexOf(step.do) === -1) {
          errors.push(s + '.do: must be ' + VERBS.join('|'));
          return;
        }
        if (step.do === 'show') {
          checkShape(step.shape, errors, s);
          if (step.shape && typeof step.shape.id === 'string') {
            if (shapeIds[step.shape.id]) errors.push(s + '.shape.id: duplicate shape id "' + step.shape.id + '" in scene');
            shapeIds[step.shape.id] = true;
            shown[step.shape.id] = step.shape.kind;
            if (step.shape.kind === 'polygon' && Array.isArray(step.shape.points)) {
              pointCount[step.shape.id] = step.shape.points.length;
            }
          }
        } else if (step.do === 'caption') {
          if (typeof step.text !== 'string' || !step.text.trim()) errors.push(s + '.text: required non-empty string');
        } else {
          if (typeof step.target !== 'string' || !step.target) {
            errors.push(s + '.target: required shape id');
          } else if (!shown[step.target]) {
            errors.push(s + '.target: "' + step.target + '" must be shown earlier in the same scene');
          }
          if (step.do === 'move') {
            // SPEC.md: moveable kinds are text, rect, circle, line, arrow,
            // latex, polygon. `to` must carry at least one field and every
            // field must be valid for the target kind: position fields plus
            // w/h for rect, r for circle, `widths` for arrow (the
            // [tail,head] taper pair). Polygon `to` carries only
            // `points`, an array of [x,y] pairs matching the shown shape's
            // vertex count, interpolated pointwise.
            var MOVE_FIELDS = {
              text: ['x', 'y'], latex: ['x', 'y'],
              rect: ['x', 'y', 'w', 'h'], circle: ['cx', 'cy', 'r'],
              line: ['x1', 'y1', 'x2', 'y2'],
              arrow: ['x1', 'y1', 'x2', 'y2', 'widths'],
              polygon: ['points']
            };
            var targetKind = (typeof step.target === 'string' && step.target && shown[step.target])
              ? shown[step.target] : null;
            if (targetKind && MOVEABLE.indexOf(targetKind) === -1) {
              errors.push(s + '.target: kind "' + targetKind + '" is not moveable in v0');
            }
            if (!step.to || typeof step.to !== 'object') {
              errors.push(s + '.to: required position object');
            } else {
              var keys = Object.keys(step.to);
              var isPoly = targetKind === 'polygon' && keys.length === 1 && keys[0] === 'points';
              var fieldsOk = isPoly
                ? Array.isArray(step.to.points) && step.to.points.length > 0 &&
                  step.to.points.every(function (pt) {
                    return Array.isArray(pt) && pt.length === 2 && isNum(pt[0]) && isNum(pt[1]);
                  })
                : keys.length > 0 && keys.every(function (k) {
                    // Issue #164: an arrow move may animate the taper — the
                    // widths value is a [tail,head] pair, not a scalar.
                    if (targetKind === 'arrow' && k === 'widths') return isWidths(step.to[k]);
                    return isNum(step.to[k]);
                  });
              if (!fieldsOk) {
                errors.push(s + '.to: must carry at least one numeric field' +
                  (isPoly ? ' — points must be an array of numeric [x,y] pairs' : ''));
              } else if (targetKind && MOVE_FIELDS[targetKind]) {
                var want = MOVE_FIELDS[targetKind];
                var bad = keys.filter(function (k) { return want.indexOf(k) === -1; });
                if (bad.length) {
                  errors.push(s + '.to: invalid field(s) for kind "' + targetKind + '": ' +
                    bad.join(',') + ' — valid fields: ' + want.join(','));
                } else if (targetKind === 'polygon' && isNum(pointCount[step.target]) &&
                    step.to.points.length !== pointCount[step.target]) {
                  errors.push(s + '.to.points: point count (' + step.to.points.length +
                    ') must match the shown shape\'s points (' + pointCount[step.target] + ')');
                }
              }
            }
            if (!isNum(step.dur_ms)) errors.push(s + '.dur_ms: required number');
          }
        }
      });
    });
    return errors;
  }

  var SLIDE_KINDS = ['title', 'objective', 'hook', 'concept', 'mechanism', 'example', 'practice', 'exit-ticket'];

  // A slide visual is valid in exactly two forms (SPEC.md "Slide spec"):
  // a non-empty animation scene id string, or a descriptor object with a
  // non-empty sceneId and/or a shape kind from SHAPES. When both fields
  // are present, both must be valid. Anything else is a dangling
  // reference. Scene-id resolution is NOT attempted here.
  function isValidSlideVisual(v) {
    if (typeof v === 'string') return v.trim().length > 0;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    var hasSceneId = typeof v.sceneId === 'string' && v.sceneId.trim().length > 0;
    var hasKind = SHAPES.indexOf(v.kind) !== -1;
    if (v.sceneId !== undefined && !hasSceneId) return false;
    if (v.kind !== undefined && !hasKind) return false;
    return hasSceneId || hasKind;
  }

  // Slide-deck validator (SPEC.md "Slide spec"): same contract as
  // validateSpec — returns an array of error strings; empty means valid.
  function validateSlides(spec) {
    var errors = [];
    if (!spec || typeof spec !== 'object') return ['spec: must be an object'];
    if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push('title: required non-empty string');
    if (LEVELS.indexOf(spec.level) === -1) errors.push('level: must be ' + LEVELS.join('|'));
    // Subject is any non-empty string (like validateSpec) — NOT checked
    // against SUBJECTS, which is only the syllabus-known list.
    if (typeof spec.subject !== 'string' || !spec.subject.trim()) errors.push('subject: required non-empty string');
    if (typeof spec.topic !== 'string' || !spec.topic.trim()) errors.push('topic: required non-empty string');
    if (!Array.isArray(spec.slides) || spec.slides.length === 0) {
      errors.push('slides: required non-empty array');
      return errors;
    }
    var kinds = [];   // valid kind per slide index, null when absent/invalid
    spec.slides.forEach(function (slide, i) {
      var w = 'slides[' + i + ']';
      if (!slide || typeof slide !== 'object') { errors.push(w + ': must be an object'); kinds.push(null); return; }
      if (SLIDE_KINDS.indexOf(slide.kind) === -1) {
        errors.push(w + '.kind: must be ' + SLIDE_KINDS.join('|'));
        kinds.push(null);
      } else {
        kinds.push(slide.kind);
      }
      var hasHeading = typeof slide.heading === 'string' && slide.heading.trim().length > 0;
      if (slide.heading !== undefined && !hasHeading) {
        errors.push(w + '.heading: must be a non-empty string when present');
      }
      var hasBullets = Array.isArray(slide.bullets) && slide.bullets.length >= 1;
      if (slide.bullets !== undefined) {
        if (!Array.isArray(slide.bullets)) {
          errors.push(w + '.bullets: must be an array when present');
        } else {
          slide.bullets.forEach(function (b, j) {
            if (typeof b !== 'string' || !b.trim()) {
              errors.push(w + '.bullets[' + j + ']: required non-empty string');
            }
          });
        }
      }
      if (!hasHeading && !hasBullets) errors.push(w + ': must have a heading or non-empty bullets');
      if (slide.notes !== undefined && typeof slide.notes !== 'string') {
        errors.push(w + '.notes: must be a string when present');
      }
      if (slide.visual !== undefined && !isValidSlideVisual(slide.visual)) {
        errors.push(w + '.visual: dangling visual reference — must be a non-empty scene id string or a descriptor with a non-empty sceneId or a shape kind');
      }
    });
    // Ordering, over slides with a valid kind only.
    if (kinds.indexOf('title') === -1) errors.push('slides: missing a title slide');
    else if (kinds[0] !== 'title') errors.push('slides[0].kind: title slide must be first');
    if (kinds.indexOf('exit-ticket') === -1) errors.push('slides: missing an exit-ticket slide');
    else if (kinds[kinds.length - 1] !== 'exit-ticket') {
      errors.push('slides[' + (kinds.length - 1) + '].kind: exit-ticket slide must be last');
    }
    var objIdx = kinds.indexOf('objective');
    if (objIdx !== -1) {
      var cmIdx = -1;
      for (var k = 0; k < kinds.length; k++) {
        if (kinds[k] === 'concept' || kinds[k] === 'mechanism') { cmIdx = k; break; }
      }
      if (cmIdx !== -1 && objIdx > cmIdx) {
        errors.push('slides: objective slide must come before concept/mechanism slides');
      }
    }
    return errors;
  }

  var QUESTION_KINDS = ['multiple-choice', 'short-answer'];

  // Header shared by the worksheet and exit-ticket contracts (SPEC.md):
  // identical checks to validateSlides — subject is any non-empty string,
  // NOT checked against SUBJECTS.
  function checkMaterialHeader(spec, errors) {
    if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push('title: required non-empty string');
    if (LEVELS.indexOf(spec.level) === -1) errors.push('level: must be ' + LEVELS.join('|'));
    if (typeof spec.subject !== 'string' || !spec.subject.trim()) errors.push('subject: required non-empty string');
    if (typeof spec.topic !== 'string' || !spec.topic.trim()) errors.push('topic: required non-empty string');
  }

  // One worksheet / exit-ticket question (SPEC.md "Question"): the kind
  // decides which answer field is required — choices with exactly one
  // correct: true for multiple-choice, a non-empty answer for
  // short-answer. explanation (worksheet answer key), feedback
  // (exit-ticket per-answer feedback) and misconception are optional and
  // validated non-empty only where present.
  function checkQuestion(question, errors, i, seenIds) {
    var p = 'questions[' + i + ']';
    if (!question || typeof question !== 'object') { errors.push(p + ': must be an object'); return; }
    if (typeof question.id !== 'string' || !question.id.trim()) {
      errors.push(p + '.id: required non-empty string');
    } else if (seenIds[question.id]) {
      errors.push(p + '.id: duplicate question id "' + question.id + '"');
    } else {
      seenIds[question.id] = true;
    }
    if (typeof question.prompt !== 'string' || !question.prompt.trim()) {
      errors.push(p + '.prompt: required non-empty string');
    }
    ['explanation', 'feedback', 'misconception'].forEach(function (f) {
      if (question[f] !== undefined && (typeof question[f] !== 'string' || !question[f].trim())) {
        errors.push(p + '.' + f + ': must be a non-empty string when present');
      }
    });
    if (QUESTION_KINDS.indexOf(question.kind) === -1) {
      errors.push(p + '.kind: must be ' + QUESTION_KINDS.join('|'));
      return;
    }
    if (question.kind === 'multiple-choice') {
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push(p + '.choices: required array of at least 2 choices');
        return;
      }
      var correctCount = 0;
      question.choices.forEach(function (choice, j) {
        var c = p + '.choices[' + j + ']';
        if (!choice || typeof choice !== 'object') { errors.push(c + ': must be an object'); return; }
        if (typeof choice.text !== 'string' || !choice.text.trim()) {
          errors.push(c + '.text: required non-empty string');
        }
        if (choice.correct === true) correctCount++;
      });
      if (correctCount !== 1) {
        errors.push(p + '.choices: exactly one choice must be marked correct');
      }
    } else if (typeof question.answer !== 'string' || !question.answer.trim()) {
      errors.push(p + '.answer: required non-empty string');
    }
  }

  // Shared worksheet / exit-ticket validator: the two contracts differ
  // only in the question-count bounds.
  function validateMaterial(spec, min, max, rangeError) {
    var errors = [];
    if (!spec || typeof spec !== 'object') return ['spec: must be an object'];
    checkMaterialHeader(spec, errors);
    if (!Array.isArray(spec.questions) || spec.questions.length < min || spec.questions.length > max) {
      errors.push(rangeError);
      return errors;
    }
    var seenIds = {};
    spec.questions.forEach(function (question, i) {
      checkQuestion(question, errors, i, seenIds);
    });
    return errors;
  }

  // Worksheet validator (SPEC.md "Worksheet spec"): at least 1 question;
  // the answer key is the per-question explanation / misconception fields.
  function validateWorksheet(spec) {
    return validateMaterial(spec, 1, Infinity, 'questions: required array of 1 or more questions');
  }

  // Exit-ticket validator (SPEC.md "Exit ticket spec"): 3..5 questions;
  // per-answer feedback is keyed to misconceptions on each question.
  function validateExitTicket(spec) {
    return validateMaterial(spec, 3, 5, 'questions: required array of 3..5 questions');
  }

  return { validateSpec: validateSpec, validateSlides: validateSlides, validateWorksheet: validateWorksheet, validateExitTicket: validateExitTicket, SUBJECTS: SUBJECTS };
});

/* ------------------------------------------------------------------
 * Node CLI entry point (issue #500): `node player/validate.js <spec.json>`
 *
 * Node-only and guarded by `require.main === module`, so requiring this
 * file as a module — or loading it in a browser via the UMD wrapper
 * above — never runs the CLI. The validator itself is untouched.
 * ------------------------------------------------------------------ */
(function validateCli() {
  'use strict';
  // Browser / non-Node runtimes: the UMD wrapper above already exported the API.
  if (typeof require === 'undefined' || typeof module === 'undefined' || !module.exports) return;
  var validateSpec = module.exports.validateSpec;

  function cliUsage() {
    return 'Usage: node player/validate.js <spec.json>\n' +
      'Validate an animath animation spec file against SPEC.md.\n' +
      'Exit codes: 0 = valid spec; 2 = spec has validation errors; 1 = bad\n' +
      'arguments, unreadable file, or invalid JSON.';
  }

  // Pure CLI core: returns { code, output }. Exercised via spawnSync (the
  // child process's coverage merges into the parent report under
  // `node --test --experimental-test-coverage`).
  function cliMain(args, readFileSync) {
    if (args.length !== 1) {
      return { code: 1, output: 'error: expected exactly one <spec.json> argument\n\n' + cliUsage() + '\n' };
    }
    var file = args[0];
    var raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (err) {
      return { code: 1, output: 'error: cannot read file "' + file + '"\n' };
    }
    var spec;
    try {
      spec = JSON.parse(raw);
    } catch (err) {
      return { code: 1, output: 'error: "' + file + '" is not valid JSON\n' };
    }
    var errors = validateSpec(spec);
    if (errors.length > 0) {
      return { code: 2, output: errors.join('\n') + '\n' };
    }
    return { code: 0, output: 'ok: "' + file + '" is a valid animath spec\n' };
  }

  // Thin entry point: only when this file is the main Node script.
  // The validator's findings (exit 0/2) go to stdout; usage, argument,
  // file, and JSON errors (exit 1) go to stderr.
  if (require.main !== module) return;
  var result = cliMain(process.argv.slice(2), require('fs').readFileSync);
  (result.code === 1 ? process.stderr : process.stdout).write(result.output);
  process.exit(result.code);
})();
