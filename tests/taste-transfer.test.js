/* animath taste-transfer tests (issue #691) — slice 4 of the engine work:
 * buildPrompts output must carry the trimmed water-cycle exemplar (the
 * loop's learned taste) and the distilled quality gates as explicit
 * instructions. Zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Prompt = require('../generator/build_prompt.js');

function systemFor(topic) {
  return Prompt.buildPrompts({ subject: 'science', topic: topic }).system;
}

test('system prompt carries the trimmed water-cycle exemplar (all four scene captions)', () => {
  const system = systemFor('fractions-addition');
  const captions = [
    'Evaporation: water rises as vapour',
    'Condensation: vapour becomes cloud',
    'Precipitation: water falls as rain',
    'Watch out: water is not gone for good once it evaporates'
  ];
  for (const caption of captions) {
    assert.ok(system.indexOf(caption) !== -1,
      'system prompt must carry the exemplar caption: "' + caption + '"');
  }
});

test('exemplar keeps step verbs, shape kinds, anchors, and explain fields', () => {
  const system = systemFor('fractions-addition');
  for (const verb of ['"do":"show"', '"do":"move"', '"do":"emphasize"', '"do":"caption"']) {
    assert.ok(system.indexOf(verb) !== -1,
      'exemplar must keep the step verb ' + verb);
  }
  for (const kind of ['"kind":"circle"', '"kind":"text"', '"kind":"arrow"', '"kind":"polygon"']) {
    assert.ok(system.indexOf(kind) !== -1,
      'exemplar must keep the shape kind ' + kind);
  }
  assert.ok(system.indexOf('"explain":"The sun: its heat warms the sea and lifts the water."') !== -1,
    'exemplar must keep the explain fields verbatim');
  assert.ok(system.indexOf('"target":"drop1"') !== -1,
    'exemplar must keep move/emphasize targets');
});

test('system prompt carries the label-placement gate', () => {
  const system = systemFor('fractions-addition');
  assert.ok(system.indexOf('no text shape may overlap any other shape') !== -1,
    'system prompt must forbid text shapes overlapping any other shape');
});

test('system prompt carries the caption gate', () => {
  const system = systemFor('fractions-addition');
  assert.ok(system.indexOf('Every scene carries a caption (<= 60 chars)') !== -1,
    'system prompt must require a <= 60-char caption on every scene');
  assert.ok(system.indexOf('the caption names the phase being watched') !== -1,
    'system prompt must require captions to name the phase');
});

test('system prompt carries the explain gate', () => {
  const system = systemFor('fractions-addition');
  assert.ok(system.indexOf('Key chart/diagram parts carry an "explain" field') !== -1,
    'system prompt must require explain fields on key chart/diagram parts');
});

test('system prompt carries the emphasize-the-mechanism-beat gate', () => {
  const system = systemFor('fractions-addition');
  assert.ok(system.indexOf('Use "emphasize" on the mechanism beat of each scene') !== -1,
    'system prompt must put emphasize on the mechanism beat');
});

test('system prompt carries the visual wrong-turn gate', () => {
  const system = systemFor('fractions-addition');
  assert.ok(system.indexOf('must play out VISUALLY in the scene where the') !== -1,
    'system prompt must require the wrong turn to play out visually');
  assert.ok(system.indexOf('never as a caption merely saying it is wrong') !== -1,
    'system prompt must forbid caption-only wrong-turn markers');
});

test('embedded exemplar stays under the 3KB budget', () => {
  assert.equal(typeof Prompt.WATER_CYCLE_EXEMPLAR, 'string',
    'build_prompt.js must export WATER_CYCLE_EXEMPLAR so the budget can be locked');
  const bytes = Buffer.byteLength(Prompt.WATER_CYCLE_EXEMPLAR, 'utf8');
  assert.ok(bytes < 3072,
    'trimmed exemplar must stay under 3KB, got ' + bytes + ' bytes');
});
