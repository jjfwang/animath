/* animath test suite — zero dependencies, Node built-in test runner.
 * Run: node --test tests/
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateSpec } = require('../player/validate.js');
const { buildPrompts } = require('../generator/build_prompt.js');
const { extractJson } = require('../generator/llm_client.js');

const samplesDir = path.join(__dirname, '..', 'samples');
// index.json is the gallery manifest, not an animation spec — exclude it
// from the spec-validation glob and test it separately below.
const sampleFiles = fs.readdirSync(samplesDir).filter((f) => f.endsWith('.json') && f !== 'index.json');
const manifestPath = path.join(samplesDir, 'index.json');

test('gallery manifest lists exactly the existing, valid samples', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(Array.isArray(manifest), 'samples/index.json must be a JSON array of filenames');
  assert.ok(manifest.length >= 3, 'expected at least 3 samples in the manifest, found ' + manifest.length);
  for (const f of manifest) {
    const full = path.join(samplesDir, f);
    assert.ok(fs.existsSync(full), 'manifest entry ' + f + ' does not exist in samples/');
    const spec = JSON.parse(fs.readFileSync(full, 'utf8'));
    const problems = validateSpec(spec);
    assert.deepEqual(problems, [], 'manifest entry ' + f + ' failed validation: ' + problems.join('; '));
  }
  // no sample left unlisted — the gallery renders the manifest, so a stray
  // file would be playable nowhere
  const unlisted = sampleFiles.filter((f) => !manifest.includes(f));
  assert.deepEqual(unlisted, [], 'samples not listed in samples/index.json: ' + unlisted.join(', '));
});

test('every sample validates clean against SPEC.md', () => {
  assert.ok(sampleFiles.length >= 3, 'expected at least 3 samples, found ' + sampleFiles.length);
  for (const f of sampleFiles) {
    const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
    const problems = validateSpec(spec);
    assert.deepEqual(problems, [], f + ' failed validation: ' + problems.join('; '));
  }
});

test('samples cover math and science across levels', () => {
  const specs = sampleFiles.map((f) =>
    JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8')));
  const subjects = new Set(specs.map((s) => s.subject));
  const levels = new Set(specs.map((s) => s.level));
  assert.ok(subjects.has('math') && subjects.has('science'), 'samples should cover math and science');
  assert.ok(levels.has('primary') && levels.has('secondary'), 'samples should span levels');
});

test('validator rejects a spec with no title', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  delete spec.title;
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.startsWith('title:')), 'expected a title error');
});

test('validator rejects LaTeX in text shapes', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape.text = 'x = \\frac{-b}{2a}';
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('LaTeX')), 'expected a LaTeX rejection');
});

test('validator rejects a move targeting an unshown shape', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'ghost', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('must be shown earlier')), 'expected an ordering error');
});

test('validator rejects out-of-order steps', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  const steps = spec.scenes[0].steps;
  steps.push({ at_ms: 1, do: 'caption', text: 'too late, too early' });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('ordered ascending')), 'expected an ordering error');
});

test('prompt builder fills slots and forbids LaTeX', () => {
  const { system, user } = buildPrompts({
    level: 'primary', subject: 'math', topic: 'fractions',
    topicLabel: 'Fractions', kind: 'concept', focus: 'adding unlike denominators'
  });
  assert.ok(!system.includes('{{'), 'unfilled slot in system prompt');
  assert.ok(!user.includes('{{'), 'unfilled slot in user prompt');
  assert.ok(system.includes('NEVER LaTeX'), 'system prompt must forbid LaTeX');
  assert.ok(user.includes('fractions'), 'user prompt must name the topic');
  assert.ok(user.includes('adding unlike denominators'), 'user prompt must carry the focus');
});

test('llm client strips code fences before parsing', () => {
  const spec = extractJson('```json\n{"animath":"0.1"}\n```');
  assert.deepEqual(spec, { animath: '0.1' });
});

test('llm client rejects non-JSON', () => {
  assert.throws(() => extractJson('here is your animation, enjoy!'), /not valid JSON/);
});

test('player.js loads without a DOM', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.mount, 'function');
  assert.equal(player.version, '0.1');
});
