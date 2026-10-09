/* Tests for the committed render-snapshot manifest (issue #519) —
 * per-frame SVG determinism locked across all samples. Node-only, zero
 * dependencies.
 *
 * The manifest (tests/fixtures/render-snapshots.json, baked by
 * generator/tooling/gen-render-snapshots.js) is never regenerated
 * implicitly: a missing sample/scene, a missing frame, a non-deterministic
 * double render, or any render-output change fails the suite. Adopting a
 * change means re-running the regen script and committing the new manifest.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const xf = require('../player/export-frames.js');

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
const MANIFEST_PATH = path.join(__dirname, 'fixtures', 'render-snapshots.json');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function sampleBasenames() {
  return fs.readdirSync(SAMPLES_DIR)
    .filter(function (f) { return f.slice(-5) === '.json' && f !== 'index.json'; })
    .map(function (f) { return f.slice(0, -5); })
    .sort();
}

function loadSpec(name) {
  return JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, name + '.json'), 'utf8'));
}

function manifestFrameTotal(manifest) {
  return Object.keys(manifest).reduce(function (sum, name) {
    return sum + Object.keys(manifest[name]).reduce(function (s2, sceneId) {
      return s2 + manifest[name][sceneId].length;
    }, 0);
  }, 0);
}

test('manifest exists and covers every on-disk sample/scene, with no extras', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), 'tests/fixtures/render-snapshots.json committed');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const names = sampleBasenames();
  assert.deepEqual(Object.keys(manifest).sort(), names,
    'manifest sample keys match the samples/ listing exactly');
  names.forEach((name) => {
    const sceneIds = (loadSpec(name).scenes || []).map((s) => s.id).sort();
    assert.deepEqual(Object.keys(manifest[name]).sort(), sceneIds,
      'manifest scenes match ' + name);
  });
});

test('per-frame SVG is deterministic (double render) and matches the manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  let checked = 0;
  sampleBasenames().forEach((name) => {
    const spec = loadSpec(name);
    const perScene = manifest[name];
    (spec.scenes || []).forEach((scene, sceneIdx) => {
      const n = xf.sceneFrameCount(spec, sceneIdx, 1);
      const expected = perScene[scene.id];
      assert.equal(expected.length, n,
        'manifest frame count matches for ' + name + '/' + scene.id);
      for (let i = 0; i < n; i++) {
        const ms = xf.frameMs(i, 1);
        const h1 = sha256(xf.renderFrame(spec, sceneIdx, ms));
        const h2 = sha256(xf.renderFrame(spec, sceneIdx, ms));
        const where = name + '/' + scene.id + '#' + i;
        assert.equal(h1, h2, 'double render identical: ' + where);
        assert.equal(h1, expected[i], 'hash matches manifest: ' + where);
        checked += 1;
      }
    });
  });
  assert.equal(checked, manifestFrameTotal(manifest),
    'every manifest frame was rendered and checked');
});
