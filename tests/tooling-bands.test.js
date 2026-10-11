/* Tests for generator/tooling/measure-rubric-bands.js (issue #663).
 * Run: node --test "tests/*.test.js"
 *
 * The script re-derives the "MEASURED BANDS" numbers in generator/rubric.js
 * live from samples/*.json. These tests lock the rubric's constants against
 * the script's live measurement: when the corpus drifts, the constants must
 * be re-derived (re-run the script, update rubric.js) rather than left
 * stale — this suite fails until they are.
 *
 * Zero dependencies beyond node:assert/strict and node:test, like the rest
 * of the suite.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const child = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const scriptPath = path.join(repoRoot, 'generator', 'tooling', 'measure-rubric-bands.js');
const { measure } = require('../generator/tooling/measure-rubric-bands.js');
const rubric = require('../generator/rubric.js');

const TIERS = ['size>=48', 'size32-44', 'size24-30', 'size<=22'];
const TIER_PROBE_SIZE = { 'size>=48': 64, 'size32-44': 40, 'size24-30': 24, 'size<=22': 18 };

test('rubric band constants equal the live corpus measurement', () => {
  const m = measure();
  assert.ok(m.samples > 0 && m.scenes > 0 && m.consecutiveGaps > 0,
    'the script must actually scan the corpus, not an empty dir: ' + JSON.stringify(m.samples));
  assert.equal(rubric.bands.MIN_DURATION, m.durationMs.min, 'MIN_DURATION must equal the measured min duration');
  assert.equal(rubric.bands.MAX_DURATION, m.durationMs.max, 'MAX_DURATION must equal the measured max duration');
  assert.equal(rubric.bands.MAX_GAP, m.stepGapMs.max, 'MAX_GAP must equal the measured max step gap');
  assert.equal(rubric.bands.STAGE_MS, m.stepGapMs.p95, 'STAGE_MS must equal the measured p95 step gap');
});

test('char budgets sit above their measured maxima', () => {
  const m = measure();
  assert.ok(rubric.bands.MAX_CAPTION > m.captions.max,
    'MAX_CAPTION ' + rubric.bands.MAX_CAPTION + ' must exceed measured caption max ' + m.captions.max);
  assert.ok(rubric.bands.LATEX_BUDGET > m.latexTexMaxChars,
    'LATEX_BUDGET ' + rubric.bands.LATEX_BUDGET + ' must exceed measured tex max ' + m.latexTexMaxChars);
  TIERS.forEach(function (tier) {
    const budget = rubric.textBudget(TIER_PROBE_SIZE[tier]);
    assert.ok(budget > m.textTierMaxChars[tier],
      'textBudget(' + TIER_PROBE_SIZE[tier] + ')=' + budget + ' must exceed measured ' + tier + ' max ' + m.textTierMaxChars[tier]);
  });
  // A non-numeric size is scored as size 24, so it shares that tier's budget.
  assert.ok(rubric.textBudget(undefined) > m.textTierMaxChars['size24-30'],
    'the missing-size tier must stay above the measured size24-30 max');
});

test('CLI prints the same derivation as measure()', () => {
  const r = child.spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(r.status, 0, 'the CLI must exit 0: ' + r.stderr);
  const fromCli = JSON.parse(r.stdout);
  const fromApi = measure();
  assert.deepEqual(fromCli, fromApi, 'CLI JSON output must match measure() exactly');
  assert.ok(fromCli.samples > 0, 'CLI output must carry a real sample count');
});

function writeSamplesDir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'animath-bands-'));
  const dir = path.join(root, 'samples');
  fs.mkdirSync(dir);
  Object.keys(files).forEach(function (name) {
    const body = files[name];
    fs.writeFileSync(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  });
  return root;
}

// A validator-clean sample exercising the branches the live corpus cannot:
// kind "problem", a text shape with no numeric size (scored as size 24),
// a resolving topic whose narration carries no wrong-turn marker, and a
// hide step (no shape to scan).
function fixtureSample() {
  return {
    animath: '0.1', title: 'Bands fixture', level: 'primary', subject: 'math',
    topic: 'percentage', kind: 'problem',
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', caption: 'A plain caption', narration: 'A plain narration with no marker words at all.',
      duration_ms: 6000,
      steps: [
        { at_ms: 0, do: 'show', shape: { id: 't1', kind: 'text', x: 10, y: 10, size: 48, text: 'Big' } },
        { at_ms: 100, do: 'show', shape: { id: 't2', kind: 'text', x: 10, y: 60, text: 'no numeric size here' } },
        { at_ms: 200, do: 'show', shape: { id: 'l1', kind: 'latex', x: 10, y: 100, tex: 'x^2' } },
        { at_ms: 300, do: 'hide', target: 't1' }
      ]
    }]
  };
}

test('fixture corpus: exclusions, problem count, sizeless text, unmarked resolving topic', () => {
  const root = writeSamplesDir({
    'index.json': '["fixture.json"]',
    'notes.txt': 'not a sample',
    'fixture.json': fixtureSample()
  });
  const m = measure(root);
  assert.equal(m.samples, 1, 'index.json and non-json files must be excluded');
  assert.equal(m.scenes, 1);
  assert.equal(m.consecutiveGaps, 3);
  assert.equal(m.kindProblem, 1, 'kind "problem" must be counted');
  assert.equal(m.shapesWithoutNumericSize, 1, 'text without a numeric size must be counted');
  assert.equal(m.textTierMaxChars['size24-30'], 20, 'sizeless text lands in the size-24 tier');
  assert.equal(m.textTierMaxChars['size>=48'], 3);
  assert.equal(m.latexShapes, 1);
  assert.equal(m.latexTexMaxChars, 3);
  assert.equal(m.topicsResolving, 1, 'percentage resolves in the misconception library');
  assert.equal(m.wrongTurnMatches, 0, 'no marker words in the fixture narration');
  assert.deepEqual(m.durationMs, { min: 6000, max: 6000, p5: 6000, p95: 6000 });
  fs.rmSync(root, { recursive: true, force: true });
});

test('empty samples dir: null bands instead of a throw', () => {
  const root = writeSamplesDir({ 'index.json': '[]' });
  const m = measure(root);
  assert.equal(m.samples, 0);
  assert.equal(m.durationMs.min, null);
  assert.equal(m.stepGapMs.p95, null);
  assert.equal(m.sceneCount.max, null);
  fs.rmSync(root, { recursive: true, force: true });
});
