/* Issue #576 batch 7b — explain-me-this tooltips: secondary-e
 * (numbers, probability, trigonometry) + secondary-math-pythagoras.
 * For each sample, at least one explain-carrying shape is asserted:
 * explainText(shape) === shape.explain, and tipPoint() at a point near
 * that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint branch present in this batch: circle,
 * rect, line, polygon, text, and latex. (No arrow shapes exist in these
 * four files; the arrow branch is covered by earlier batches' tests.)
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
  ['secondary-e-numbers.json', 's1', 't2'],        // text
  ['secondary-e-numbers.json', 's2', 'a0'],        // rect
  ['secondary-e-numbers.json', 's3', 'dot'],       // circle
  ['secondary-e-numbers.json', 's4', 'ghost'],     // text
  ['secondary-e-probability.json', 's1', 'scale'], // line
  ['secondary-e-probability.json', 's2', 'slotF'], // rect
  ['secondary-e-probability.json', 's3', 'frac3'], // text
  ['secondary-e-probability.json', 's5', 'nodeH'], // circle
  ['secondary-e-probability.json', 's6', 'coin1'], // circle
  ['secondary-e-trigonometry.json', 's1', 'sinEq'],  // latex
  ['secondary-e-trigonometry.json', 's1', 'probe'],  // circle
  ['secondary-e-trigonometry.json', 's2', 'legOpp'], // line
  ['secondary-e-trigonometry.json', 's3', 'tri'],    // polygon
  ['secondary-e-trigonometry.json', 's4', 'ghostBar'],// rect
  ['secondary-e-trigonometry.json', 's4', 'ghostLab'],// text
  ['secondary-math-pythagoras.json', 's1', 'legA'],  // line
  ['secondary-math-pythagoras.json', 's1', 'la'],    // text
  ['secondary-math-pythagoras.json', 's2', 'sqA'],   // rect
  ['secondary-math-pythagoras.json', 's2', 'gdA0'],  // circle
  ['secondary-math-pythagoras.json', 's3', 'sqC'],   // polygon
  ['secondary-math-pythagoras.json', 's4', 'rule'],  // latex
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
