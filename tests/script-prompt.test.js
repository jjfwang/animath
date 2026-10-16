/* animath script-prompt tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards Materials Phase 3b (issue #764): the hand-authored gold script
 * (samples/scripts/primary-science-water-cycle.json), the script
 * prompt builder (generator/build_script_prompt.js), its
 * SCRIPT_SYSTEM_TEMPLATE rules, and the trimmed
 * WATER_CYCLE_SCRIPT_EXEMPLAR embedded in it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Script = require('../generator/build_script_prompt.js');
const { validateScript } = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'scripts', 'primary-science-water-cycle.json');
const gold = JSON.parse(fs.readFileSync(GOLD_PATH, 'utf8'));

const BANK_BEAT = MISCONCEPTIONS['water-cycle'];
const CUSTOM_BEAT = {
  wrongTurn: 'Rain falls because clouds get too full and spill.',
  why: 'A cloud looks like a sponge that can overfill.',
  correctTurn: 'Drops grow too heavy to float, so gravity pulls them down.'
};

const WATER_CYCLE_TRANSITIONS = [
  {
    name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour',
    driver: "the sun's heat",
    misconception: {
      wrongTurn: BANK_BEAT.wrongTurn, why: BANK_BEAT.why, correctTurn: BANK_BEAT.correctTurn
    }
  },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' },
  { name: 'precipitation', from_state: 'droplets', to_state: 'falling water', driver: 'gravity' },
  { name: 'collection', from_state: 'fallen water', to_state: 'gathered seas and rivers', driver: 'gravity' }
];

const WORKED_EXAMPLE = 'Example: a puddle dries - sun lifts vapour, a cloud forms, rain returns it.';

function fullOpts() {
  return {
    level: 'primary', subject: 'science', topic: 'water-cycle',
    topicLabel: 'Water cycle', focus: 'the full loop',
    transitions: WATER_CYCLE_TRANSITIONS,
    misconceptions: [CUSTOM_BEAT],
    workedExample: WORKED_EXAMPLE
  };
}

/* (a) The gold script */

test('gold script loads and validateScript returns no errors', () => {
  assert.equal(gold.title, 'The Water Cycle');
  assert.equal(gold.level, 'primary');
  assert.equal(gold.subject, 'science');
  assert.equal(gold.topic, 'water-cycle');
  assert.deepEqual(validateScript(gold), []);
});

test('gold script segments are timed, cued, questioned and watch the misconception', () => {
  const total = gold.segments.reduce((sum, s) => sum + s.minutes, 0);
  assert.ok(total >= 5 && total <= 120, 'gold minutes sum ' + total + ' is inside 5-120');
  for (const s of gold.segments) {
    assert.ok(typeof s.minutes === 'number' && s.minutes > 0, 'segment minutes positive');
    assert.ok(s.say && s.say.trim(), 'segment say present');
  }
  assert.ok(gold.segments.some((s) => s.cue && s.cue.trim()), 'at least one cue names a scene id or material');
  assert.ok(gold.segments.some((s) => Array.isArray(s.questions) && s.questions.length >= 1),
    'at least one segment carries questions');
  const watchers = gold.segments.filter((s) => s.watchFor && s.watchFor.includes(BANK_BEAT.wrongTurn));
  assert.ok(watchers.length >= 1, 'at least one watchFor names the bank misconception');
});

/* (b) buildScriptPrompts with full water-cycle inputs */

test('built system prompt carries the script rules and quality gates', () => {
  const { system } = Script.buildScriptPrompts(fullOpts());
  for (const phrase of [
    'Return ONLY the script JSON',
    'title, level, subject, topic, segments',
    'positive number',
    'scene id or a material',
    'watchFor is keyed to the misconception',
    'segment minutes sum to 5-120',
    'QUALITY GATES',
    'segments cover transitions in order',
    Script.WATER_CYCLE_SCRIPT_EXEMPLAR
  ]) {
    assert.ok(system.includes(phrase), 'system prompt must contain: ' + phrase);
  }
});

test('built user prompt carries transitions in order, beats and the worked example', () => {
  const { user } = Script.buildScriptPrompts(fullOpts());
  const expectedLines = [
    '1. evaporation: "liquid water" -> "water vapour" (driver: the sun\'s heat)',
    '2. condensation: "water vapour" -> "liquid droplets" (driver: cooling)',
    '3. precipitation: "droplets" -> "falling water" (driver: gravity)',
    '4. collection: "fallen water" -> "gathered seas and rivers" (driver: gravity)'
  ];
  let lastIndex = -1;
  for (const line of expectedLines) {
    const idx = user.indexOf(line);
    assert.ok(idx !== -1, 'user prompt must contain transition line: ' + line);
    assert.ok(idx > lastIndex, 'transition lines must be in order');
    lastIndex = idx;
  }
  assert.ok(user.includes('Script misconception'));
  assert.ok(user.includes(BANK_BEAT.wrongTurn));
  assert.ok(user.includes(CUSTOM_BEAT.wrongTurn));
  assert.ok(user.includes(WORKED_EXAMPLE));
});

test('no unfilled placeholder survives buildScriptPrompts', () => {
  const { system, user } = Script.buildScriptPrompts(fullOpts());
  assert.ok(!system.includes('{{'));
  assert.ok(!user.includes('{{'));
});

/* (c) Degenerate inputs */

test('no transitions, misconceptions or worked example still yields a coherent prompt', () => {
  const out = Script.buildScriptPrompts({ subject: 'history', topic: 'fall-of-singapore' });
  assert.ok(out.system.includes('Primary school (PSLE)'));
  assert.ok(out.system.includes('Return ONLY the script JSON'));
  assert.ok(!out.system.includes('TRANSITION SEGMENTS'));
  assert.ok(out.user.includes('Address exactly one common misconception for the topic'));
  assert.ok(!out.user.includes('Worked example for this topic'));
  assert.ok(!out.system.includes('{{') && !out.user.includes('{{'));
});

test('empty transitions and null misconceptions behave like absent ones', () => {
  const out = Script.buildScriptPrompts({
    subject: 'science', topic: 'water-cycle', transitions: [], misconceptions: null
  });
  assert.ok(!out.system.includes('TRANSITION SEGMENTS'));
  assert.ok(out.user.includes(BANK_BEAT.wrongTurn));
  const outNull = Script.buildScriptPrompts({
    subject: 'science', topic: 'water-cycle', transitions: null, workedExample: null
  });
  assert.ok(!outNull.system.includes('TRANSITION SEGMENTS'));
  assert.ok(!outNull.user.includes('Worked example for this topic'));
});

test('missing subject throws the documented error', () => {
  assert.throws(() => Script.buildScriptPrompts({ topic: 'water-cycle' }),
    /buildScriptPrompts: subject is required/);
  assert.throws(() => Script.buildScriptPrompts(),
    /buildScriptPrompts: subject is required/);
  assert.throws(() => Script.buildScriptPrompts({ subject: '' }),
    /buildScriptPrompts: subject is required/);
});

test('malformed transitions throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Script.buildScriptPrompts({ ...base, transitions: 'evaporation' }),
    /buildScriptPrompts: opts\.transitions must be an array/);
  assert.throws(() => Script.buildScriptPrompts({ ...base, transitions: [WATER_CYCLE_TRANSITIONS[0]] }),
    /buildScriptPrompts: opts\.transitions must hold 2-8 transitions, got 1/);
  const nine = WATER_CYCLE_TRANSITIONS.concat(WATER_CYCLE_TRANSITIONS).concat([WATER_CYCLE_TRANSITIONS[0]]);
  assert.equal(nine.length, 9);
  assert.throws(() => Script.buildScriptPrompts({ ...base, transitions: nine }),
    /buildScriptPrompts: opts\.transitions must hold 2-8 transitions, got 9/);
  const missingField = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour' },
    WATER_CYCLE_TRANSITIONS[1]
  ];
  assert.throws(() => Script.buildScriptPrompts({ ...base, transitions: missingField }),
    /buildScriptPrompts: opts\.transitions\[0\]\.driver must be a non-empty string/);
  assert.throws(() => Script.buildScriptPrompts({ ...base, transitions: ['nope', WATER_CYCLE_TRANSITIONS[1]] }),
    /buildScriptPrompts: opts\.transitions\[0\] must be an object/);
});

test('malformed misconceptions and worked example throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Script.buildScriptPrompts({ ...base, misconceptions: 'a beat' }),
    /buildScriptPrompts: opts\.misconceptions must be an array/);
  assert.throws(() => Script.buildScriptPrompts({ ...base, misconceptions: [42] }),
    /buildScriptPrompts: opts\.misconceptions\[0\] must be an object/);
  assert.throws(() => Script.buildScriptPrompts({ ...base, misconceptions: [{ wrongTurn: 'x', why: 'y' }] }),
    /buildScriptPrompts: opts\.misconceptions\[0\]\.correctTurn must be a non-empty string/);
  assert.throws(() => Script.buildScriptPrompts({ ...base, workedExample: 42 }),
    /buildScriptPrompts: opts\.workedExample must be a non-empty string/);
});

test('unknown level falls back like buildWorksheetPrompts', () => {
  const out = Script.buildScriptPrompts({
    level: 'kindergarten', subject: 'science', topic: 'water-cycle',
    transitions: WATER_CYCLE_TRANSITIONS
  });
  assert.ok(out.user.includes('Level: kindergarten (kindergarten)'));
  assert.ok(out.system.includes('direct, precise, exam-aware'));
  assert.ok(out.system.includes('segments cover transitions in order'));
});

/* (d) The trimmed exemplar */

test('exemplar parses back to a valid script addressing the misconception', () => {
  const reversed = Script.WATER_CYCLE_SCRIPT_EXEMPLAR.split('} }').join('}}');
  const script = JSON.parse(reversed);
  assert.deepEqual(validateScript(script), []);
  assert.equal(script.level, 'primary');
  assert.equal(script.subject, 'science');
  assert.equal(script.topic, 'water-cycle');
  const total = script.segments.reduce((sum, s) => sum + s.minutes, 0);
  assert.ok(total >= 5 && total <= 120, 'exemplar minutes sum inside 5-120');
  const text = JSON.stringify(script).toLowerCase();
  assert.ok(text.includes('disappear'), 'exemplar addresses the evaporation-disappears misconception');
  assert.ok(script.segments.some((s) => s.watchFor && s.watchFor.includes(BANK_BEAT.wrongTurn)),
    'exemplar watchFor names the bank misconception');
});

test('template exports are strings and the builder source is ASCII-only', () => {
  assert.equal(typeof Script.SCRIPT_SYSTEM_TEMPLATE, 'string');
  assert.ok(Script.SCRIPT_SYSTEM_TEMPLATE.includes('WORKED EXAMPLE - hand-authored water-cycle script, trimmed'));
  assert.ok(Script.SCRIPT_SYSTEM_TEMPLATE.endsWith(Script.WATER_CYCLE_SCRIPT_EXEMPLAR));
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_script_prompt.js'), 'utf8');
  assert.ok(!/[^\x00-\x7F]/.test(src), 'builder source must be ASCII-only');
});

test('d.ts export names match the runtime exports', () => {
  const dts = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_script_prompt.d.ts'), 'utf8');
  for (const name of ['buildScriptPrompts', 'SCRIPT_SYSTEM_TEMPLATE', 'WATER_CYCLE_SCRIPT_EXEMPLAR']) {
    assert.ok(dts.includes(name), 'd.ts must declare ' + name);
    assert.ok(name in Script, 'runtime must export ' + name);
  }
});
