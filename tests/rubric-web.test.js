/* animath rubric web-wiring tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the drift filed as #598: generator/rubric.js (issue #111) documents
 * itself as UMD — pure, no DOM, no dependencies, browser-loadable — but the
 * generator web app (web/index.html, the only place a teacher generates specs)
 * never loaded it: generations were validated and played with no quality score
 * shown anywhere. The rubric now renders a score panel next to the player.
 *
 * web/index.html is not node-coverable; its HTML glue is verified by reading
 * plus these fs assertions (the tests/gallery.test.js precedent). The inline
 * script's render logic is exercised through the same static contract the
 * page itself reads: scoreSpec(spec) -> { score, maxScore, dimensions[] }.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

const html = readFile('web/index.html');
const rubricSrc = readFile('generator/rubric.js');

const TAG = '<script src="../generator/rubric.js"></script>';

test('web/index.html loads generator/rubric.js alongside the other scripts', () => {
  assert.ok(html.includes(TAG),
    'web/index.html must contain the rubric script tag: ' + TAG);
});

test('rubric script tag appears before the app inline script', () => {
  const tagPos = html.indexOf(TAG);
  // the app inline block starts with a bare <script> tag (no src), after the
  // pinned/generator/player tags
  const inlinePos = html.indexOf('<script>\n(function () {', tagPos);
  assert.ok(tagPos >= 0 && inlinePos > tagPos,
    'the rubric tag must load before the inline app script that calls it');
});

test('web/index.html renders a keyboard-reachable score-panel container', () => {
  const m = html.match(/<div class="rubric" id="rubricscore"[^>]*>/);
  assert.ok(m, 'web/index.html must contain the #rubricscore container');
  assert.ok(m[0].includes('role="region"'),
    '#rubricscore must be a labelled region for assistive tech');
  assert.ok(m[0].includes('aria-label="Teacher rubric score"'),
    '#rubricscore must label itself as the teacher rubric score');
  assert.ok(m[0].includes('tabindex="0"'),
    '#rubricscore must be keyboard-focusable (UI/UX bar: keyboard-reachable)');
  assert.ok(m[0].includes('display:none'),
    '#rubricscore must start hidden until a spec is generated');
});

test('score panel sits next to the player area', () => {
  const panelPos = html.indexOf('id="rubricscore"');
  const stagePos = html.indexOf('id="stage"');
  assert.ok(panelPos >= 0 && stagePos > panelPos,
    '#rubricscore must appear before #stage so it shows next to the player');
});

test('app calls scoreSpec only when the rubric global is present', () => {
  assert.ok(html.includes('window.AnimathRubric && window.AnimathRubric.scoreSpec'),
    'the app must guard on the rubric global so a failed script load cannot break the page');
  assert.ok(html.includes('window.AnimathRubric.scoreSpec(spec)'),
    'the app must score the validated spec with the rubric global');
});

test('app renders total plus every dimension with one short note each', () => {
  assert.ok(html.includes('result.dimensions.map'),
    'renderRubric must iterate every returned dimension');
  assert.ok(html.includes('result.score + \'/\' + result.maxScore'),
    'the panel must show the total score out of the max');
  assert.ok(html.includes('d.score + \'/\' + d.max'),
    'the panel must show each dimension score out of its max');
  assert.ok(html.includes('d.notes[0]'),
    'each dimension row must carry one short note');
});

test('score panel resets when a new generation starts', () => {
  const genStart = html.indexOf('genBtn.addEventListener(\'click\'');
  const reset = html.indexOf('scoreEl.style.display = \'none\'', genStart);
  assert.ok(genStart >= 0 && reset > genStart,
    'starting a new generation must hide the previous score panel');
});

test('rubric.js exposes scoreSpec as a UMD browser global', () => {
  assert.ok(rubricSrc.includes('global.AnimathRubric = api'),
    'rubric.js must assign the browser global (UMD fallback path)');
  assert.ok(rubricSrc.includes('scoreSpec: scoreSpec'),
    'the rubric API object must expose scoreSpec');
});

test('scoreSpec result shape matches what the page renders', () => {
  const rubric = require('../generator/rubric.js');
  const r = rubric.scoreSpec({ title: 't', scenes: [] });
  assert.ok(typeof r.score === 'number' && typeof r.maxScore === 'number',
    'scoreSpec must return numeric score/maxScore');
  assert.ok(Array.isArray(r.dimensions),
    'scoreSpec must return a dimensions array');
  for (const d of r.dimensions) {
    assert.ok(typeof d.name === 'string' && typeof d.score === 'number' &&
      typeof d.max === 'number' && Array.isArray(d.notes),
      'every dimension must carry { name, score, max, notes[] }');
  }
});
