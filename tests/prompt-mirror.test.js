/* animath prompt-mirror tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Locks the PROMPTS.md "## System prompt" fenced block to the evaluated
 * SYSTEM_TEMPLATE in generator/build_prompt.js (issue #618): the doc block
 * presents itself as the template the prompt builder fills, but it drifted
 * (rule-6 line wrap, rule-7 backticked latex/text, trailing blank line) —
 * so the documentation no longer described the text the LLM actually
 * receives. The block must stay byte-identical to the evaluated template;
 * if the template changes, the doc is regenerated from it (not hand-typed)
 * with generator/tooling/regen-prompt-mirror.js — see
 * generator/tooling/README.md for the documented regeneration procedure.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Prompt = require('../generator/build_prompt.js');
const regen = require('../generator/tooling/regen-prompt-mirror.js');
const os = require('node:os');

const OPEN_MARKER = '## System prompt\n\n```\n';

function systemPromptBlock() {
  const md = fs.readFileSync(path.join(__dirname, '..', 'PROMPTS.md'), 'utf8');
  const open = md.indexOf(OPEN_MARKER);
  assert.ok(open !== -1, 'PROMPTS.md must carry a "## System prompt" fenced block');
  const start = open + OPEN_MARKER.length;
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

// regen-prompt-mirror (issue #620) round-trip tests.

function fixtureDoc(body) {
  return '# Doc\n\nintro text\n\n' + OPEN_MARKER + body + '\n```\n\ntail text\n';
}

function withMutatedBlock(doc) {
  const open = doc.indexOf(OPEN_MARKER);
  const start = open + OPEN_MARKER.length;
  const end = doc.indexOf('\n```', start);
  const body = doc.slice(start, end);
  return doc.slice(0, start) + body.replace('animation author', 'animation author!') + doc.slice(end);
}

function withTempFile(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'animath-prompt-mirror-'));
  const file = path.join(dir, 'PROMPTS.md');
  fs.writeFileSync(file, content, 'utf8');
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('regenPromptMirror replaces the fenced block with the template byte-for-byte', () => {
  const result = regen.regenPromptMirror(fixtureDoc('stale block'), 'TEMPLATE');
  assert.equal(result.changed, true);
  assert.equal(result.doc, fixtureDoc('TEMPLATE'));
});

test('regenPromptMirror is a no-op on the current PROMPTS.md (idempotence)', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'PROMPTS.md'), 'utf8');
  const result = regen.regenPromptMirror(md, Prompt.SYSTEM_TEMPLATE);
  assert.equal(result.changed, false);
  assert.equal(result.doc, md);
});

test('regenPromptMirror throws when the open marker is missing', () => {
  assert.throws(() => regen.regenPromptMirror('# no markers here\n', 'TEMPLATE'),
    /missing marker/);
});

test('regenPromptMirror throws when the closing fence is missing', () => {
  assert.throws(() => regen.regenPromptMirror('# Doc\n\n' + OPEN_MARKER + 'body', 'TEMPLATE'),
    /never closes/);
});

test('regenPromptMirror fails closed when the template contains a fence', () => {
  assert.throws(() => regen.regenPromptMirror(fixtureDoc('stale'), 'a\n```\nb'),
    /ambiguous block end/);
});

test('run() repairs a drifted block and leaves a clean mirror untouched', () => {
  const md = fs.readFileSync(path.join(__dirname, '..', 'PROMPTS.md'), 'utf8');
  withTempFile(withMutatedBlock(md), (file) => {
    const summary = regen.run(file);
    assert.match(summary, /regenerated/);
    assert.equal(fs.readFileSync(file, 'utf8'), md,
      'regenerated temp copy must be byte-identical to the clean PROMPTS.md');
  });
  const cleanSummary = withTempFile(md, (file) => regen.run(file));
  assert.match(cleanSummary, /no change/);
});

test('cli() returns 0 on a clean mirror and 1 when the markers are missing', () => {
  assert.equal(regen.cli(path.join(__dirname, '..', 'PROMPTS.md')), 0);
  const broken = withTempFile('# no markers here\n', (file) => regen.cli(file));
  assert.equal(broken, 1);
});

test('launch() passes the cli exit code to the exit function', () => {
  let seen;
  regen.launch((code) => { seen = code; });
  assert.equal(seen, 0);
});
