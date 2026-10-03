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
const { extractJson, generateSpecWithRepair } = require('../generator/llm_client.js');

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

test('validator accepts a valid latex shape', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape = {
    id: 'm', kind: 'latex', x: 100, y: 100,
    tex: 'a^2 + b^2 = c^2', size: 32, color: '#1f7a3a'
  };
  assert.deepEqual(validateSpec(spec), []);
});

test('validator rejects latex shapes with missing or empty tex', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  const shape = { id: 'm', kind: 'latex', x: 100, y: 100 };
  spec.scenes[0].steps[0].shape = shape;
  assert.ok(validateSpec(spec).some((p) => p.includes('.tex:')),
    'expected a tex error for a missing tex field');
  shape.tex = '';
  assert.ok(validateSpec(spec).some((p) => p.includes('.tex:')),
    'expected a tex error for an empty tex string');
  shape.tex = 'x^2';
  delete shape.x;
  assert.ok(validateSpec(spec).some((p) => p.includes('.x:')),
    'expected a position error for a missing x');
});

test('latex backslashes are allowed in tex but still rejected in text', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape = {
    id: 'm', kind: 'latex', x: 100, y: 100, tex: '\\frac{1}{2} + \\sqrt{x}'
  };
  assert.deepEqual(validateSpec(spec), [],
    'backslashes are legitimate inside latex tex and must not be rejected');
});

test('katexAvailable detects a KaTeX API object', () => {
  const player = require('../player/player.js');
  assert.equal(player.katexAvailable(undefined), false, 'absent katex');
  assert.equal(player.katexAvailable(null), false, 'null katex');
  assert.equal(player.katexAvailable({}), false, 'katex without renderToString');
  assert.equal(player.katexAvailable({ renderToString: () => '' }), true, 'katex with renderToString');
});

test('latexFallbackText approximates common LaTeX as unicode', () => {
  const player = require('../player/player.js');
  assert.equal(player.latexFallbackText('a^2 + b^2 = c^2'), 'a² + b² = c²');
  assert.equal(player.latexFallbackText('\\frac{1}{2} + \\sqrt{x}'), '1/2 + √(x)');
  assert.equal(player.latexFallbackText('\\pi \\times \\theta \\approx 2'), 'π × θ ≈ 2');
});

test('validator rejects a move targeting an unshown shape', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'ghost', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('must be shown earlier')), 'expected an ordering error');
});

test('validator rejects a move targeting a non-moveable shape kind', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[1].steps[0].shape = {
    id: 'tri', kind: 'polygon', points: [[100, 100], [200, 100], [150, 200]]
  };
  spec.scenes[1].steps.push({ at_ms: 100, do: 'move', target: 'tri', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.length > 0, 'expected at least one error');
  assert.ok(problems.some((p) => p.includes('"polygon"') && p.includes('not moveable')),
    'expected a polygon move error, got: ' + problems.join('; '));
});

test('validator rejects a move whose to fields do not match the circle target kind', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'dot', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"circle"') && p.includes('cx,cy')),
    'expected an exact-field move error, got: ' + problems.join('; '));
});

test('validator rejects a move with a partial to field set on an arrow target', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'a', kind: 'arrow', x1: 10, y1: 10, x2: 50, y2: 50 };
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'a', to: { x1: 20, y1: 20 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"arrow"') && p.includes('x1,y1,x2,y2')),
    'expected an exact-field move error, got: ' + problems.join('; '));
});

test('validator accepts a move whose to fields exactly match the target kind', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  spec.scenes[0].steps.push({
    at_ms: atMsAfter(spec.scenes[0].steps), do: 'move', target: 'dot',
    to: { cx: 10, cy: 20 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'circle + {cx,cy} must be accepted');
  spec.scenes[1].steps[0].shape = { id: 'a', kind: 'arrow', x1: 10, y1: 10, x2: 50, y2: 50 };
  spec.scenes[1].steps.push({
    at_ms: atMsAfter(spec.scenes[1].steps), do: 'move', target: 'a',
    to: { x1: 20, y1: 20, x2: 60, y2: 60 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'arrow + {x1,y1,x2,y2} must be accepted');
});

test('validator rejects a move without dur_ms, and one with a non-numeric dur_ms', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  const at = atMsAfter(spec.scenes[0].steps);
  spec.scenes[0].steps.push({ at_ms: at, do: 'move', target: 'dot', to: { cx: 10, cy: 20 } });
  let problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.dur_ms:') && p.includes('required')),
    'expected a missing-dur_ms error, got: ' + problems.join('; '));
  spec.scenes[0].steps.pop();
  spec.scenes[0].steps.push({ at_ms: at, do: 'move', target: 'dot', to: { cx: 10, cy: 20 }, dur_ms: 'fast' });
  problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.dur_ms:') && p.includes('required')),
    'expected a non-numeric-dur_ms error, got: ' + problems.join('; '));
});

test('validator rejects out-of-order steps', () => {  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, sampleFiles[0]), 'utf8'));
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
  assert.ok(system.includes('NEVER LaTeX'), 'system prompt must forbid LaTeX inside text shapes');
  assert.ok(system.includes('latex'), 'system prompt must document the latex shape kind');
  assert.ok(user.includes('fractions'), 'user prompt must name the topic');
  assert.ok(user.includes('adding unlike denominators'), 'user prompt must carry the focus');
});

test('system template documents the hardened move contract', () => {
  const { system } = buildPrompts({});
  // (a) all six moveable kinds on one line, latex included, polygon excluded
  assert.ok(system.includes('text | rect | circle | line | arrow | latex'),
    'system prompt must list all six moveable kinds including latex');
  assert.ok(system.includes('(never polygon)'),
    'system prompt must say polygon is never moveable');
  // (b) dur_ms required and numeric on move steps
  assert.ok(system.includes('numeric dur_ms'),
    'system prompt must require a numeric dur_ms on every move step');
  // (c) exact position-field sets per target kind
  assert.ok(system.includes('x/y for text/rect/latex'),
    'system prompt must give x/y as the position fields for text/rect/latex');
  assert.ok(system.includes('cx/cy for circle'),
    'system prompt must give cx/cy as the position fields for circle');
  assert.ok(system.includes('x1/y1/x2/y2 for line/arrow'),
    'system prompt must give x1/y1/x2/y2 as the position fields for line/arrow');
});

test('llm client strips code fences before parsing', () => {
  const spec = extractJson('```json\n{"animath":"0.1"}\n```');
  assert.deepEqual(spec, { animath: '0.1' });
});

test('llm client rejects non-JSON', () => {
  assert.throws(() => extractJson('here is your animation, enjoy!'), /not valid JSON/);
});

// --- generateSpecWithRepair: stub global fetch with a canned
// chat-completions payload and count the HTTP calls per run.
function stubFetch(contents) {
  const bodies = [];
  let n = 0;
  global.fetch = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    const content = typeof contents === 'function' ? contents(n) : contents[Math.min(n, contents.length - 1)];
    n++;
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  return { bodies, calls: () => n, restore: () => { delete global.fetch; } };
}

const repairOpts = { baseUrl: 'https://llm.test/v1', apiKey: 'k', model: 'm', system: 's', user: 'u' };

test('generateSpecWithRepair returns a valid spec without repair calls', async () => {
  const spec = { animath: '0.1', title: 'Fractions' };
  const stub = stubFetch([JSON.stringify(spec)]);
  try {
    const out = await generateSpecWithRepair(repairOpts, () => []);
    assert.deepEqual(out, spec);
    assert.equal(stub.calls(), 1, 'expected exactly 1 fetch call, got ' + stub.calls());
  } finally {
    stub.restore();
  }
});

test('generateSpecWithRepair feeds the invalid spec and errors back on repair', async () => {
  const bad = { animath: '0.1' };
  const good = { animath: '0.1', title: 'Fractions' };
  const errors = ['title: missing'];
  const stub = stubFetch([JSON.stringify(bad), JSON.stringify(good)]);
  const validate = (s) => (s.title ? [] : errors);
  try {
    const out = await generateSpecWithRepair(repairOpts, validate);
    assert.deepEqual(out, good);
    assert.equal(stub.calls(), 2, 'expected exactly 2 fetch calls, got ' + stub.calls());
    const repairUser = stub.bodies[1].messages[1].content;
    assert.ok(repairUser.includes(JSON.stringify(bad, null, 2)),
      'repair turn must include the invalid spec');
    for (const e of errors) {
      assert.ok(repairUser.includes(e), 'repair turn must include error: ' + e);
    }
  } finally {
    stub.restore();
  }
});

test('generateSpecWithRepair rejects after maxRepairs with the final errors', async () => {
  const errors = ['title: missing'];
  const stub = stubFetch(['{"animath":"0.1"}']);
  try {
    await assert.rejects(
      generateSpecWithRepair(repairOpts, () => errors),
      (e) => e.message.includes('title: missing')
    );
    assert.equal(stub.calls(), 3, 'expected exactly 3 fetch calls, got ' + stub.calls());
  } finally {
    stub.restore();
  }
});

test('generateSpecWithRepair treats a non-JSON repair turn as a failed attempt', async () => {
  const bad = { animath: '0.1' };
  const good = { animath: '0.1', title: 'Fractions' };
  const stub = stubFetch([
    JSON.stringify(bad),      // initial: invalid spec
    'here is your animation!', // repair turn 1: not JSON
    JSON.stringify(good)       // repair turn 2: valid
  ]);
  const validate = (s) => (s.title ? [] : ['title: missing']);
  try {
    const out = await generateSpecWithRepair(repairOpts, validate);
    assert.deepEqual(out, good);
    assert.equal(stub.calls(), 3, 'expected exactly 3 fetch calls, got ' + stub.calls());
  } finally {
    stub.restore();
  }
});

test('player.js loads without a DOM', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.mount, 'function');
  assert.equal(player.version, '0.1');
});
