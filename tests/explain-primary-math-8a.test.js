/* Issue #578 batch 8a — explain-me-this tooltips: primary-math
 * (whole-numbers, decimals-place-value, area-perimeter, fractions-addition,
 * percentage-of-quantity).
 * For each sample, at least one explain-carrying shape per nearPoint kind is
 * asserted: explainText(shape) === shape.explain, and tipPoint() at a point
 * near that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint kind branch present in this batch: circle,
 * rect, line, arrow, and text. (No polygon or latex shapes exist in these
 * five files; those branches are covered by earlier batches' tests.)
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const player = require('../player/player.js');

const samplesDir = path.join(__dirname, '..', 'samples');

function loadSample(name) {
  return JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
}

function findShape(spec, sceneId, shapeId) {
  const scene = spec.scenes.find((s) => s.id === sceneId);
  assert.ok(scene, 'scene ' + sceneId + ' exists');
  const step = scene.steps.find((st) => st.shape && st.shape.id === shapeId);
  assert.ok(step, 'shape ' + shapeId + ' exists in ' + sceneId);
  return step.shape;
}

// A point on/near the shape, per kind, for the tooltip anchor.
function nearPoint(shape) {
  if (shape.kind === 'circle') return [shape.cx, shape.cy];
  if (shape.kind === 'rect') return [shape.x + shape.w / 2, shape.y + shape.h / 2];
  if (shape.kind === 'arrow' || shape.kind === 'line') {
    return [(shape.x1 + shape.x2) / 2, (shape.y1 + shape.y2) / 2];
  }
  if (shape.kind === 'polygon') {
    const n = shape.points.length;
    const sx = shape.points.reduce((a, p) => a + p[0], 0);
    const sy = shape.points.reduce((a, p) => a + p[1], 0);
    return [sx / n, sy / n];
  }
  return [shape.x, shape.y]; // text (and latex) shapes anchor at their point
}

const cases = [
  ['primary-math-whole-numbers.json', 's1', 'col0'],  // rect
  ['primary-math-whole-numbers.json', 's1', 'c0'],     // circle
  ['primary-math-whole-numbers.json', 's6', 'z0'],     // text
  ['primary-math-whole-numbers.json', 's2', 'ans6'],   // text
  ['primary-math-decimals-place-value.json', 's1', 'bar'], // rect
  ['primary-math-decimals-place-value.json', 's1', 'd1'],  // line
  ['primary-math-decimals-place-value.json', 's1', 'mk'],  // circle
  ['primary-math-decimals-place-value.json', 's1', 'pv'],  // text
  ['primary-math-area-perimeter.json', 's1', 'partA'], // rect
  ['primary-math-area-perimeter.json', 's2', 'trav'],  // arrow
  ['primary-math-area-perimeter.json', 's2', 'd1'],    // text
  ['primary-math-fractions-addition.json', 's2', 'qa'], // rect
  ['primary-math-fractions-addition.json', 's2', 'cut'],// line
  ['primary-math-fractions-addition.json', 's3', 'eq'],// text
  ['primary-math-percentage-of-quantity.json', 's1', 'grid'], // rect
  ['primary-math-percentage-of-quantity.json', 's1', 'v1'],   // line
  ['primary-math-percentage-of-quantity.json', 's1', 'dot'],  // circle
  ['primary-math-percentage-of-quantity.json', 's1', 'eq'],   // text
];

cases.forEach(([file, sceneId, shapeId]) => {
  test(file + ' ' + shapeId + ': explainText returns the authored text', () => {
    const shape = findShape(loadSample(file), sceneId, shapeId);
    assert.ok(typeof shape.explain === 'string' && shape.explain.length > 0,
      shapeId + ' carries an explain string');
    assert.equal(player.explainText(shape), shape.explain);
  });

  test(file + ' ' + shapeId + ': tipPoint clamps inside the 960x540 stage', () => {
    const shape = findShape(loadSample(file), sceneId, shapeId);
    const [px, py] = nearPoint(shape);
    const tip = player.tipPoint(px, py, 960, 540);
    assert.ok(tip.x >= 0 && tip.x <= 960, 'tip x inside stage: ' + tip.x);
    assert.ok(tip.y >= 0 && tip.y <= 540, 'tip y inside stage: ' + tip.y);
  });
});
