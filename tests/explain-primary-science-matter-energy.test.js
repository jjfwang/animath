/* Issue #570 — explain-me-this tooltips: primary-science batch 5
 * (energy-forms, forces-magnets, photosynthesis-intro, water-cycle).
 * For each sample, at least one explain-carrying shape is asserted:
 * explainText(shape) === shape.explain, and tipPoint() at a point near
 * that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint branch: circle, rect, line, arrow,
 * polygon, and text.
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
  ['primary-science-energy-forms.json', 's1', 'f1'],           // circle
  ['primary-science-energy-forms.json', 's2', 'lampShade'],    // rect
  ['primary-science-energy-forms.json', 's3', 'transArrow'],   // arrow
  ['primary-science-energy-forms.json', 's3', 'batteryLabel'], // text
  ['primary-science-forces-magnets.json', 's2', 'slope'],      // line
  ['primary-science-forces-magnets.json', 's1', 'pushArrow'],  // arrow
  ['primary-science-forces-magnets.json', 's3', 'magA'],       // rect
  ['primary-science-photosynthesis-intro.json', 's1', 'leaf'],// polygon
  ['primary-science-photosynthesis-intro.json', 's2', 'co2'], // text
  ['primary-science-photosynthesis-intro.json', 's3', 'respLeaf'], // circle
  ['primary-science-water-cycle.json', 's4', 'mountain'],     // polygon
  ['primary-science-water-cycle.json', 's1', 'sun'],          // circle
  ['primary-science-water-cycle.json', 's3', 'rain1'],        // arrow
  ['primary-science-water-cycle.json', 's1', 'heat'],         // text
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
