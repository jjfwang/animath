/* Issue #589 residuals-a (of #588) - explain-me-this tooltips: the 4 samples no
 * #559 batch ever covered - secondary-e-statistics, secondary-science-chem-bonding,
 * primary-math-data-graphs, secondary-a-integration (264 shape ids, 268 explain
 * slots: data-graphs reuses the 'q' question slot and the 'base' line in several
 * scenes with different content, so those two carry per-scene explains).
 * For each sample, at least one explain-carrying shape per nearPoint kind is
 * asserted: explainText(shape) === shape.explain, and tipPoint() at a point
 * near that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint kind branch present in this batch: text,
 * latex, circle, line, polygon, rect, arrow, sector (anchored at (cx,cy)).
 * The s1 scene-title 'title' in secondary-science-chem-bonding is exempt per
 * the batch-6 convention; no other file in this batch has scene-title shapes.
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
  if (shape.kind === 'sector') return [shape.cx, shape.cy];
  return [shape.x, shape.y]; // text (and latex) shapes anchor at their point
}

const cases = [
  ['secondary-e-statistics.json', 's1', 't1'],          // text
  ['secondary-e-statistics.json', 's6', 'medl'],       // latex
  ['secondary-science-chem-bonding.json', 's1', 'naShell'], // circle
  ['secondary-a-integration.json', 's1', 'xax'],       // line
  ['secondary-a-integration.json', 's2', 'trueArea'],  // polygon
  ['secondary-a-integration.json', 's1', 'strip1'],    // rect
  ['secondary-e-statistics.json', 's2', 'ax2'],        // arrow
  ['primary-math-data-graphs.json', 's1', 'wApples'],  // sector (pre-existing explain)
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

test('residuals-a: zero zero-explain shape ids outside the exempt scene title', () => {
  const exempt = {
    'secondary-e-statistics.json': new Set([]),
    'secondary-science-chem-bonding.json': new Set(['title']),
    'primary-math-data-graphs.json': new Set([]),
    'secondary-a-integration.json': new Set([]),
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
