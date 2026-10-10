/* Issue #588 residuals-b (of #588) - explain-me-this tooltips: the 13 batch-residual
 * samples the #559 rollout undercounted - secondary-physics-energy (27),
 * secondary-physics-waves (23), primary-science-photosynthesis-intro (11),
 * secondary-a-trigonometry (11), secondary-physics-forces (10),
 * secondary-a-differentiation (8), primary-science-energy-forms (7),
 * secondary-a-quadratic-functions (7), secondary-physics-kinematics (6),
 * secondary-a-binomial (4), secondary-science-cells (1),
 * primary-science-human-body-systems (1), primary-science-adaptations (1):
 * 117 shape ids, 123 explain slots (five ids are reused across scenes with
 * different content - photosynthesis co2Dot, forces floor/verdict/formula,
 * kinematics work - so they carry per-scene explains, the residuals-a
 * data-graphs precedent). Scene-title ids (title, title1) stay exempt per the
 * batch-6 convention.
 * For each sample, at least one explain-carrying shape per nearPoint kind is
 * asserted: explainText(shape) === shape.explain, and tipPoint() at a point
 * near that shape clamps the tooltip inside the 960x540 stage.
 * The cases cover every nearPoint kind branch present in this batch: text,
 * line, rect, latex, circle, polygon, arrow (no sector in these files).
 * This file also carries the REPO-WIDE zero-missing-explains check across all
 * 69 samples - the check the per-batch ad-hoc reviewer scripts never ran, so
 * this class of residual cannot recur.
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

// Zero-missing-explains collector, keyed by (scene.id, shape.id).
// Shape ids are only unique per scene: a bare-id seen-set masks cross-scene
// reuse (issue #592 -- s1 defines yaxis WITH an explain, s2 defines yaxis
// WITHOUT one, and the bare-id check stays green). Keying by scene keeps
// every (scene, id) pair visible.
function missingExplains(spec, exemptIds) {
  const missing = [];
  const seen = new Set();
  for (const scene of spec.scenes) {
    for (const step of scene.steps) {
      const sh = step.shape;
      if (!sh || !sh.id) continue;
      const key = scene.id + '/' + sh.id;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!sh.explain && !exemptIds.has(sh.id)) missing.push(scene.id + '/' + sh.id);
    }
  }
  return missing;
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
  ['secondary-physics-energy.json', 's2', 'barCapA'],       // text
  ['secondary-physics-energy.json', 's1', 'floor'],         // line
  ['secondary-physics-energy.json', 's1', 'crate'],         // rect
  ['secondary-physics-energy.json', 's3', 'gpeFormula2'],   // latex
  ['secondary-physics-waves.json', 's1', 'p2'],             // circle
  ['secondary-a-trigonometry.json', 's3', 'w4'],             // polygon
  ['primary-science-energy-forms.json', 's2', 'lampR2'],    // arrow
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

test('residuals-b: reused ids carry per-scene explains', () => {
  const floorS1 = findShape(loadSample('secondary-physics-forces.json'), 's1', 'floor');
  const floorS3 = findShape(loadSample('secondary-physics-forces.json'), 's3', 'floor');
  assert.ok(floorS1.explain && floorS3.explain, 'both scenes explain floor');
  assert.notEqual(floorS1.explain, floorS3.explain, 'per-scene explains differ');
  const workS1 = findShape(loadSample('secondary-physics-kinematics.json'), 's1', 'work');
  const workS4 = findShape(loadSample('secondary-physics-kinematics.json'), 's4', 'work');
  assert.notEqual(workS1.explain, workS4.explain, 'work explains differ by scene');
});

test('residuals-b: zero zero-explain shape ids outside the exempt scene titles', () => {
  const exempt = {
    'secondary-physics-energy.json': new Set(['title']),
    'secondary-physics-waves.json': new Set(['title']),
    'primary-science-photosynthesis-intro.json': new Set([]),
    'secondary-a-trigonometry.json': new Set([]),
    'secondary-physics-forces.json': new Set(['title']),
    'secondary-a-differentiation.json': new Set([]),
    'primary-science-energy-forms.json': new Set(['title1']),
    'secondary-a-quadratic-functions.json': new Set([]),
    'secondary-physics-kinematics.json': new Set(['title']),
    'secondary-a-binomial.json': new Set([]),
    'secondary-science-cells.json': new Set([]),
    'primary-science-human-body-systems.json': new Set([]),
    'primary-science-adaptations.json': new Set([]),
  };
  for (const [file, ids] of Object.entries(exempt)) {
    const spec = loadSample(file);
    const missing = missingExplains(spec, ids);
    assert.deepEqual(missing, [], file + ' has no missing explains');
  }
});

test('repo-wide: zero zero-explain shape ids across all samples', () => {
  // The batch-6 scene-title convention, repo-wide: title / title1 / head.
  const exempt = new Set(['title', 'title1', 'head']);
  const files = fs.readdirSync(samplesDir)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .sort();
  assert.equal(files.length, 69, '69 samples on disk');
  const bad = [];
  for (const file of files) {
    const spec = loadSample(file);
    for (const m of missingExplains(spec, exempt)) bad.push(file + ' ' + m);
  }
  assert.deepEqual(bad, [], 'no sample has a missing explain');
});

test('missingExplains keys by (scene, id): cross-scene reuse is not masked', () => {
  // Regression for the #592 root cause: s1 defines yaxis WITH an explain and
  // s2 defines yaxis WITHOUT one. Bare-id keying skips s2 and stays green;
  // (scene, id) keying must report s2/yaxis.
  const spec = {
    scenes: [
      { id: 's1', steps: [{ shape: { id: 'yaxis', kind: 'line', explain: 'explained in s1' } }] },
      { id: 's2', steps: [{ shape: { id: 'yaxis', kind: 'line' } }] },
    ],
  };
  assert.deepEqual(missingExplains(spec, new Set()), ['s2/yaxis']);
});
