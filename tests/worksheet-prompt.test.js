/* animath worksheet-prompt tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards Materials Phase 2b (issue #756): the hand-authored gold worksheet
 * (samples/worksheets/primary-science-water-cycle.json), the worksheet
 * prompt builder (generator/build_worksheet_prompt.js), its
 * WORKSHEET_SYSTEM_TEMPLATE rules, and the trimmed
 * WATER_CYCLE_WORKSHEET_EXEMPLAR embedded in it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Worksheet = require('../generator/build_worksheet_prompt.js');
const { validateWorksheet } = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'worksheets', 'primary-science-water-cycle.json');
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

/* (a) The gold worksheet */

test('gold worksheet loads and validateWorksheet returns no errors', () => {
  assert.equal(gold.title, 'The Water Cycle');
  assert.equal(gold.level, 'primary');
  assert.equal(gold.subject, 'science');
  assert.equal(gold.topic, 'water-cycle');
  assert.deepEqual(validateWorksheet(gold), []);
});

test('gold worksheet mixes multiple-choice and short-answer questions', () => {
  assert.ok(gold.questions.length >= 1, 'worksheet has at least 1 question');
  const kinds = new Set(gold.questions.map((q) => q.kind));
  assert.ok(kinds.has('multiple-choice'), 'has a multiple-choice question');
  assert.ok(kinds.has('short-answer'), 'has a short-answer question');
  for (const q of gold.questions) {
    assert.ok(typeof q.explanation === 'string' && q.explanation.trim(),
      q.id + ' carries an answer-key explanation');
    if (q.kind === 'multiple-choice') {
      assert.ok(q.choices.length >= 2, q.id + ' has at least 2 choices');
      assert.equal(q.choices.filter((c) => c.correct === true).length, 1,
        q.id + ' has exactly one correct choice');
    } else {
      assert.ok(typeof q.answer === 'string' && q.answer.trim(), q.id + ' has an answer');
    }
  }
});

test('gold worksheet has an MC question whose distractors encode the evaporation misconception', () => {
  const trap = gold.questions.find((q) => q.kind === 'multiple-choice' &&
    q.choices.some((c) => c.correct !== true && /disappear/i.test(c.text)));
  assert.ok(trap, 'a multiple-choice question carries a disappears-for-good distractor');
  assert.equal(trap.misconception, BANK_BEAT.wrongTurn,
    'the question misconception field names the bank beat');
  assert.ok(trap.explanation.includes(BANK_BEAT.wrongTurn),
    'the explanation names the misconception');
  assert.ok(/disappear/i.test(trap.explanation),
    'the explanation addresses the disappears wrong turn');
});

/* (b) buildWorksheetPrompts with full water-cycle inputs */

test('built system prompt carries the worksheet rules and quality gates', () => {
  const { system } = Worksheet.buildWorksheetPrompts(fullOpts());
  for (const phrase of [
    'Return ONLY the worksheet JSON',
    'title, level, subject, topic, questions',
    'multiple-choice|short-answer',
    'at least 2 choices',
    'exactly one',
    'correct: true',
    'short-answer question requires',
    'Distractors are built from the named misconception',
    'answer key is a per-question explanation on every question',
    'names the',
    'misconception each wrong option encodes',
    'misconception field wherever the question targets a misconception',
    'QUALITY GATES',
    'at least one question per transition',
    Worksheet.WATER_CYCLE_WORKSHEET_EXEMPLAR
  ]) {
    assert.ok(system.includes(phrase), 'system prompt must contain: ' + phrase);
  }
});

test('built user prompt carries transitions in order, beats and the worked example', () => {
  const { user } = Worksheet.buildWorksheetPrompts(fullOpts());
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
  assert.ok(user.includes('Worksheet misconception'),
    'user prompt must head the misconception beat with the worksheet heading');
  assert.ok(user.includes(BANK_BEAT.wrongTurn), 'user prompt must print the bank misconception beat');
  assert.ok(user.includes(CUSTOM_BEAT.wrongTurn), 'user prompt must print the supplied misconception beat');
  assert.ok(user.includes(WORKED_EXAMPLE), 'user prompt must render the worked example verbatim');
});

test('no unfilled placeholder survives buildWorksheetPrompts', () => {
  const { system, user } = Worksheet.buildWorksheetPrompts(fullOpts());
  assert.ok(!system.includes('{{'), 'system must have no {{ }} placeholder left');
  assert.ok(!user.includes('{{'), 'user must have no {{ }} placeholder left');
});

/* (c) Degenerate inputs */

test('no transitions, misconceptions or worked example still yields a coherent prompt', () => {
  const out = Worksheet.buildWorksheetPrompts({ subject: 'history', topic: 'fall-of-singapore' });
  assert.ok(out.system.includes('Primary school (PSLE)'), 'default level is primary');
  assert.ok(out.system.includes('Return ONLY the worksheet JSON'));
  assert.ok(!out.system.includes('TRANSITION QUESTIONS'),
    'no transition block is appended without transitions');
  assert.ok(out.user.includes('Address exactly one common misconception for the topic'),
    'unknown topic falls back to the generic misconception line');
  assert.ok(!out.user.includes('Worked example for this topic'),
    'no worked-example block without one supplied');
  assert.ok(!out.system.includes('{{') && !out.user.includes('{{'));
});

test('empty transitions and null misconceptions behave like absent ones', () => {
  const out = Worksheet.buildWorksheetPrompts({
    subject: 'science', topic: 'water-cycle', transitions: [], misconceptions: null
  });
  assert.ok(!out.system.includes('TRANSITION QUESTIONS'));
  assert.ok(out.user.includes(BANK_BEAT.wrongTurn), 'bank beat still resolves for water-cycle');
  const outNull = Worksheet.buildWorksheetPrompts({
    subject: 'science', topic: 'water-cycle', transitions: null, workedExample: null
  });
  assert.ok(!outNull.system.includes('TRANSITION QUESTIONS'));
  assert.ok(!outNull.user.includes('Worked example for this topic'));
});

test('missing subject throws the documented error', () => {
  assert.throws(() => Worksheet.buildWorksheetPrompts({ topic: 'water-cycle' }),
    /buildWorksheetPrompts: subject is required/);
  assert.throws(() => Worksheet.buildWorksheetPrompts(),
    /buildWorksheetPrompts: subject is required/);
});

test('malformed transitions throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, transitions: 'evaporation' }),
    /buildWorksheetPrompts: opts\.transitions must be an array/);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, transitions: [WATER_CYCLE_TRANSITIONS[0]] }),
    /buildWorksheetPrompts: opts\.transitions must hold 2-8 transitions, got 1/);
  const nine = WATER_CYCLE_TRANSITIONS.concat(WATER_CYCLE_TRANSITIONS).concat([WATER_CYCLE_TRANSITIONS[0]]);
  assert.equal(nine.length, 9);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, transitions: nine }),
    /buildWorksheetPrompts: opts\.transitions must hold 2-8 transitions, got 9/);
  const missingField = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour' },
    WATER_CYCLE_TRANSITIONS[1]
  ];
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, transitions: missingField }),
    /buildWorksheetPrompts: opts\.transitions\[0\]\.driver must be a non-empty string/);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, transitions: ['nope', WATER_CYCLE_TRANSITIONS[1]] }),
    /buildWorksheetPrompts: opts\.transitions\[0\] must be an object/);
});

test('malformed misconceptions and worked example throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, misconceptions: 'a beat' }),
    /buildWorksheetPrompts: opts\.misconceptions must be an array/);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, misconceptions: [42] }),
    /buildWorksheetPrompts: opts\.misconceptions\[0\] must be an object/);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, misconceptions: [{ wrongTurn: 'x', why: 'y' }] }),
    /buildWorksheetPrompts: opts\.misconceptions\[0\]\.correctTurn must be a non-empty string/);
  assert.throws(() => Worksheet.buildWorksheetPrompts({ ...base, workedExample: 42 }),
    /buildWorksheetPrompts: opts\.workedExample must be a non-empty string/);
});

test('unknown level falls back like buildSlidePrompts', () => {
  const out = Worksheet.buildWorksheetPrompts({
    level: 'kindergarten', subject: 'science', topic: 'water-cycle',
    transitions: WATER_CYCLE_TRANSITIONS
  });
  assert.ok(out.user.includes('Level: kindergarten (kindergarten)'),
    'unknown level label falls back to the level string itself');
  assert.ok(out.system.includes('direct, precise, exam-aware'),
    'unknown level tone falls back to the secondary tone');
  assert.ok(out.system.includes('at least one question per transition'),
    'transitions still append the transition block');
});

/* (d) The trimmed exemplar */

test('exemplar parses back to a valid worksheet addressing the misconception', () => {
  const reversed = Worksheet.WATER_CYCLE_WORKSHEET_EXEMPLAR.split('} }').join('}}');
  const ws = JSON.parse(reversed);
  assert.deepEqual(validateWorksheet(ws), []);
  assert.equal(ws.level, 'primary');
  assert.equal(ws.subject, 'science');
  assert.equal(ws.topic, 'water-cycle');
  assert.ok(ws.questions.length >= 1, 'exemplar has at least 1 question');
  const text = JSON.stringify(ws).toLowerCase();
  assert.ok(text.includes('disappear'), 'exemplar addresses the evaporation-disappears misconception');
  for (const q of ws.questions) {
    assert.ok(typeof q.explanation === 'string' && q.explanation.trim(),
      q.id + ' exemplar question carries an explanation');
  }
});

test('template exports are strings and the builder source is ASCII-only', () => {
  assert.equal(typeof Worksheet.WORKSHEET_SYSTEM_TEMPLATE, 'string');
  assert.ok(Worksheet.WORKSHEET_SYSTEM_TEMPLATE.includes('WORKED EXAMPLE - hand-authored water-cycle worksheet, trimmed'),
    'template embeds the exemplar under the worked-example header');
  assert.ok(Worksheet.WORKSHEET_SYSTEM_TEMPLATE.endsWith(Worksheet.WATER_CYCLE_WORKSHEET_EXEMPLAR),
    'exemplar sits at the end of the system template');
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_worksheet_prompt.js'), 'utf8');
  assert.ok(!/[^\x00-\x7F]/.test(src), 'builder source must be ASCII-only');
});

test('d.ts export names match the runtime exports', () => {
  const dts = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_worksheet_prompt.d.ts'), 'utf8');
  for (const name of ['buildWorksheetPrompts', 'WORKSHEET_SYSTEM_TEMPLATE', 'WATER_CYCLE_WORKSHEET_EXEMPLAR']) {
    assert.ok(dts.includes(name), 'd.ts must declare ' + name);
    assert.ok(name in Worksheet, 'runtime must export ' + name);
  }
});
