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
  var SUBJECTS = ['math', 'science'];
  var KINDS = ['concept', 'problem'];
  var VERBS = ['show', 'hide', 'move', 'emphasize', 'caption'];
  var SHAPES = ['text', 'rect', 'circle', 'line', 'arrow', 'polygon', 'latex', 'sector'];
  var MOVEABLE = ['text', 'rect', 'circle', 'line', 'arrow', 'latex', 'polygon'];
  var HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

  function isNum(x) { return typeof x === 'number' && isFinite(x); }

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
      case 'arrow': num('x1'); num('y1'); num('x2'); num('y2'); break;
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
    if (SUBJECTS.indexOf(spec.subject) === -1) errors.push('subject: must be ' + SUBJECTS.join('|'));
    if (typeof spec.topic !== 'string' || !spec.topic.trim()) errors.push('topic: required non-empty slug string');
    if (KINDS.indexOf(spec.kind) === -1) errors.push('kind: must be ' + KINDS.join('|'));
    if (!spec.canvas || !isNum(spec.canvas.width) || !isNum(spec.canvas.height)) {
      errors.push('canvas: required {width,height} numbers');
    }
    if (!Array.isArray(spec.scenes) || spec.scenes.length < 2 || spec.scenes.length > 8) {
      errors.push('scenes: required array of 2..8 scenes');
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
            // w/h for rect, r for circle. Polygon `to` carries only
            // `points`, an array of [x,y] pairs matching the shown shape's
            // vertex count, interpolated pointwise.
            var MOVE_FIELDS = {
              text: ['x', 'y'], latex: ['x', 'y'],
              rect: ['x', 'y', 'w', 'h'], circle: ['cx', 'cy', 'r'],
              line: ['x1', 'y1', 'x2', 'y2'], arrow: ['x1', 'y1', 'x2', 'y2'],
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
                : keys.length > 0 && keys.every(function (k) { return isNum(step.to[k]); });
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

  return { validateSpec: validateSpec };
});
