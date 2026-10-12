/* README pipeline example drift test (issue #705) — zero network.
 * Guards the drift filed as #705: the README "Install as a library" section
 * documents @jjfwang/animath/pipeline (generateAnimation, the prompt-in
 * animation-out API) and @jjfwang/animath/unpack (unpackTopic) as a worked
 * example. This test extracts that fenced example from README.md VERBATIM and
 * runs it end to end with a stubbed fetch, so the docs cannot drift from the
 * real API. The real validateSpec runs as the pipeline's validate dep.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module } = require('node:module');

const ROOT = path.join(__dirname, '..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

const START = '<!-- README_PIPELINE_EXAMPLE -->';
const END = '<!-- /README_PIPELINE_EXAMPLE -->';

function extractExample() {
  const start = README.indexOf(START);
  const end = README.indexOf(END);
  assert.ok(start !== -1 && end !== -1 && end > start, 'README_PIPELINE_EXAMPLE markers present');
  const block = README.slice(start + START.length, end);
  const fence = block.match(/```js\n([\s\S]*?)```/);
  assert.ok(fence, 'fenced js example present between the markers');
  return fence[1];
}

// Canned LLM traffic: the unpack call asks for state transitions, the author
// call asks for a spec. The canned spec must pass the REAL validateSpec.
const TRANSITIONS = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
];
const SPEC = {
  animath: '0.1', title: 'Water cycle', level: 'primary', subject: 'science',
  topic: 'water-cycle', kind: 'concept', canvas: { width: 960, height: 540 },
  scenes: [{
    id: 's1', caption: 'Evaporation', narration: 'Water evaporates.',
    duration_ms: 4000,
    steps: [{ at_ms: 0, do: 'show', shape: { id: 'sun', kind: 'circle', cx: 800, cy: 100, r: 40, fill: '#f59e0b' } }],
  }],
};

function stubFetch() {
  return async (url, init) => {
    assert.equal(url, 'https://api.example.com/v1/chat/completions');
    const body = JSON.parse(init.body);
    const user = body.messages.find((m) => m.role === 'user').content;
    const content = user.indexOf('ordered state transitions') !== -1
      ? JSON.stringify(TRANSITIONS)
      : JSON.stringify(SPEC);
    return { json: async () => ({ choices: [{ message: { content } }] }) };
  };
}

function loadExample(code) {
  const m = new Module('readme-pipeline-example', module);
  m.filename = path.join(ROOT, 'tests', 'fixtures', 'readme-pipeline-example.js');
  m.paths = Module._nodeModulePaths(ROOT);
  m._compile(code, m.filename);
  return m.exports;
}

test('README pipeline example is present and extracts cleanly', () => {
  const code = extractExample();
  assert.ok(code.indexOf("require('@jjfwang/animath/pipeline')") !== -1, 'requires the pipeline subpath');
  assert.ok(code.indexOf('validate: validateSpec') !== -1, 'wires the real validator as the validate dep');
});

test('README pipeline example runs end to end with a stubbed fetch', async () => {
  const example = loadExample(extractExample());
  const realFetch = globalThis.fetch;
  globalThis.fetch = stubFetch();
  try {
    const spec = await example.main();
    assert.deepEqual(spec, SPEC);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('README documents the unpack subpath alongside the other subpaths', () => {
  assert.ok(README.indexOf("require('@jjfwang/animath/unpack')") !== -1, 'unpack subpath listed');
  assert.ok(README.indexOf('unpackTopic') !== -1, 'unpackTopic mentioned');
});
