#!/usr/bin/env node
/* gen-render-snapshots.js (issue #519) — bakes the per-frame SVG render-snapshot
 * manifest into tests/fixtures/render-snapshots.json.
 *
 * What it does (run from the repo root):
 *
 *     node generator/tooling/gen-render-snapshots.js
 *
 * Iterates samples/*.json except index.json; for each scene renders every
 * frame at a 1fps stride via player/export-frames.js
 * renderFrame(spec, sceneIdx, frameMs(i, 1)) and sha256-hashes each frame's
 * SVG. Writes tests/fixtures/render-snapshots.json shaped
 * { sampleBasename: { sceneId: [hashes...] } } and prints a summary line.
 *
 * The manifest is consumed by tests/render-snapshot.test.js, which renders
 * every frame twice (determinism guard) and asserts the hashes equal the
 * manifest entries. The manifest is never regenerated implicitly — a missing
 * or mismatched fixture fails the suite, so renderer or sample changes must
 * be adopted by a deliberate re-run of this script.
 *
 * Requirements: Node, zero dependencies.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const xf = require('../../player/export-frames.js');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'samples');
const OUT_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'render-snapshots.json');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function sampleBasenames() {
  return fs.readdirSync(SAMPLES_DIR)
    .filter(function (f) { return f.slice(-5) === '.json' && f !== 'index.json'; })
    .map(function (f) { return f.slice(0, -5); })
    .sort();
}

var manifest = {};
var sceneTotal = 0;
var frameTotal = 0;
sampleBasenames().forEach(function (name) {
  var spec = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, name + '.json'), 'utf8'));
  var perScene = {};
  (spec.scenes || []).forEach(function (scene, sceneIdx) {
    var n = xf.sceneFrameCount(spec, sceneIdx, 1);
    var hashes = [];
    for (var i = 0; i < n; i++) {
      hashes.push(sha256(xf.renderFrame(spec, sceneIdx, xf.frameMs(i, 1))));
    }
    perScene[scene.id] = hashes;
    sceneTotal += 1;
    frameTotal += n;
  });
  manifest[name] = perScene;
});

fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote tests/fixtures/render-snapshots.json: ' +
  Object.keys(manifest).length + ' samples, ' + sceneTotal + ' scenes, ' +
  frameTotal + ' frames');
