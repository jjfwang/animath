/* animath explain-prompt tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the explain-authoring instruction in generator/build_prompt.js
 * SYSTEM_TEMPLATE (issue #594): the built system prompt must instruct the LLM
 * to author explain fields per the SPEC.md authoring guidance (name the part,
 * state what it means in this scene, one short sentence, plain text, no
 * markdown/LaTeX; key chart/diagram parts carry one, decorative shapes and
 * captions do not), and no template placeholder may survive the fill —
 * otherwise newly generated samples silently regress the #559 explain rollout.
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

test('system prompt carries the explain-authoring instruction', () => {
  const system = systemFor('primary', 'concept');
  for (const phrase of [
    '"explain"',
    'name the part',
    'state what it means in this scene',
    'one short sentence',
    'plain text',
    'no markdown',
    'no LaTeX',
    'Decorative shapes',
    'captions do not carry one'
  ]) {
    assert.ok(system.indexOf(phrase) !== -1,
      'system prompt must instruct explain authorship: missing "' + phrase + '"');
  }
});

test('explain instruction is present for every level and kind', () => {
  for (const level of ['primary', 'secondary', 'jc']) {
    for (const kind of ['concept', 'problem']) {
      const system = systemFor(level, kind);
      assert.ok(system.indexOf('"explain"') !== -1,
        level + '/' + kind + ': system prompt must carry the explain instruction');
      assert.ok(system.indexOf('name the part') !== -1,
        level + '/' + kind + ': system prompt must carry the SPEC.md authoring guidance');
    }
  }
});

test('explain instruction also fills when the topic resolves a misconception entry', () => {
  const system = systemFor('secondary', 'problem', 'photosynthesis-intro');
  assert.ok(system.indexOf('"explain"') !== -1,
    'system prompt with a seeded topic must still carry the explain instruction');
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
