/* animath unpack-layer tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the topic unpack layer (generator/unpack.js, issue #685): the
 * prompt builder (buildUnpackPrompts), the transition parser/validator
 * (parseTransitions), and the model-agnostic entry point (unpackTopic),
 * which callers drive with a canned/fixture llmCall — never the network.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const Unpack = require('../generator/unpack.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

// Canned model response: fenced JSON, exercises the fence-stripping path.
const WATER_CYCLE_TEXT = [
  '```json',
  '[',
  '  {"name": "evaporation", "from_state": "liquid water", "to_state": "water vapour", "driver": "the sun\'s heat"},',
  '  {"name": "condensation", "from_state": "water vapour", "to_state": "liquid droplets", "driver": "cooling"},',
  '  {"name": "precipitation", "from_state": "droplets", "to_state": "falling water", "driver": "gravity"},',
  '  {"name": "collection", "from_state": "fallen water", "to_state": "gathered seas/rivers", "driver": "gravity"}',
  ']',
  '```'
].join('\n');

const WATER_CYCLE_EXPECTED = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: 'the sun\'s heat' },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' },
  { name: 'precipitation', from_state: 'droplets', to_state: 'falling water', driver: 'gravity' },
  { name: 'collection', from_state: 'fallen water', to_state: 'gathered seas/rivers', driver: 'gravity' }
];

// Canned model response: prose-wrapped JSON, exercises the bracket-scan path.
const FRACTIONS_TEXT = [
  'Here are the state transitions for adding fractions:',
  '[',
  '  {"name": "find a common denominator", "from_state": "fractions with different denominators", "to_state": "equivalent fractions sharing one denominator", "driver": "multiplying top and bottom by the same number"},',
  '  {"name": "add the numerators", "from_state": "like fractions", "to_state": "one fraction with the summed numerator", "driver": "adding the parts"},',
  '  {"name": "simplify", "from_state": "an unreduced fraction", "to_state": "the fraction in lowest terms", "driver": "dividing by the common factor"}',
  ']',
  'That is the full chain.'
].join('\n');

function fakeLlm(text) {
  return function (prompts) { return text; };
}

// --- buildUnpackPrompts ---

test('buildUnpackPrompts throws when topic is empty', () => {
  assert.throws(() => Unpack.buildUnpackPrompts('', { subject: 'science' }),
    /topic must be a non-empty string/);
});

test('buildUnpackPrompts throws when topic is not a string', () => {
  assert.throws(() => Unpack.buildUnpackPrompts(42, { subject: 'science' }),
    /topic must be a non-empty string/);
});

test('buildUnpackPrompts throws when opts is omitted', () => {
  assert.throws(() => Unpack.buildUnpackPrompts('water-cycle'),
    /subject is required/);
});

test('buildUnpackPrompts throws when subject is missing', () => {
  assert.throws(() => Unpack.buildUnpackPrompts('water-cycle', {}),
    /subject is required/);
});

test('buildUnpackPrompts defaults the level to primary', () => {
  const prompts = Unpack.buildUnpackPrompts('water-cycle', { subject: 'science' });
  assert.ok(prompts.system.indexOf('Primary school (PSLE)') !== -1,
    'system prompt should default to the primary level label');
  assert.ok(prompts.user.indexOf('Topic: water-cycle') !== -1);
  assert.ok(prompts.user.indexOf('Subject: science') !== -1);
  assert.ok(prompts.user.indexOf('Primary school (PSLE)') !== -1);
});

test('buildUnpackPrompts labels a known level', () => {
  const prompts = Unpack.buildUnpackPrompts('water-cycle', {
    subject: 'science', level: 'secondary'
  });
  assert.ok(prompts.system.indexOf('Secondary school (O/N-level)') !== -1,
    'system prompt should carry the secondary level label');
});

test('buildUnpackPrompts passes an unknown level through', () => {
  const prompts = Unpack.buildUnpackPrompts('water-cycle', {
    subject: 'science', level: 'university'
  });
  assert.ok(prompts.system.indexOf('university') !== -1,
    'unknown levels should survive in the system prompt');
});

test('built prompts carry the unpack rules and no placeholder survives', () => {
  const prompts = Unpack.buildUnpackPrompts('water-cycle', {
    subject: 'science', level: 'primary'
  });
  for (const phrase of [
    'Return ONLY a JSON array',
    'from_state',
    'to_state',
    '"driver"',
    '2 to 8 transitions',
    'STATE CHANGE',
    'mechanism-first'
  ]) {
    assert.ok(prompts.system.indexOf(phrase) !== -1,
      'system prompt must carry the unpack rules: missing "' + phrase + '"');
  }
  for (const built of [prompts.system, prompts.user]) {
    assert.ok(built.indexOf('{{') === -1 && built.indexOf('}}') === -1,
      'no {{ }} placeholder may survive the fill');
  }
});

// --- parseTransitions ---

test('water-cycle parses to exactly the four expected transitions in order', () => {
  const transitions = Unpack.parseTransitions(WATER_CYCLE_TEXT);
  assert.deepEqual(transitions, WATER_CYCLE_EXPECTED);
});

test('prose-wrapped arrays parse via the bracket scan', () => {
  const transitions = Unpack.parseTransitions(FRACTIONS_TEXT);
  assert.equal(transitions.length, 3);
  assert.deepEqual(transitions.map((t) => t.name), [
    'find a common denominator',
    'add the numerators',
    'simplify'
  ]);
});

test('parsed field values are trimmed', () => {
  const transitions = Unpack.parseTransitions(
    '[{"name": "  heat  ", "from_state": " cold ", "to_state": " warm ", "driver": " fire "},' +
    ' {"name": "cool", "from_state": "warm", "to_state": "cold", "driver": "ice"}]');
  assert.equal(transitions[0].name, 'heat');
  assert.equal(transitions[0].from_state, 'cold');
});

test('parseTransitions throws on non-string input', () => {
  assert.throws(() => Unpack.parseTransitions(null), /non-empty model response text/);
});

test('parseTransitions throws on empty input', () => {
  assert.throws(() => Unpack.parseTransitions('   '), /non-empty model response text/);
});

test('parseTransitions throws when there is no JSON array at all', () => {
  assert.throws(() => Unpack.parseTransitions('No transitions here, just prose.'),
    /no JSON array/);
});

test('parseTransitions throws when the brackets hold unparseable text', () => {
  assert.throws(() => Unpack.parseTransitions('Some notes: [not json at all] ok?'),
    /Unexpected token/);
});

test('parseTransitions throws when the JSON is not an array', () => {
  assert.throws(() => Unpack.parseTransitions('{"name": "evaporation"}'),
    /must be a JSON array/);
});

test('parseTransitions throws on a one-transition array', () => {
  assert.throws(() => Unpack.parseTransitions(
    '[{"name": "a", "from_state": "x", "to_state": "y", "driver": "z"}]'),
    /expected 2-8 transitions, got 1/);
});

test('parseTransitions throws on a nine-transition array', () => {
  const items = [];
  for (let i = 0; i < 9; i++) {
    items.push('{"name": "t' + i + '", "from_state": "x", "to_state": "y", "driver": "z"}');
  }
  assert.throws(() => Unpack.parseTransitions('[' + items.join(',') + ']'),
    /expected 2-8 transitions, got 9/);
});

test('parseTransitions throws when a transition is not an object', () => {
  assert.throws(() => Unpack.parseTransitions('["evaporation", "condensation"]'),
    /transition 1.*must be an object/);
});

test('parseTransitions throws when a field is missing', () => {
  assert.throws(() => Unpack.parseTransitions(
    '[{"name": "evaporation", "from_state": "liquid water", "to_state": "water vapour"},' +
    ' {"name": "condensation", "from_state": "water vapour", "to_state": "droplets", "driver": "cooling"}]'),
    /transition 1 "driver" must be a non-empty string/);
});

test('parseTransitions throws when a field is not a string', () => {
  assert.throws(() => Unpack.parseTransitions(
    '[{"name": "evaporation", "from_state": "liquid water", "to_state": "water vapour", "driver": 42},' +
    ' {"name": "condensation", "from_state": "water vapour", "to_state": "droplets", "driver": "cooling"}]'),
    /"driver" must be a non-empty string/);
});

test('parseTransitions throws when a field is whitespace-only', () => {
  assert.throws(() => Unpack.parseTransitions(
    '[{"name": "   ", "from_state": "liquid water", "to_state": "water vapour", "driver": "heat"},' +
    ' {"name": "condensation", "from_state": "water vapour", "to_state": "droplets", "driver": "cooling"}]'),
    /"name" must be a non-empty string/);
});

// --- unpackTopic ---

test('unpackTopic rejects when the topic is invalid', async () => {
  await assert.rejects(
    Unpack.unpackTopic('', { subject: 'science' }, fakeLlm(WATER_CYCLE_TEXT)),
    /topic must be a non-empty string/);
});

test('unpackTopic rejects when the subject is missing', async () => {
  await assert.rejects(
    Unpack.unpackTopic('water-cycle', {}, fakeLlm(WATER_CYCLE_TEXT)),
    /subject is required/);
});

test('unpackTopic rejects when llmCall is not a function', async () => {
  await assert.rejects(
    Unpack.unpackTopic('water-cycle', { subject: 'science' }, 'not-a-function'),
    /llmCall must be a function/);
});

test('unpackTopic hands the built prompts to llmCall and returns the transitions', async () => {
  let seen = null;
  const transitions = await Unpack.unpackTopic('water-cycle', {
    subject: 'science', level: 'primary'
  }, (prompts) => {
    seen = prompts;
    return WATER_CYCLE_TEXT;
  });
  assert.ok(seen && typeof seen.system === 'string' && typeof seen.user === 'string',
    'llmCall should receive the {system, user} prompts');
  assert.ok(seen.user.indexOf('Topic: water-cycle') !== -1);
  assert.deepEqual(transitions, WATER_CYCLE_EXPECTED);
});

test('unpackTopic accepts an async llmCall', async () => {
  const transitions = await Unpack.unpackTopic('fractions-addition', {
    subject: 'math'
  }, (prompts) => Promise.resolve(FRACTIONS_TEXT));
  assert.equal(transitions.length, 3);
  for (const t of transitions) {
    for (const field of ['name', 'from_state', 'to_state', 'driver']) {
      assert.equal(typeof t[field], 'string');
      assert.ok(t[field].trim().length > 0,
        'every transition field must be a non-empty string');
    }
  }
  // The chain reads as one continuous mechanism: each state leads into the next.
  assert.ok(transitions[1].from_state.indexOf('fractions') !== -1);
  assert.ok(transitions[2].from_state.indexOf('fraction') !== -1);
});

test('unpackTopic rejects when the model text does not parse', async () => {
  await assert.rejects(
    Unpack.unpackTopic('water-cycle', { subject: 'science' },
      fakeLlm('Sorry, I cannot do that.')),
    /parseTransitions/);
});

test('module exposes all three helpers and both templates', () => {
  assert.equal(typeof Unpack.buildUnpackPrompts, 'function');
  assert.equal(typeof Unpack.parseTransitions, 'function');
  assert.equal(typeof Unpack.unpackTopic, 'function');
  assert.equal(typeof Unpack.UNPACK_SYSTEM_TEMPLATE, 'string');
  assert.equal(typeof Unpack.UNPACK_USER_TEMPLATE, 'string');
});

// --- attachMisconceptions (issue #695) ---

test('attachMisconceptions annotates the water-cycle evaporation transition only', () => {
  const before = JSON.stringify(WATER_CYCLE_EXPECTED);
  const out = Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, 'water-cycle');
  assert.notStrictEqual(out, WATER_CYCLE_EXPECTED,
    'a match returns a new array, never the input reference');
  assert.equal(JSON.stringify(WATER_CYCLE_EXPECTED), before,
    'the input array is never mutated');
  const names = out.map(t => t.name);
  assert.deepStrictEqual(names, ['evaporation', 'condensation', 'precipitation', 'collection']);
  const beat = out[0].misconception;
  assert.ok(beat, 'the evaporation transition carries the misconception beat');
  const entry = MISCONCEPTIONS['water-cycle'];
  assert.deepStrictEqual(beat, {
    wrongTurn: entry.wrongTurn,
    why: entry.why,
    correctTurn: entry.correctTurn
  });
  for (const t of out.slice(1)) {
    assert.strictEqual(t.misconception, undefined,
      'transition ' + t.name + ' must carry no misconception beat');
  }
  // The unannotated transitions keep their four plain fields, nothing more.
  assert.deepStrictEqual(Object.keys(out[1]).sort(),
    ['driver', 'from_state', 'name', 'to_state']);
});

test('attachMisconceptions matches transition names case-insensitively after trimming', () => {
  const odd = [
    { name: '  EVAPORATION ', from_state: 'a', to_state: 'b', driver: 'c' },
    { name: 'condensation', from_state: 'b', to_state: 'c', driver: 'd' }
  ];
  const out = Unpack.attachMisconceptions(odd, 'water-cycle');
  assert.notStrictEqual(out, odd);
  assert.ok(out[0].misconception, 'padded/cased names still match the entry transition');
  assert.strictEqual(out[1].misconception, undefined);
  assert.equal(out[0].name, '  EVAPORATION ',
    'the matched transition keeps its original name spelling');
});

test('attachMisconceptions returns the input unchanged for an unknown topic slug', () => {
  const out = Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, 'pythagoras');
  assert.strictEqual(out, WATER_CYCLE_EXPECTED);
});

test('attachMisconceptions returns the input unchanged for missing or non-string slugs', () => {
  assert.strictEqual(Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, ''), WATER_CYCLE_EXPECTED);
  assert.strictEqual(Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, undefined), WATER_CYCLE_EXPECTED);
  assert.strictEqual(Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, null), WATER_CYCLE_EXPECTED);
});

test('attachMisconceptions returns the input unchanged when the entry has no transition field', () => {
  // 'fractions' is a seeded plain entry with no transition annotation.
  const out = Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, 'fractions');
  assert.strictEqual(out, WATER_CYCLE_EXPECTED);
});

test('attachMisconceptions returns the input unchanged when no transition name matches', () => {
  const noEvaporation = WATER_CYCLE_EXPECTED.slice(1);
  const out = Unpack.attachMisconceptions(noEvaporation, 'water-cycle');
  assert.strictEqual(out, noEvaporation);
});

test('attachMisconceptions resolves longer file-style slugs via the longest prefix', () => {
  const out = Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, 'water-cycle-coastal-drip');
  assert.notStrictEqual(out, WATER_CYCLE_EXPECTED);
  assert.ok(out[0].misconception, 'prefix resolution still finds the water-cycle entry');
});

test('attachMisconceptions resolves faceted entries through the primary facet', () => {
  // 'bio-nutrition' is faceted with no transition field anywhere, so the
  // beat resolution runs (primary facet) and the input is unchanged.
  const out = Unpack.attachMisconceptions(WATER_CYCLE_EXPECTED, 'bio-nutrition');
  assert.strictEqual(out, WATER_CYCLE_EXPECTED);
});

test('attachMisconceptions passes non-array input straight through', () => {
  assert.strictEqual(Unpack.attachMisconceptions(null, 'water-cycle'), null);
  assert.strictEqual(Unpack.attachMisconceptions('nope', 'water-cycle'), 'nope');
});

test('attachMisconceptions module exposes the new helper', () => {
  assert.equal(typeof Unpack.attachMisconceptions, 'function');
});

// The bank loader in unpack.js mirrors build_prompt.js's guarded pattern:
// browser-global fallback when module/require are absent, {} when the
// require fails. Both are exercised through a vm sandbox so the coverage
// run sees every loader line.
test('browser globals path: attachMisconceptions resolves the bank off the global', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'unpack.js'), 'utf8');
  const sandbox = {
    AnimathMisconceptions: require('../generator/misconceptions.js')
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'unpack-browser-globals.js' });
  const unpack = sandbox.AnimathUnpack;
  assert.ok(unpack && typeof unpack.attachMisconceptions === 'function',
    'UMD sets the browser global');
  const out = unpack.attachMisconceptions([
    { name: 'evaporation', from_state: 'a', to_state: 'b', driver: 'c' },
    { name: 'condensation', from_state: 'b', to_state: 'c', driver: 'd' }
  ], 'water-cycle');
  assert.ok(out[0].misconception, 'bank resolves through the browser global');
  assert.ok(out[0].misconception.wrongTurn.indexOf('evaporates') !== -1);
  assert.strictEqual(out[1].misconception, undefined);
});

test('a failing bank require degrades attachMisconceptions to unchanged input', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'unpack.js'), 'utf8');
  const sandbox = {
    module: { exports: {} },
    require: function () { throw new Error('bank unavailable'); }
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'unpack-bank-failure.js' });
  // The sandboxed module took the Node export branch, so the API sits on
  // the sandbox's own module.exports rather than a browser global.
  const unpack = sandbox.module.exports;
  const input = [
    { name: 'evaporation', from_state: 'a', to_state: 'b', driver: 'c' },
    { name: 'condensation', from_state: 'b', to_state: 'c', driver: 'd' }
  ];
  assert.strictEqual(unpack.attachMisconceptions(input, 'water-cycle'), input,
    'with no bank the transitions pass through unchanged instead of failing');
});
