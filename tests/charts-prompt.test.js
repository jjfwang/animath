/* animath charts-prompt tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the chart-construction instruction in generator/build_prompt.js
 * SYSTEM_TEMPLATE (issue #612): the built system prompt must instruct the LLM
 * to author chart shapes in the toolkit's canonical descriptor forms (per
 * SPEC.md and the generator/charts.js docstrings — pie sectors with
 * value-proportional sweeps, bars from a zero baseline, "nice" ticks,
 * number lines, area polygons, grids), and no template placeholder may
 * survive the fill — otherwise newly generated specs hand-author chart
 * shapes with no canonical guidance, regressing the #610 adoption work.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Prompt = require('../generator/build_prompt.js');

function systemFor(level, kind, topic) {
  return Prompt.buildPrompts({
    level: level, subject: 'math', topic: topic || 'fractions', kind: kind
  }).system;
}

test('system prompt carries the chart-construction instruction', () => {
  const system = systemFor('primary', 'concept');
  for (const phrase of [
    '"sector"',
    'value-proportional sweeps',
    '0 is east',
    'positive is clockwise',
    'zero baseline',
    '"nice" tick values',
    'number lines',
    'as a baseline with tick marks',
    '"polygon"',
    'close back to the axis baseline',
    'chart grids'
  ]) {
    assert.ok(system.indexOf(phrase) !== -1,
      'system prompt must instruct chart authorship: missing "' + phrase + '"');
  }
});

test('chart instruction is present for every level and kind', () => {
  for (const level of ['primary', 'secondary', 'jc']) {
    for (const kind of ['concept', 'problem']) {
      const system = systemFor(level, kind);
      assert.ok(system.indexOf('"sector"') !== -1,
        level + '/' + kind + ': system prompt must carry the chart instruction');
      assert.ok(system.indexOf('zero baseline') !== -1,
        level + '/' + kind + ': system prompt must carry the bar-chart guidance');
    }
  }
});

test('chart instruction also fills when the topic resolves a misconception entry', () => {
  const system = systemFor('secondary', 'problem', 'photosynthesis-intro');
  assert.ok(system.indexOf('"sector"') !== -1,
    'system prompt with a seeded topic must still carry the chart instruction');
});

test('no template placeholder is left unfilled', () => {
  for (const level of ['primary', 'secondary', 'jc']) {
    const system = systemFor(level, 'concept');
    for (const slot of ['{{MISCONCEPTION_LINE}}', '{{LEVEL_LABEL}}', '{{TONE}}']) {
      assert.ok(system.indexOf(slot) === -1,
        level + ': template slot ' + slot + ' must be filled');
    }
    assert.ok(system.indexOf('{{') === -1 && system.indexOf('}}') === -1,
      level + ': no {{ }} placeholder may survive the fill');
  }
});
