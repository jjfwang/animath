/* Tests for charts.js adoption on samples/primary-math-data-graphs.json
 * (issue #610): the chart-bearing shapes in the sample must equal the
 * toolkit's outputs for the same literal inputs, so hand-authored sample
 * geometry cannot drift from what generator/charts.js would emit.
 *
 * The literal inputs here are written independently of
 * generator/tooling/build-data-graphs-charts.js (duplication is the
 * point): this test requires generator/charts.js directly.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { pieSectors, barLayout, axisTicks } = require('../generator/charts.js');

const spec = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'samples', 'primary-math-data-graphs.json'),
    'utf8'
  )
);

function scene(id) {
  const sc = spec.scenes.find((s) => s.id === id);
  assert.ok(sc, 'scene ' + id + ' exists');
  return sc;
}

function showShape(sceneId, shapeId) {
  const step = scene(sceneId).steps.find(
    (st) => st.shape && st.shape.id === shapeId
  );
  assert.ok(step, 'show step for ' + shapeId + ' exists');
  return step.shape;
}

function moveTo(sceneId, targetId) {
  const step = scene(sceneId).steps.find(
    (st) => st.do === 'move' && st.target === targetId
  );
  assert.ok(step, 'move step for ' + targetId + ' exists');
  return step.to;
}

function pick(shape, keys) {
  const out = {};
  for (const k of keys) out[k] = shape[k];
  return out;
}

// ---- s1: pie wedges (wApples/wBananas/wGrapes) ----

test('s1 pie wedges equal pieSectors(300,330,150,[6,3,3],...) output', () => {
  const sectors = pieSectors(300, 330, 150, [6, 3, 3], {
    startAngle: 0,
    fills: ['#e8604c', '#8fd694', '#7fb3e8']
  });
  assert.equal(sectors.length, 3);
  const keys = ['cx', 'cy', 'r', 'startAngle', 'endAngle', 'fill'];
  assert.deepEqual(pick(showShape('s1', 'wApples'), keys), pick(sectors[0], keys));
  assert.deepEqual(pick(showShape('s1', 'wBananas'), keys), pick(sectors[1], keys));
  assert.deepEqual(pick(showShape('s1', 'wGrapes'), keys), pick(sectors[2], keys));
});

// ---- s3: bar finals (soccer/minton/swim move `to` targets) ----

test('s3 bar move targets equal barLayout(135,280,360,130,[13,8,3],...) output', () => {
  const bars = barLayout(135, 280, 360, 130, [13, 8, 3], {
    gap: 5 / 12,
    fills: ['#7fb3e8', '#8fd694', '#e8b47f']
  });
  assert.equal(bars.length, 3);
  const keys = ['x', 'y', 'w', 'h'];
  // The static rects are the h=0 initial state; the chart geometry lives
  // in the move `to` targets.
  assert.deepEqual(pick(moveTo('s3', 'soccer'), keys), pick(bars[0], keys));
  assert.deepEqual(pick(moveTo('s3', 'minton'), keys), pick(bars[1], keys));
  assert.deepEqual(pick(moveTo('s3', 'swim'), keys), pick(bars[2], keys));
});

// ---- s4: axis-B tick labels (t0B/t100B/t200B) ----

test('s4 axis-B tick labels equal axisTicks(0,200,3)', () => {
  const ticks = axisTicks(0, 200, 3).map(String);
  assert.deepEqual(ticks, ['0', '100', '200']);
  assert.deepEqual(
    [showShape('s4', 't0B').text, showShape('s4', 't100B').text, showShape('s4', 't200B').text],
    ticks
  );
});
