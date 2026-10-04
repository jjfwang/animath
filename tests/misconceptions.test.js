/* animath misconception library tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards generator/misconceptions.js (issue #101) and the misconceptionFor /
 * injection wiring in generator/build_prompt.js: every library entry keeps its
 * three string fields, lookup resolves short slugs and longer file-style slugs,
 * unknown slugs fall back to the generic PEDAGOGY line, and buildPrompts
 * injects the entry text for seeded slugs.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { MISCONCEPTIONS } = require('../generator/misconceptions.js');
const Prompt = require('../generator/build_prompt.js');

const PRIMARY_MATH_SLUGS = [
  'whole-numbers', 'fractions', 'decimals', 'percentage', 'ratio', 'rate-speed',
  'algebra-intro', 'geometry-angles', 'area-perimeter', 'volume',
  'data-graphs', 'model-method'
];

const PRIMARY_SCIENCE_SLUGS = [
  'human-body-systems', 'plant-systems', 'life-cycles', 'water-cycle',
  'energy-forms', 'photosynthesis', 'forces-magnets', 'adaptations'
];

const SEEDED_SLUGS = PRIMARY_MATH_SLUGS.concat(PRIMARY_SCIENCE_SLUGS);

test('MISCONCEPTIONS holds exactly the 20 seeded topic slugs (12 Primary Math + 8 Primary Science)', () => {
  assert.deepStrictEqual(Object.keys(MISCONCEPTIONS).sort(), SEEDED_SLUGS.slice().sort());
});

test('every entry has non-empty wrongTurn, why and correctTurn strings', () => {
  for (const slug of SEEDED_SLUGS) {
    const e = MISCONCEPTIONS[slug];
    for (const f of ['wrongTurn', 'why', 'correctTurn']) {
      assert.strictEqual(typeof e[f], 'string',
        'entry ' + slug + ' field ' + f + ' must be a plain string');
      assert.ok(e[f].length > 0, 'entry ' + slug + ' field ' + f + ' must not be empty');
    }
  }
});

test('misconceptionFor resolves exact slugs', () => {
  const e = Prompt.misconceptionFor('fractions');
  assert.strictEqual(e, MISCONCEPTIONS['fractions']);
  assert.strictEqual(Prompt.misconceptionFor('model-method'), MISCONCEPTIONS['model-method']);
});

test('misconceptionFor resolves longer file-style slugs via longest prefix', () => {
  assert.strictEqual(Prompt.misconceptionFor('fractions-addition'), MISCONCEPTIONS['fractions']);
  assert.strictEqual(Prompt.misconceptionFor('percentage-of-quantity'), MISCONCEPTIONS['percentage']);
  assert.strictEqual(Prompt.misconceptionFor('decimals-place-value'), MISCONCEPTIONS['decimals']);
  assert.strictEqual(Prompt.misconceptionFor('ratio-sharing'), MISCONCEPTIONS['ratio']);
  assert.strictEqual(Prompt.misconceptionFor('photosynthesis-intro'), MISCONCEPTIONS['photosynthesis']);
  assert.strictEqual(Prompt.misconceptionFor('water-cycle'), MISCONCEPTIONS['water-cycle']);
});

test('misconceptionFor returns null for unknown or missing slugs', () => {
  assert.strictEqual(Prompt.misconceptionFor('pythagoras'), null);
  assert.strictEqual(Prompt.misconceptionFor(''), null);
  assert.strictEqual(Prompt.misconceptionFor(undefined), null);
  assert.strictEqual(Prompt.misconceptionFor('fraction'), null); // no dash boundary -> no prefix hit
});

test('buildPrompts injects the seeded entry text for a seeded slug', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'fractions', kind: 'concept' });
  const e = MISCONCEPTIONS['fractions'];
  assert.ok(p.system.indexOf(e.wrongTurn) !== -1, 'system prompt must contain the wrongTurn text');
  assert.ok(p.system.indexOf(e.why) !== -1, 'system prompt must contain the why text');
  assert.ok(p.system.indexOf(e.correctTurn) !== -1, 'system prompt must contain the correctTurn text');
  assert.ok(p.system.indexOf('{{MISCONCEPTION_LINE}}') === -1, 'template placeholder must be filled');
});

test('buildPrompts keeps the generic line for an unknown slug', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'pythagoras', kind: 'concept' });
  assert.ok(p.system.indexOf('1/2 + 1/4 is NOT 2/6') !== -1,
    'system prompt must keep the generic misconception line for unknown slugs');
});

test('buildPrompts injects via the longer file-style slug too', () => {
  const p = Prompt.buildPrompts({ level: 'primary', subject: 'math', topic: 'percentage-of-quantity', kind: 'concept' });
  assert.ok(p.system.indexOf(MISCONCEPTIONS['percentage'].wrongTurn) !== -1,
    'system prompt must contain the percentage wrongTurn text via prefix resolution');
});
