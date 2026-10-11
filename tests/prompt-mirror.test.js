/* animath prompt-mirror tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Locks the PROMPTS.md "## System prompt" fenced block to the evaluated
 * SYSTEM_TEMPLATE in generator/build_prompt.js (issue #618): the doc block
 * presents itself as the template the prompt builder fills, but it drifted
 * (rule-6 line wrap, rule-7 backticked latex/text, trailing blank line) —
 * so the documentation no longer described the text the LLM actually
 * receives. The block must stay byte-identical to the evaluated template;
 * if the template changes, the doc is regenerated from it (not hand-typed).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Prompt = require('../generator/build_prompt.js');

function systemPromptBlock() {
  const md = fs.readFileSync(path.join(__dirname, '..', 'PROMPTS.md'), 'utf8');
  const open = md.indexOf('## System prompt\n\n```\n');
  assert.ok(open !== -1, 'PROMPTS.md must carry a "## System prompt" fenced block');
  const start = open + '## System prompt\n\n```\n'.length;
  const end = md.indexOf('\n```', start);
  assert.ok(end !== -1, 'PROMPTS.md system-prompt fence must close');
  return md.slice(start, end);
}

test('SYSTEM_TEMPLATE is exported by build_prompt.js', () => {
  assert.equal(typeof Prompt.SYSTEM_TEMPLATE, 'string',
    'build_prompt.js must export SYSTEM_TEMPLATE so the mirror can be locked');
});

test('PROMPTS.md system-prompt block equals the evaluated template', () => {
  assert.equal(systemPromptBlock(), Prompt.SYSTEM_TEMPLATE,
    'PROMPTS.md block must be byte-identical to the evaluated SYSTEM_TEMPLATE');
});

test('the mirror carries the template slots verbatim', () => {
  const block = systemPromptBlock();
  for (const slot of ['{{MISCONCEPTION_LINE}}', '{{LEVEL_LABEL}}', '{{TONE}}']) {
    assert.ok(block.indexOf(slot) !== -1,
      'mirror must preserve the template slot ' + slot + ' unfilled');
  }
});
