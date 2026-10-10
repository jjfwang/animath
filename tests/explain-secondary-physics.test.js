/* Issue #562 — explain-me-this tooltips: secondary-physics batch.
 * For each of the four samples, one explain-carrying shape is asserted:
 * explainText(shape) === shape.explain, and tipPoint() at a point near
 * that shape clamps the tooltip inside the 960x540 stage.
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
  switch (shape.kind) {
    case 'circle': return [shape.cx, shape.cy];
    case 'rect': return [shape.x + shape.w / 2, shape.y + shape.h / 2];
    case 'arrow':
    case 'line': return [(shape.x1 + shape.x2) / 2, (shape.y1 + shape.y2) / 2];
    default: return [shape.x, shape.y];
  }
}

const cases = [
  ['secondary-physics-energy.json', 's1', 'farrow'],
  ['secondary-physics-forces.json', 's1', 'block'],
  ['secondary-physics-forces.json', 's3', 'pa1'], // reviewer fix-round regression: s3 pressure arrows carry explain
  ['secondary-physics-kinematics.json', 's1', 'athlete'],
  ['secondary-physics-waves.json', 's1', 'pdot'],
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
