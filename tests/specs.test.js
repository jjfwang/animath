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
const sampleFiles = fs.readdirSync(samplesDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();
const manifestPath = path.join(samplesDir, 'index.json');

// Validator unit tests below mutate a real sample in memory. Directory order
// is not a contract — a newly added sample can sort first and change
// fixtureFile — so pick a deterministic fixture: the first sample (sorted)
// whose opening step is a text shape that no later step references, with
// headroom in both opening scenes for an appended move step.
function pickFixtureFile(files, load) {
  for (const f of files) {
    const spec = load(f);
    if (spec.scenes.length < 2) continue;
    const s0 = spec.scenes[0], s1 = spec.scenes[1];
    const first0 = s0.steps[0], first1 = s1.steps[0];
    if (!first0 || first0.do !== 'show' || first0.shape.kind !== 'text') continue;
    if (!first1 || first1.do !== 'show') continue;
    const unreferenced = (sc, id) => sc.steps.slice(1).every((st) => st.target !== id);
    const headroom = (sc) =>
      sc.steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1 < sc.duration_ms;
    if (!unreferenced(s0, first0.shape.id) || !unreferenced(s1, first1.shape.id)) continue;
    if (!headroom(s0) || !headroom(s1)) continue;
    return f;
  }
  throw new Error('no suitable validator-test fixture sample found in samples/');
}
const fixtureFile = pickFixtureFile(sampleFiles,
  (f) => JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8')));

test('fixture picker skips samples that cannot host validator mutations', () => {
  const load = (f) => JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
  assert.ok(sampleFiles.includes(pickFixtureFile(sampleFiles, load)),
    'picker must return a listed sample');
  // jc-h2-complex.json opens with a line shape, not a text shape, so it can
  // never be picked as the validator-mutation fixture
  assert.throws(() => pickFixtureFile(['jc-h2-complex.json'], load),
    /no suitable validator-test fixture/, 'picker must throw when nothing qualifies');
});

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

test('secondary-a-quadratic-functions opens the A-Math band with quadratics', () => {
  const name = 'secondary-a-quadratic-functions.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'a-quadratic-functions', name + ' must carry the a-quadratic-functions topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected completing-square, discriminant, inequality and misconception scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-a-differentiation covers gradients, the power rule and stationary points', () => {
  const name = 'secondary-a-differentiation.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'a-differentiation', name + ' must carry the a-differentiation topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected secant, power-rule, first-principles, stationary-point and misconception scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-e-probability covers single and combined events', () => {
  const name = 'secondary-e-probability.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'e-probability', name + ' must carry the e-probability topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected single-event and combined-event scenes');
  // every sample in the manifest validates — the new file included
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
  for (const f of manifest) {
    const entry = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf8'));
    assert.deepEqual(validateSpec(entry), [], 'manifest entry ' + f + ' failed validation');
  }
});

test('secondary-a-binomial covers Pascal rows, term-by-term expansion and a worked (2x-3)^4', () => {
  const name = 'secondary-a-binomial.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'a-binomial', name + ' must carry the a-binomial topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected Pascal-row, term-by-term, worked and misconception scenes');
  assert.ok(spec.scenes.some((s) => /misconception/i.test(s.caption)),
    name + ' must include a misconception scene');
  const hasLatex = spec.scenes.some((s) => s.steps.some(
    (st) => st.do === 'show' && st.shape && st.shape.kind === 'latex' && st.shape.tex));
  assert.ok(hasLatex, name + ' must render formulas via latex shapes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-a-trigonometry covers identities, compound angles, the R-formula and a misconception', () => {
  const name = 'secondary-a-trigonometry.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'a-trigonometry', name + ' must carry the a-trigonometry topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected identity, compound-angle, R-formula and misconception scenes');
  assert.ok(spec.scenes.some((s) => /misconception/i.test(s.caption)),
    name + ' must include a misconception scene');
  const hasLatex = spec.scenes.some((s) => s.steps.some(
    (st) => st.do === 'show' && st.shape && st.shape.kind === 'latex' && st.shape.tex));
  assert.ok(hasLatex, name + ' must render formulas via latex shapes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-science-electricity covers circuits, current and Ohm\'s law', () => {
  const name = 'secondary-science-electricity.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'science', name + ' must be a science sample');
  assert.equal(spec.topic, 'phys-electricity', name + ' must carry the phys-electricity topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected circuit, current-flow and Ohm\'s-law scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-science-cells covers structure and organisation', () => {
  const name = 'secondary-science-cells.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'science', name + ' must be a science sample');
  assert.equal(spec.topic, 'bio-cells', name + ' must carry the bio-cells topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected plant-cell, animal-cell and function scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-science-chem-acids covers the pH scale, ions and neutralisation', () => {
  const name = 'secondary-science-chem-acids.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'science', name + ' must be a science sample');
  assert.equal(spec.topic, 'chem-acids', name + ' must carry the chem-acids topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected pH-scale, ion, neutralisation and litmus scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('secondary-science-chem-atomic covers atoms and the periodic table', () => {
  const name = 'secondary-science-chem-atomic.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'secondary', name + ' must be a secondary sample');
  assert.equal(spec.subject, 'science', name + ' must be a science sample');
  assert.equal(spec.topic, 'chem-atomic', name + ' must carry the chem-atomic topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected atom, element-count, group and period scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('jc-h2-differentiation covers connected rates with checked arithmetic', () => {
  const name = 'jc-h2-differentiation.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'jc', name + ' must be a jc sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'h2-differentiation', name + ' must carry the h2-differentiation topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected expanding-circle, ladder and misconception scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('jc-h2-sequences covers AP terms and GP sums with checked arithmetic', () => {
  const name = 'jc-h2-sequences.json';
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
  assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
  assert.equal(spec.level, 'jc', name + ' must be a jc sample');
  assert.equal(spec.subject, 'math', name + ' must be a math sample');
  assert.equal(spec.topic, 'h2-sequences', name + ' must carry the h2-sequences topic');
  assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
  assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
  assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
  assert.ok(spec.scenes.length >= 4, 'expected AP, GP-sum and misconception scenes');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
});

test('jc-h2-thermal and jc-h2-quantum cover kinetic theory and the photoelectric effect', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [name, topic, expectation] of [
    ['jc-h2-thermal.json', 'h2-thermal', 'kinetic-theory, pressure and misconception scenes'],
    ['jc-h2-quantum.json', 'h2-quantum', 'photon, threshold-frequency and misconception scenes']
  ]) {
    const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
    assert.deepEqual(validateSpec(spec), [], name + ' must validate with zero errors');
    assert.equal(spec.level, 'jc', name + ' must be a jc sample');
    assert.equal(spec.subject, 'science', name + ' must be a science sample');
    assert.equal(spec.topic, topic, name + ' must carry the ' + topic + ' topic');
    assert.equal(spec.animath, '0.1', name + ' must declare the v0.1 spec version');
    assert.equal(spec.canvas.width, 960, 'canvas width must be 960');
    assert.equal(spec.canvas.height, 540, 'canvas height must be 540');
    assert.ok(spec.scenes.length >= 4, 'expected ' + expectation);
    assert.ok(spec.scenes.some((s) => /misconception/i.test(s.caption)),
      name + ' must include a misconception scene');
    const hasLatex = spec.scenes.some((s) => s.steps.some(
      (st) => st.do === 'show' && st.shape && st.shape.kind === 'latex' && st.shape.tex));
    assert.ok(hasLatex, name + ' must render at least one formula via a latex shape');
    assert.ok(manifest.includes(name), name + ' must be registered in samples/index.json');
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
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  delete spec.title;
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.startsWith('title:')), 'expected a title error');
});

test('validator rejects LaTeX in text shapes', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape.text = 'x = \\frac{-b}{2a}';
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('LaTeX')), 'expected a LaTeX rejection');
});

test('validator accepts a valid latex shape', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = {
    id: 'm', kind: 'latex', x: 100, y: 100,
    tex: 'a^2 + b^2 = c^2', size: 32, color: '#1f7a3a'
  };
  assert.deepEqual(validateSpec(spec), []);
});

test('validator rejects latex shapes with missing or empty tex', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
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
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
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
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'ghost', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('must be shown earlier')), 'expected an ordering error');
});

test('validator accepts a polygon move with matching points, rejects kind-invalid fields', () => {
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[1].steps[0].shape = {
    id: 'tri', kind: 'polygon', points: [[100, 100], [200, 100], [150, 200]]
  };
  spec.scenes[1].steps.push({
    at_ms: atMsAfter(spec.scenes[1].steps), do: 'move', target: 'tri',
    to: { points: [[120, 100], [220, 100], [170, 220]] }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'polygon + {points} with matching point count must be accepted');
  spec.scenes[1].steps.pop();
  spec.scenes[1].steps.push({
    at_ms: atMsAfter(spec.scenes[1].steps), do: 'move', target: 'tri',
    to: { x: 10, y: 10 }, dur_ms: 500
  });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"polygon"') && p.includes('invalid')),
    'expected a polygon invalid-field error, got: ' + problems.join('; '));
});

test('validator rejects a move whose to fields do not match the circle target kind', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'dot', to: { x: 10, y: 10 }, dur_ms: 500 });
  const problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"circle"') && p.includes('cx,cy')),
    'expected an exact-field move error, got: ' + problems.join('; '));
});

test('validator accepts a move with a partial to field set on an arrow target', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'a', kind: 'arrow', x1: 10, y1: 10, x2: 50, y2: 50 };
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  spec.scenes[0].steps.push({
    at_ms: atMsAfter(spec.scenes[0].steps), do: 'move', target: 'a',
    to: { x1: 20, y1: 20 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'partial valid field sets are accepted by the size-field move contract');
});

test('validator accepts a move whose to fields exactly match the target kind', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
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

test('validator accepts a move that resizes a rect via size fields only', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'bar', kind: 'rect', x: 20, y: 40, w: 40, h: 30 };
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  spec.scenes[0].steps.push({
    at_ms: atMsAfter(spec.scenes[0].steps), do: 'move', target: 'bar',
    to: { w: 80 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'rect + {w} must be accepted (growing bar chart staple)');
});

test('validator accepts a move that grows a circle via its r field', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  spec.scenes[0].steps.push({
    at_ms: atMsAfter(spec.scenes[0].steps), do: 'move', target: 'dot',
    to: { r: 40 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'circle + {r} must be accepted');
});

test('validator accepts a move mixing position and size fields on a rect', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'bar', kind: 'rect', x: 20, y: 40, w: 40, h: 30 };
  const atMsAfter = (steps) => steps.reduce((m, st) => Math.max(m, st.at_ms), 0) + 1;
  spec.scenes[0].steps.push({
    at_ms: atMsAfter(spec.scenes[0].steps), do: 'move', target: 'bar',
    to: { x: 30, y: 50, w: 60, h: 40 }, dur_ms: 500
  });
  assert.deepEqual(validateSpec(spec), [],
    'rect + {x,y,w,h} must be accepted');
});

test('validator rejects an empty move to and kind-invalid size fields', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
  spec.scenes[0].steps[0].shape = { id: 'dot', kind: 'circle', cx: 100, cy: 100, r: 20 };
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'dot', to: {}, dur_ms: 500 });
  let problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('at least one numeric field')),
    'expected an empty-to error, got: ' + problems.join('; '));
  spec.scenes[0].steps.pop();
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'dot', to: { w: 60 }, dur_ms: 500 });
  problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"circle"') && p.includes('invalid')),
    'expected a w-on-circle error, got: ' + problems.join('; '));
  spec.scenes[0].steps[0].shape = { id: 'bar', kind: 'rect', x: 20, y: 40, w: 40, h: 30 };
  spec.scenes[0].steps.pop();
  spec.scenes[0].steps.push({ at_ms: 100, do: 'move', target: 'bar', to: { r: 20 }, dur_ms: 500 });
  problems = validateSpec(spec);
  assert.ok(problems.some((p) => p.includes('.to:') && p.includes('"rect"') && p.includes('invalid')),
    'expected an r-on-rect error, got: ' + problems.join('; '));
});

test('validator rejects a move without dur_ms, and one with a non-numeric dur_ms', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
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

test('validator rejects out-of-order steps', () => {  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, fixtureFile), 'utf8'));
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
  // (a) all seven moveable kinds on one line, latex included, polygon moveable
  assert.ok(system.includes('text | rect | circle | line | arrow | latex | polygon'),
    'system prompt must list all seven moveable kinds including latex and polygon');
  assert.ok(!system.includes('(never polygon)'),
    'system prompt must no longer say polygon is never moveable');
  assert.ok(system.includes('points for polygon'),
    'system prompt must document points as the polygon move field');
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
  // (d) size fields added to the contract: w/h for rect, r for circle
  assert.ok(system.includes('w/h for rect'),
    'system prompt must document w/h as the rect size fields');
  assert.ok(system.includes('r for circle'),
    'system prompt must document r as the circle size field');
});

test('player exports a pure per-field tween interpolator', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.interpFields, 'function', 'interpFields must be exported');
  // Mid-tween linearity on size fields.
  assert.equal(player.interpFields({ w: 40 }, { w: 80 }, 0.5).w, 60,
    'rect w 40->80 at p=0.5 must be 60');
  assert.equal(player.interpFields({ r: 10 }, { r: 20 }, 0.5).r, 15,
    'circle r 10->20 at p=0.5 must be 15');
  // Position-only from/to behaves as before.
  assert.deepEqual(player.interpFields({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.5),
    { x: 50, y: 25 });
  // A to-field with no starting value in from is skipped (no NaN tween).
  assert.deepEqual(player.interpFields({}, { w: 80 }, 0.5), {});
  // Endpoints hold: p=0 returns from, p=1 returns to for shared fields.
  assert.deepEqual(player.interpFields({ w: 40, x: 0 }, { w: 80, x: 100 }, 0),
    { w: 40, x: 0 });
  assert.deepEqual(player.interpFields({ w: 40, x: 0 }, { w: 80, x: 100 }, 1),
    { w: 80, x: 100 });
});

test('system template requires mechanism-first animation', () => {
  const { system } = buildPrompts({});
  assert.ok(system.includes('MECHANISM-FIRST'),
    'system prompt must include the MECHANISM-FIRST block');
  assert.ok(system.includes('state transition'),
    'system prompt must require a state transition in each scene');
  assert.ok(system.includes('supporting role'),
    'system prompt must keep on-screen text in a supporting role');
  assert.ok(system.includes('move vs'),
    'system prompt must give when-to-use guidance for move vs. staged show/hide');
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

test('keyAction maps Space to toggle, including the legacy Spacebar key', () => {
  const player = require('../player/player.js');
  const div = { tagName: 'DIV' };
  assert.equal(player.keyAction({ key: ' ', target: div }), 'toggle');
  assert.equal(player.keyAction({ key: 'Spacebar', target: div }), 'toggle');
  // no target at all (unit-fake event) still maps
  assert.equal(player.keyAction({ key: ' ' }), 'toggle');
});

test('keyAction maps arrow keys to prev/next', () => {
  const player = require('../player/player.js');
  const div = { tagName: 'DIV' };
  assert.equal(player.keyAction({ key: 'ArrowLeft', target: div }), 'prev');
  assert.equal(player.keyAction({ key: 'ArrowRight', target: div }), 'next');
});

test('keyAction ignores unmapped keys and typing contexts', () => {
  const player = require('../player/player.js');
  const div = { tagName: 'DIV' };
  assert.equal(player.keyAction({ key: 'Enter', target: div }), null);
  assert.equal(player.keyAction({ key: 'a', target: div }), null);
  assert.equal(player.keyAction({ key: undefined, target: div }), null);
  // input-focus ignore: Space on a typing target is null even though
  // Space maps to toggle elsewhere (tagName compared case-insensitively)
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(player.keyAction({ key: ' ', target: { tagName: tag } }), null,
      tag + ' target must ignore Space');
    assert.equal(player.keyAction({ key: ' ', target: { tagName: tag.toLowerCase() } }), null,
      tag.toLowerCase() + ' target must ignore Space');
  }
  // arrow keys on typing targets are also ignored
  assert.equal(player.keyAction({ key: 'ArrowLeft', target: { tagName: 'INPUT' } }), null);
});

test('prefersReducedMotion honors an injected matcher', () => {
  const player = require('../player/player.js');
  const on = (q) => { assert.equal(q, '(prefers-reduced-motion: reduce)'); return { matches: true }; };
  const off = () => ({ matches: false });
  assert.equal(player.prefersReducedMotion(on), true, 'matches:true chooses the instant path');
  assert.equal(player.prefersReducedMotion(off), false, 'matches:false keeps animation');
  // degenerate environments never throw and never trigger the instant path
  assert.equal(player.prefersReducedMotion(null), false);
  assert.equal(player.prefersReducedMotion(undefined), false);
  assert.equal(player.prefersReducedMotion('not-a-function'), false);
  assert.equal(player.prefersReducedMotion(() => { throw new Error('odd env'); }), false);
});

test('stripLabels returns one 1-based label per scene built from the caption', () => {
  const player = require('../player/player.js');
  assert.deepEqual(player.stripLabels([
    { id: 's1', caption: 'Meet the 3-4-5 triangle' },
    { id: 's2', caption: 'Read off sin, cos, tan' },
    { id: 's3', caption: 'Sine rule in action' },
  ]), ['1 · Meet the 3-4-5 triangle', '2 · Read off sin, cos, tan', '3 · Sine rule in action']);
});

test('stripLabels truncates long captions at the 28-char limit', () => {
  const player = require('../player/player.js');
  const long = 'A caption that is far longer than twenty-eight characters';
  const labels = player.stripLabels([{ id: 's1', caption: long }]);
  assert.equal(labels.length, 1);
  // 28 chars of caption plus the ellipsis, still 1-based with the prefix
  assert.equal(labels[0], '1 · ' + long.slice(0, 28) + '…');
  // exactly 28 chars is not truncated
  const exact = player.stripLabels([{ id: 's1', caption: 'x'.repeat(28) }]);
  assert.equal(exact[0], '1 · ' + 'x'.repeat(28), '28 chars is the limit, not over it');
});

test('stripLabels falls back to the scene id when the caption is empty', () => {
  const player = require('../player/player.js');
  assert.deepEqual(player.stripLabels([
    { id: 's1', caption: '' },
    { id: 's2', caption: null },
    { id: 's3' },
  ]), ['1 · s1', '2 · s2', '3 · s3']);
});

test('stripLabels tolerates empty and missing ids', () => {
  const player = require('../player/player.js');
  const labels = player.stripLabels([{ id: 's1' }, {}, { id: '' }, null, undefined]);
  // one label per scene even when the id is unusable
  assert.equal(labels.length, 5);
  // the label part is never the raw index: "1 · s1", not "0"
  assert.equal(labels[0], '1 · s1');
  assert.ok(labels[0].startsWith('1 · '), '1-based numbering: ' + labels[0]);
  // missing/empty ids fall back to the 0-based index, never throw
  assert.ok(labels[1].startsWith('2 · '), 'missing id tolerated: ' + labels[1]);
  assert.ok(labels[2].startsWith('3 · '), 'empty id tolerated: ' + labels[2]);
  assert.ok(labels[3].startsWith('4 · '), 'null scene tolerated: ' + labels[3]);
  assert.ok(labels[4].startsWith('5 · '), 'undefined scene tolerated: ' + labels[4]);
  // degenerate inputs yield an empty label list
  assert.deepEqual(player.stripLabels(null), []);
  assert.deepEqual(player.stripLabels(undefined), []);
  assert.deepEqual(player.stripLabels([]), []);
});

test('stripAria carries the full untruncated caption', () => {
  const player = require('../player/player.js');
  const long = 'A caption that is far longer than twenty-eight characters';
  assert.equal(player.stripAria(2, { id: 's3', caption: long }),
    'Go to scene 3: ' + long, 'aria keeps the full caption, no truncation');
  assert.equal(player.stripAria(0, { id: 's1', caption: 'Meet the 3-4-5 triangle' }),
    'Go to scene 1: Meet the 3-4-5 triangle');
  assert.equal(player.stripAria(1, { id: 's2' }), 'Go to scene 2',
    'no caption means a plain scene label, never the internal id');
  assert.equal(player.stripAria(0, null), 'Go to scene 1');
});

test('fullCaption returns the trimmed caption or empty string', () => {
  const player = require('../player/player.js');
  assert.equal(player.fullCaption({ caption: '  Meet the 3-4-5 triangle  ' }), 'Meet the 3-4-5 triangle');
  assert.equal(player.fullCaption({ caption: '' }), '');
  assert.equal(player.fullCaption({ caption: null }), '');
  assert.equal(player.fullCaption({}), '');
  assert.equal(player.fullCaption(null), '');
  assert.equal(player.fullCaption(undefined), '');
});

test('stripLabels is exported alongside the other pure helpers', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.stripLabels, 'function');
  assert.equal(typeof player.stripAria, 'function');
  assert.equal(typeof player.fullCaption, 'function');
  assert.equal(typeof player.keyAction, 'function');
  assert.equal(typeof player.prefersReducedMotion, 'function');
});

test('controlButtons lists the chrome affordances with restart last', () => {
  const player = require('../player/player.js');
  const buttons = player.controlButtons();
  assert.deepEqual(buttons.map((b) => b.action), ['prev', 'play', 'next', 'restart'],
    'chrome order must stay prev, play, next, then the new restart button');
  buttons.forEach((b) => {
    assert.ok(b.action && b.title && b.glyph, 'every chrome button needs action, title, and glyph');
  });
});

test('controlButtons restart affordance carries the replay affordance', () => {
  const player = require('../player/player.js');
  const restart = player.controlButtons().filter((b) => b.action === 'restart')[0];
  assert.ok(restart, 'a restart button must exist in the chrome');
  assert.equal(restart.title, 'Restart from the beginning');
  assert.ok(restart.glyph.indexOf('&#8635;') !== -1, 'restart glyph must be the replay arrow entity');
});

test('controlButtons is exported alongside the other pure helpers', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.controlButtons, 'function');
});

test('latexFit keeps the natural size when the equation fits the stage', () => {
  const player = require('../player/player.js');
  assert.deepEqual(player.latexFit(320.4, 58.1, 860), { width: 321, height: 59, scale: 1 });
});

test('latexFit scales the equation down when it would overflow the stage', () => {
  const player = require('../player/player.js');
  const fit = player.latexFit(1200, 60, 860);
  assert.equal(fit.width, 860);
  assert.equal(fit.height, 43, 'ceil(60 * 860/1200)');
  assert.ok(Math.abs(fit.scale - 860 / 1200) < 1e-9, 'scale factor must be avail/width');
});

test('latexFit clamps degenerate measurements to a 1px box', () => {
  const player = require('../player/player.js');
  assert.deepEqual(player.latexFit(0, -5, 0), { width: 1, height: 1, scale: 1 });
  assert.deepEqual(player.latexFit(860, 40, 860), { width: 860, height: 40, scale: 1 }, 'exact fit keeps scale 1');
});

test('fitLatex sizes the foreignObject to the measured equation when it fits', () => {
  const player = require('../player/player.js');
  const attrs = {};
  const node = {
    firstChild: { getBoundingClientRect: () => ({ width: 320.4, height: 58.1 }), style: {} },
    setAttribute: (k, v) => { attrs[k] = v; }
  };
  player.fitLatex(node, 860);
  assert.equal(attrs.width, 321);
  assert.equal(attrs.height, 59);
  assert.equal(node.firstChild.style.transform, undefined, 'no scale transform when the equation fits');
});

test('fitLatex scales the equation down to the available width when it overflows', () => {
  const player = require('../player/player.js');
  const attrs = {};
  const div = { getBoundingClientRect: () => ({ width: 1200, height: 60 }), style: {} };
  const node = { firstChild: div, setAttribute: (k, v) => { attrs[k] = v; } };
  player.fitLatex(node, 860);
  assert.equal(attrs.width, 860);
  assert.equal(attrs.height, 43);
  assert.ok(div.style.transform.startsWith('scale('), 'equation must be scaled, not clipped');
  assert.equal(div.style.transformOrigin, 'left top', 'scale must anchor at the shape x/y');
});

test('fitLatex no-ops without a measurable equation div', () => {
  const player = require('../player/player.js');
  const boom = () => { throw new Error('setAttribute must not run without a measured div'); };
  player.fitLatex(null, 860);
  player.fitLatex({ firstChild: null, setAttribute: boom }, 860);
  player.fitLatex({ firstChild: {}, setAttribute: boom }, 860);
});

test('latexFit and fitLatex are exported alongside the other pure helpers', () => {
  const player = require('../player/player.js');
  assert.equal(typeof player.latexFit, 'function');
  assert.equal(typeof player.fitLatex, 'function');
});

/* Sector shape validation (issue #155): cx, cy, r (positive), startAngle,
 * endAngle numeric; sector is not moveable in v0.
 */
function sectorSpec(shape) {
  function scene(id, shapes) {
    return {
      id: id, caption: 'A caption.', narration: 'A narration.',
      duration_ms: 8000,
      steps: shapes.map(function (sh, i) {
        return { at_ms: i * 1000, do: 'show', shape: Object.assign({ id: 's' + i }, sh) };
      })
    };
  }
  return {
    animath: '0.1', title: 'Sector validation', level: 'primary', subject: 'math',
    topic: 'data-graphs', kind: 'concept',
    canvas: { width: 960, height: 540 },
    scenes: [
      scene('a', [shape]),
      scene('b', [{ kind: 'text', x: 10, y: 10, text: 'filler' }])
    ]
  };
}

function goodSector() {
  return { kind: 'sector', cx: 480, cy: 270, r: 120, startAngle: 0, endAngle: 90, fill: '#ffcc00' };
}

test('validator accepts a well-formed sector shape', () => {
  assert.deepEqual(validateSpec(sectorSpec(goodSector())), []);
});

test('validator rejects a sector with zero, negative, or missing radius', () => {
  [0, -5].forEach(function (r) {
    var s = goodSector(); s.r = r;
    var errs = validateSpec(sectorSpec(s));
    assert.ok(errs.some(function (e) { return /\.r: required positive number/.test(e); }),
      'r=' + r + ' must be rejected, got: ' + JSON.stringify(errs));
  });
  var noR = goodSector(); delete noR.r;
  var errs = validateSpec(sectorSpec(noR));
  assert.ok(errs.some(function (e) { return /\.r: required positive number/.test(e); }),
    'missing r must be rejected, got: ' + JSON.stringify(errs));
});

test('validator rejects a sector with non-numeric angles or missing position', () => {
  var badAngle = goodSector(); badAngle.startAngle = 'ninety';
  assert.ok(validateSpec(sectorSpec(badAngle)).some(function (e) {
    return /\.startAngle: required number/.test(e);
  }), 'non-numeric startAngle must be rejected');
  var badAngle2 = goodSector(); badAngle2.endAngle = NaN;
  assert.ok(validateSpec(sectorSpec(badAngle2)).some(function (e) {
    return /\.endAngle: required number/.test(e);
  }), 'NaN endAngle must be rejected');
  var noCx = goodSector(); delete noCx.cx;
  assert.ok(validateSpec(sectorSpec(noCx)).some(function (e) {
    return /\.cx: required number/.test(e);
  }), 'missing cx must be rejected');
});

test('validator rejects moving a sector: not moveable in v0', () => {
  var spec = sectorSpec(goodSector());
  spec.scenes[0].steps.push(
    { at_ms: 2000, do: 'move', target: 's0', to: { cx: 500 }, dur_ms: 500 });
  var errs = validateSpec(spec);
  assert.equal(errs.length, 1, 'exactly one error expected, got: ' + JSON.stringify(errs));
  assert.ok(/not moveable in v0/.test(errs[0]), 'move of sector rejected, got: ' + errs[0]);
});
