/* animath tooling — measure-rubric-bands.js (issue #663)
 *
 * Re-derives the "MEASURED BANDS" numbers documented in generator/rubric.js
 * live from samples/*.json (except index.json). Run from the repo root:
 *
 *   node generator/tooling/measure-rubric-bands.js
 *
 * Prints the derivation as JSON. The logic is also requireable — measure()
 * below — so tests/tooling-bands.test.js can lock the rubric constants
 * against the live corpus without spawning a subprocess.
 *
 * Method (mirrors the rubric's own constructions, not invented):
 * - Scene durations: every scene's duration_ms. The validator requires a
 *   number in 4000..12000, so a validator-clean corpus never skips one.
 * - Step gaps: per scene, the at_ms values sorted ascending, then the
 *   consecutive differences — the same construction scorePacing() uses.
 *   The validator requires numeric at_ms on every step.
 * - p5/p95 are nearest-rank percentiles: sorted[ceil(p*n)-1].
 * - Text tiers mirror textBudget() in generator/rubric.js: a missing or
 *   non-numeric size is scored as size 24 (the validator allows size to be
 *   absent). Only 'show' steps are scanned, like the canvas-bounds
 *   dimension; hide/move steps carry no shapes.
 * - The wrong-turn marker regex must stay byte-identical to WRONG_TURN_RE
 *   in generator/rubric.js, and the misconception lookup is the shared
 *   generator/build_prompt.js misconceptionFor — never a copy of the data.
 *
 * Zero dependencies. Node only.
 */
'use strict';

var fs = require('fs');
var path = require('path');

// Must stay byte-identical to WRONG_TURN_RE in generator/rubric.js.
var WRONG_TURN_RE = /watch out|common mistake|many students|easy to think|\btrap\b|a mistake|wrong answer|tempting to/i;

function defaultRoot() {
  return path.join(__dirname, '..', '..');
}

function listSampleFiles(samplesDir) {
  return fs.readdirSync(samplesDir)
    .filter(function (f) { return f.slice(-5) === '.json' && f !== 'index.json'; })
    .sort();
}

function isNum(x) {
  return typeof x === 'number' && isFinite(x);
}

// Nearest-rank percentile over an ascending-sorted array. Only called with
// non-empty arrays (see band()).
function percentile(sortedAsc, p) {
  return sortedAsc[Math.ceil(p * sortedAsc.length) - 1];
}

function band(values) {
  var s = values.slice().sort(function (a, b) { return a - b; });
  // Null bands on empty input — a fresh samples/ dir holding only index.json
  // is a real state worth handling instead of throwing on.
  if (s.length === 0) return { min: null, max: null, p5: null, p95: null };
  return {
    min: s[0],
    max: s[s.length - 1],
    p5: percentile(s, 0.05),
    p95: percentile(s, 0.95)
  };
}

// Text-budget tier, mirroring textBudget() in generator/rubric.js.
function tierOf(size) {
  var s = isNum(size) ? size : 24;
  if (s >= 48) return 'size>=48';
  if (s >= 32) return 'size32-44';
  if (s >= 24) return 'size24-30';
  return 'size<=22';
}

// root: repo root holding samples/. Defaults to this script's repo root,
// so the CLI works from anywhere and tests can point at fixture dirs.
function measure(root) {
  var samplesDir = path.join(root || defaultRoot(), 'samples');
  var files = listSampleFiles(samplesDir);
  var misconceptionFor = require('../build_prompt.js').misconceptionFor;

  var durations = [];
  var gaps = [];
  var captionLens = [];
  var sceneCounts = [];
  var tierMax = { 'size>=48': 0, 'size32-44': 0, 'size24-30': 0, 'size<=22': 0 };
  var shapesWithoutNumericSize = 0;
  var latexShapes = 0;
  var latexMax = 0;
  var kindProblem = 0;
  var topicsResolving = 0;
  var wrongTurnMatches = 0;

  files.forEach(function (file) {
    var spec = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
    if (spec.kind === 'problem') kindProblem++;
    var scenes = spec.scenes;
    sceneCounts.push(scenes.length);
    scenes.forEach(function (scene) {
      durations.push(scene.duration_ms);
      captionLens.push(scene.caption.length);
      var ats = scene.steps.map(function (step) { return step.at_ms; })
        .filter(isNum)
        .sort(function (a, b) { return a - b; });
      for (var k = 1; k < ats.length; k++) gaps.push(ats[k] - ats[k - 1]);
      scene.steps.forEach(function (step) {
        if (step.do !== 'show') return;
        var shape = step.shape;
        if (shape.kind === 'text') {
          if (!isNum(shape.size)) shapesWithoutNumericSize++;
          var tier = tierOf(shape.size);
          if (shape.text.length > tierMax[tier]) tierMax[tier] = shape.text.length;
        } else if (shape.kind === 'latex') {
          latexShapes++;
          if (shape.tex.length > latexMax) latexMax = shape.tex.length;
        }
      });
    });
    // The validator requires topic and narration to be non-empty strings.
    if (misconceptionFor(spec.topic)) {
      topicsResolving++;
      var text = scenes.map(function (sc) {
        return sc.caption + ' ' + sc.narration;
      }).join(' ');
      if (WRONG_TURN_RE.test(text)) wrongTurnMatches++;
    }
  });

  var captions = band(captionLens);
  return {
    samples: files.length,
    scenes: durations.length,
    consecutiveGaps: gaps.length,
    durationMs: band(durations),
    stepGapMs: band(gaps),
    sceneCount: band(sceneCounts),
    captions: {
      nonEmpty: captionLens.length,
      min: captions.min,
      max: captions.max,
      p95: captions.p95
    },
    textTierMaxChars: tierMax,
    shapesWithoutNumericSize: shapesWithoutNumericSize,
    latexShapes: latexShapes,
    latexTexMaxChars: latexMax,
    kindProblem: kindProblem,
    topicsResolving: topicsResolving,
    wrongTurnMatches: wrongTurnMatches
  };
}

function main() {
  process.stdout.write(JSON.stringify(measure(), null, 2) + '\n');
}

if (require.main === module) main();

module.exports = { measure: measure };
