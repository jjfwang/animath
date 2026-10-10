/* Issue #574 batch 7a — explain-me-this tooltips: secondary-e
 * (algebra, functions-graphs, geometry, mensuration).
 * For each sample, at least one explain-carrying shape is asserted:
 * explainText(shape) === shape.explain, and tipPoint() at a point near
 * that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint branch present: circle, rect, line,
 * arrow, polygon, text, and latex.
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
  ['secondary-e-algebra.json', 's1', 'rx1'],        // text
  ['secondary-e-algebra.json', 's1', 'expr'],       // latex
  ['secondary-e-algebra.json', 's1', 'tile_x2'],    // rect
  ['secondary-e-algebra.json', 's3', 'bar'],        // line
  ['secondary-e-functions-graphs.json', 's1', 'pen'],   // circle
  ['secondary-e-functions-graphs.json', 's1', 'line'],  // arrow
  ['secondary-e-functions-graphs.json', 's4', 'seg1'],  // polygon
  ['secondary-e-functions-graphs.json', 's2', 'grad'],  // latex
  ['secondary-e-geometry.json', 's1', 'sss'],       // text
  ['secondary-e-geometry.json', 's1', 'tri1'],      // polygon
  ['secondary-e-geometry.json', 's1', 's1a'],       // latex
  ['secondary-e-geometry.json', 's3', 'rect1'],     // rect
  ['secondary-e-geometry.json', 's4', 'circ'],      // circle
  ['secondary-e-geometry.json', 's4', 'diam'],      // line
  ['secondary-e-mensuration.json', 's1', 'th1'],    // text
  ['secondary-e-mensuration.json', 's1', 'w1'],     // polygon
  ['secondary-e-mensuration.json', 's1', 'areaF'],  // latex
  ['secondary-e-mensuration.json', 's1', 'rad1'],   // line
  ['secondary-e-mensuration.json', 's1', 'circ'],   // circle
  ['secondary-e-mensuration.json', 's2', 'base'],   // rect
  ['secondary-e-mensuration.json', 's3', 'rarr'],   // arrow
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
