/* Issue #585 batch 9b2 — explain-me-this tooltips: jc-h2 science rest
 * (ecology, em, energetics, mechanics, physical, quantum) + the integration
 * and thermal remainder files. The last slice of the #559 rollout.
 * For each sample, at least one explain-carrying shape per nearPoint kind is
 * asserted: explainText(shape) === shape.explain, and tipPoint() at a point
 * near that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint kind branch present in this batch: text,
 * latex, circle, line, polygon, rect, arrow.
 * The scene-title 'title' in jc-h2-energetics s2 is exempt per the batch-6
 * convention; every other file has no scene-title shapes.
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
  ['jc-h2-ecology.json', 's1', 'grass'],      // text
  ['jc-h2-ecology.json', 's1', 'a1'],         // arrow
  ['jc-h2-ecology.json', 's2', 'dot1'],       // circle
  ['jc-h2-ecology.json', 's3', 'lv1'],        // rect
  ['jc-h2-ecology.json', 's3', 'ten'],        // latex
  ['jc-h2-em.json', 's1', 'posPlate'],        // rect
  ['jc-h2-em.json', 's3', 'needle'],          // line
  ['jc-h2-em.json', 's3', 'emfEq'],           // latex
  ['jc-h2-em.json', 's4', 'iR1'],             // arrow
  ['jc-h2-energetics.json', 's1', 'outerMem'],// rect
  ['jc-h2-energetics.json', 's4', 'yBranch'], // line
  ['jc-h2-energetics.json', 's5', 'photEq'],  // latex
  ['jc-h2-mechanics.json', 's1', 'sat'],      // circle
  ['jc-h2-mechanics.json', 's4', 'tEq'],       // latex
  ['jc-h2-mechanics.json', 's5', 'tangent'],  // line
  ['jc-h2-mechanics.json', 's5', 'inward'],   // arrow
  ['jc-h2-physical.json', 's1', 'profile'],   // polygon
  ['jc-h2-physical.json', 's1', 'dhLabel'],   // latex
  ['jc-h2-physical.json', 's5', 'n2Bar'],     // rect
  ['jc-h2-physical.json', 's6', 'fwdArrow'],  // arrow
  ['jc-h2-physical.json', 's3', 'c1'],        // line
  ['jc-h2-quantum.json', 's1', 'metal'],      // rect
  ['jc-h2-quantum.json', 's2', 'noEject'],    // text
  ['jc-h2-quantum.json', 's3', 'peEq'],       // latex
  ['jc-h2-quantum.json', 's4', 'dimE'],       // arrow
  ['jc-h2-integration.json', 's2', 'triPos'], // polygon
  ['jc-h2-integration.json', 's3', 'mapArrow'],// arrow
  ['jc-h2-integration.json', 's3', 'orig'],   // latex
  ['jc-h2-integration.json', 's4', 'disc1'],  // circle
  ['jc-h2-thermal.json', 's1', 't300'],       // text
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

test('batch 9b2: zero zero-explain shape ids outside the exempt scene title', () => {
  const exempt = {
    'jc-h2-ecology.json': new Set([]),
    'jc-h2-em.json': new Set([]),
    'jc-h2-energetics.json': new Set(['title']),
    'jc-h2-mechanics.json': new Set([]),
    'jc-h2-physical.json': new Set([]),
    'jc-h2-quantum.json': new Set([]),
    'jc-h2-integration.json': new Set([]),
    'jc-h2-thermal.json': new Set([]),
  };
  for (const [file, ids] of Object.entries(exempt)) {
    const spec = loadSample(file);
    const missing = [];
    const seen = new Set();
    for (const scene of spec.scenes) {
      for (const step of scene.steps) {
        const sh = step.shape;
        if (!sh || !sh.id || seen.has(sh.id)) continue;
        seen.add(sh.id);
        if (!sh.explain && !ids.has(sh.id)) missing.push(scene.id + '/' + sh.id);
      }
    }
    assert.deepEqual(missing, [], file + ' has no missing explains');
  }
});
