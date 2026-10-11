/* Tests for issue #596 — no text-only scenes. Mechanism-first (owner direction
 * 2026-10-04): every scene must carry at least one non-text/latex shape so the
 * mechanism is shape-carried, never text-told alone. A scene whose shapes are
 * all text/latex kind fails. Node-only, zero dependencies.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const samplesDir = path.join(__dirname, '..', 'samples');
const sampleFiles = fs.readdirSync(samplesDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();

function sceneKinds(scene) {
  const kinds = new Set();
  for (const st of scene.steps || []) {
    const shapes = st.shape ? [st.shape] : (st.shapes || []);
    for (const sh of shapes) kinds.add(sh.kind);
  }
  return kinds;
}

function hasNonTextShape(scene) {
  return [...sceneKinds(scene)].some((k) => k !== 'text' && k !== 'latex');
}

test('no text-only scenes across all samples', () => {
  const offenders = [];
  for (const f of sampleFiles) {
    const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
    for (const sc of spec.scenes || []) {
      if (!hasNonTextShape(sc)) offenders.push(f + ' ' + sc.id);
    }
  }
  assert.deepEqual(offenders, [], 'text-only scenes (every shape text/latex kind)');
});

test('the seven issue-596 residual scenes each show a non-text shape', () => {
  const targets = {
    'jc-h2-genetics.json': ['s4'],
    'jc-h2-organic.json': ['s1'],
    'secondary-a-binomial.json': ['s3', 's4'],
    'secondary-a-trigonometry.json': ['s2'],
    'secondary-e-algebra.json': ['s2', 's4'],
  };
  for (const f of Object.keys(targets)) {
    const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
    for (const id of targets[f]) {
      const sc = spec.scenes.find((s) => s.id === id);
      assert.ok(sc, f + ' ' + id + ' exists');
      assert.ok(hasNonTextShape(sc), f + ' ' + id + ' carries a non-text/latex shape');
    }
  }
});
