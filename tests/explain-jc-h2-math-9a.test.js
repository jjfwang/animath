/* Issue #582 batch 9a — explain-me-this tooltips: jc-h2 math
 * (differentiation, statistics, probability, sequences, functions-graphs,
 * complex, vectors).
 * For each sample, at least one explain-carrying shape per nearPoint kind is
 * asserted: explainText(shape) === shape.explain, and tipPoint() at a point
 * near that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint kind branch present in this batch: circle,
 * rect, line, arrow, text, polygon, latex, and sector (the sector kind is new
 * in this batch; like circle it anchors at its centre).
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
  if (shape.kind === 'circle' || shape.kind === 'sector') return [shape.cx, shape.cy];
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
  ['jc-h2-differentiation.json', 's1', 'sectorFill'], // sector
  ['jc-h2-differentiation.json', 's2', 'dEq'],         // latex
  ['jc-h2-differentiation.json', 's3', 'wall'],        // line
  ['jc-h2-differentiation.json', 's4', 'wrongChip'],   // rect
  ['jc-h2-statistics.json', 's1', 'bell2'],            // polygon
  ['jc-h2-statistics.json', 's1', 'd1'],               // circle
  ['jc-h2-statistics.json', 's2', 'h0'],               // latex
  ['jc-h2-probability.json', 's1', 'chip0'],           // circle
  ['jc-h2-probability.json', 's3', 'pickLab'],         // text
  ['jc-h2-sequences.json', 's1', 'marker'],            // circle
  ['jc-h2-functions-graphs.json', 's1', 'curveF'],     // polygon
  ['jc-h2-functions-graphs.json', 's3', 'branchPos'],  // polygon
  ['jc-h2-complex.json', 's3', 'zc'],                  // arrow
  ['jc-h2-vectors.json', 's1', 'vec'],                 // arrow
  ['jc-h2-vectors.json', 's4', 'lineEq'],              // latex
  ['jc-h2-vectors.json', 's2', 'sumEq'],               // latex
];

cases.forEach(([file, sceneId, shapeId]) => {
  test(file + ' ' + shapeId + ': explainText returns the authored text', () => {
    const shape = findShape(loadSample(file), sceneId, shapeId);
    assert.ok(typeof shape.explain === 'string' && shape.explain.length > 0,
      shapeId + ' carries an explain string');
    assert.ok(shape.explain === shape.explain.trim(), 'no leading/trailing whitespace');
    for (const ch of shape.explain) {
      assert.ok(ch.codePointAt(0) < 128, 'ASCII only: ' + shapeId);
    }
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
