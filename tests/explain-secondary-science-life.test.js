/* Issue #568 — explain-me-this tooltips: secondary-science batch 4
 * (cells, bio-ecology, bio-nutrition, bio-reproduction, bio-transport).
 * For each sample, at least one explain-carrying shape is asserted:
 * explainText(shape) === shape.explain, and tipPoint() at a point near
 * that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint branch: circle, rect, line, arrow,
 * text — plus a synthetic polygon, since none of the five samples in this
 * batch contains a polygon shape (the polygon branch is also covered by
 * the #566 suite via primary-science-life-cycles).
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
  ['secondary-science-cells.json', 's1', 'nucleus'],      // circle
  ['secondary-science-cells.json', 's1', 'lWall'],        // text
  ['secondary-science-bio-ecology.json', 's2', 'L1'],     // rect
  ['secondary-science-bio-ecology.json', 's1', 'arrow1'], // arrow
  ['secondary-science-bio-nutrition.json', 's2', 'axis'], // line
  ['secondary-science-bio-nutrition.json', 's2', 'b0'],   // rect
  ['secondary-science-bio-nutrition.json', 's5', 'abs'],  // arrow
  ['secondary-science-bio-reproduction.json', 's2', 'stigma'],  // circle
  ['secondary-science-bio-reproduction.json', 's2', 'style'],   // rect
  ['secondary-science-bio-reproduction.json', 's2', 'tube'],     // arrow
  ['secondary-science-bio-reproduction.json', 's3', 'windL'],    // text
  ['secondary-science-bio-transport.json', 's1', 'leftPump'],    // circle
  ['secondary-science-bio-transport.json', 's3', 'xylem'],       // rect
  ['secondary-science-bio-transport.json', 's2', 'pa'],          // arrow
  ['secondary-science-bio-transport.json', 's2', 'lungsL'],      // text
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

test('synthetic polygon: explainText and tipPoint cover the polygon branch', () => {
  const shape = {
    kind: 'polygon',
    points: [[100, 100], [220, 100], [160, 220]],
    explain: 'A synthetic triangle: covers the polygon tooltip-anchor branch.',
  };
  assert.equal(player.explainText(shape), shape.explain);
  const [px, py] = nearPoint(shape);
  const tip = player.tipPoint(px, py, 960, 540);
  assert.ok(tip.x >= 0 && tip.x <= 960, 'tip x inside stage: ' + tip.x);
  assert.ok(tip.y >= 0 && tip.y <= 540, 'tip y inside stage: ' + tip.y);
});
