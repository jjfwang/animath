/* Issue #572 — explain-me-this tooltips: secondary-science batch 6
 * (chem-acids, chem-atomic, chem-mole, electricity, photosynthesis).
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
  ['secondary-science-chem-acids.json', 's4', 'h'],        // circle
  ['secondary-science-chem-acids.json', 's8', 'tick0'],    // line
  ['secondary-science-chem-acids.json', 's8', 'xaxis'],   // arrow
  ['secondary-science-chem-acids.json', 's2', 'r1'],      // rect
  ['secondary-science-chem-acids.json', 's4', 'eq'],      // latex
  ['secondary-science-chem-acids.json', 's3', 'hp1L'],    // text
  ['secondary-science-chem-atomic.json', 's1', 'nuc'],    // circle
  ['secondary-science-chem-atomic.json', 's4', 'li'],     // rect
  ['secondary-science-chem-atomic.json', 's4', 'a1'],     // arrow
  ['secondary-science-chem-mole.json', 's2', 'pan'],      // rect
  ['secondary-science-chem-mole.json', 's3', 'rxnArrow'], // arrow
  ['secondary-science-chem-mole.json', 's2', 'formula'],  // latex
  ['secondary-science-chem-mole.json', 's1', 'egg1'],     // circle
  ['secondary-science-electricity.json', 's4', 'resZig'], // polygon
  ['secondary-science-electricity.json', 's1', 'bulb'],   // circle
  ['secondary-science-electricity.json', 's1', 'wTop'],   // line
  ['secondary-science-electricity.json', 's4', 'vChipT'], // text
  ['secondary-science-photosynthesis.json', 's3', 'glA'], // polygon
  ['secondary-science-photosynthesis.json', 's1', 'sun'], // circle
  ['secondary-science-photosynthesis.json', 's1', 'beam'], // arrow
  ['secondary-science-photosynthesis.json', 's2', 'co2t'], // text
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
