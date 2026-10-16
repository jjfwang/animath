/* animath notes-prompt tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards Materials Phase 3b (issue #764): the hand-authored gold notes
 * (samples/notes/primary-science-water-cycle.json), the notes
 * prompt builder (generator/build_notes_prompt.js), its
 * NOTES_SYSTEM_TEMPLATE rules, and the trimmed
 * WATER_CYCLE_NOTES_EXEMPLAR embedded in it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Notes = require('../generator/build_notes_prompt.js');
const { validateNotes } = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'notes', 'primary-science-water-cycle.json');
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

/* (a) The gold notes */

test('gold notes load and validateNotes returns no errors', () => {
  assert.equal(gold.title, 'The Water Cycle');
  assert.equal(gold.level, 'primary');
  assert.equal(gold.subject, 'science');
  assert.equal(gold.topic, 'water-cycle');
  assert.deepEqual(validateNotes(gold), []);
});

test('gold notes carry definitions, mechanism steps, worked example and trap', () => {
  assert.ok(gold.objectives.length >= 1);
  const terms = gold.definitions.map((d) => d.term.toLowerCase());
  for (const vocab of ['evaporation', 'condensation', 'precipitation', 'collection']) {
    assert.ok(terms.some((t) => t.includes(vocab)), 'definitions cover ' + vocab);
  }
  for (const d of gold.definitions) {
    assert.ok(d.meaning && d.meaning.trim(), d.term + ' has a meaning');
  }
  assert.equal(gold.mechanismSteps.length, 4, 'one mechanism step per stage');
  assert.ok(gold.workedExample.trim(), 'worked example present');
  assert.equal(gold.trap.misconception, BANK_BEAT.wrongTurn,
    'trap misconception is exactly the bank wrongTurn');
  assert.ok(gold.trap.explanation.trim(), 'trap explanation present');
});

/* (b) buildNotesPrompts with full water-cycle inputs */

test('built system prompt carries the notes rules and quality gates', () => {
  const { system } = Notes.buildNotesPrompts(fullOpts());
  for (const phrase of [
    'Return ONLY the notes JSON',
    'title, level, subject, topic, objectives, definitions, mechanismSteps, workedExample, trap',
    '{term, meaning}',
    '{misconception, explanation}',
    'Student-facing one-page tone',
    'No teacher-only language',
    'QUALITY GATES',
    'exactly one mechanismStep per transition',
    Notes.WATER_CYCLE_NOTES_EXEMPLAR
  ]) {
    assert.ok(system.includes(phrase), 'system prompt must contain: ' + phrase);
  }
});

test('built user prompt carries transitions in order, beats and the worked example', () => {
  const { user } = Notes.buildNotesPrompts(fullOpts());
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
  assert.ok(user.includes('Notes misconception'));
  assert.ok(user.includes(BANK_BEAT.wrongTurn));
  assert.ok(user.includes(CUSTOM_BEAT.wrongTurn));
  assert.ok(user.includes(WORKED_EXAMPLE));
});

test('no unfilled placeholder survives buildNotesPrompts', () => {
  const { system, user } = Notes.buildNotesPrompts(fullOpts());
  assert.ok(!system.includes('{{'));
  assert.ok(!user.includes('{{'));
});

/* (c) Degenerate inputs */

test('no transitions, misconceptions or worked example still yields a coherent prompt', () => {
  const out = Notes.buildNotesPrompts({ subject: 'history', topic: 'fall-of-singapore' });
  assert.ok(out.system.includes('Primary school (PSLE)'));
  assert.ok(out.system.includes('Return ONLY the notes JSON'));
  assert.ok(!out.system.includes('TRANSITION STEPS'));
  assert.ok(out.user.includes('Address exactly one common misconception for the topic'));
  assert.ok(!out.user.includes('Worked example for this topic'));
  assert.ok(!out.system.includes('{{') && !out.user.includes('{{'));
});

test('empty transitions and null misconceptions behave like absent ones', () => {
  const out = Notes.buildNotesPrompts({
    subject: 'science', topic: 'water-cycle', transitions: [], misconceptions: null
  });
  assert.ok(!out.system.includes('TRANSITION STEPS'));
  assert.ok(out.user.includes(BANK_BEAT.wrongTurn));
  const outNull = Notes.buildNotesPrompts({
    subject: 'science', topic: 'water-cycle', transitions: null, workedExample: null
  });
  assert.ok(!outNull.system.includes('TRANSITION STEPS'));
  assert.ok(!outNull.user.includes('Worked example for this topic'));
});

test('missing subject throws the documented error', () => {
  assert.throws(() => Notes.buildNotesPrompts({ topic: 'water-cycle' }),
    /buildNotesPrompts: subject is required/);
  assert.throws(() => Notes.buildNotesPrompts(),
    /buildNotesPrompts: subject is required/);
  assert.throws(() => Notes.buildNotesPrompts({ subject: '' }),
    /buildNotesPrompts: subject is required/);
});

test('malformed transitions throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Notes.buildNotesPrompts({ ...base, transitions: 'evaporation' }),
    /buildNotesPrompts: opts\.transitions must be an array/);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, transitions: [WATER_CYCLE_TRANSITIONS[0]] }),
    /buildNotesPrompts: opts\.transitions must hold 2-8 transitions, got 1/);
  const nine = WATER_CYCLE_TRANSITIONS.concat(WATER_CYCLE_TRANSITIONS).concat([WATER_CYCLE_TRANSITIONS[0]]);
  assert.equal(nine.length, 9);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, transitions: nine }),
    /buildNotesPrompts: opts\.transitions must hold 2-8 transitions, got 9/);
  const missingField = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour' },
    WATER_CYCLE_TRANSITIONS[1]
  ];
  assert.throws(() => Notes.buildNotesPrompts({ ...base, transitions: missingField }),
    /buildNotesPrompts: opts\.transitions\[0\]\.driver must be a non-empty string/);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, transitions: ['nope', WATER_CYCLE_TRANSITIONS[1]] }),
    /buildNotesPrompts: opts\.transitions\[0\] must be an object/);
});

test('malformed misconceptions and worked example throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Notes.buildNotesPrompts({ ...base, misconceptions: 'a beat' }),
    /buildNotesPrompts: opts\.misconceptions must be an array/);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, misconceptions: [42] }),
    /buildNotesPrompts: opts\.misconceptions\[0\] must be an object/);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, misconceptions: [{ wrongTurn: 'x', why: 'y' }] }),
    /buildNotesPrompts: opts\.misconceptions\[0\]\.correctTurn must be a non-empty string/);
  assert.throws(() => Notes.buildNotesPrompts({ ...base, workedExample: 42 }),
    /buildNotesPrompts: opts\.workedExample must be a non-empty string/);
});

test('unknown level falls back like buildWorksheetPrompts', () => {
  const out = Notes.buildNotesPrompts({
    level: 'kindergarten', subject: 'science', topic: 'water-cycle',
    transitions: WATER_CYCLE_TRANSITIONS
  });
  assert.ok(out.user.includes('Level: kindergarten (kindergarten)'));
  assert.ok(out.system.includes('direct, precise, exam-aware'));
  assert.ok(out.system.includes('exactly one mechanismStep per transition'));
});

/* (d) The trimmed exemplar */

test('exemplar parses back to valid notes addressing the misconception', () => {
  const reversed = Notes.WATER_CYCLE_NOTES_EXEMPLAR.split('} }').join('}}');
  const notes = JSON.parse(reversed);
  assert.deepEqual(validateNotes(notes), []);
  assert.equal(notes.level, 'primary');
  assert.equal(notes.subject, 'science');
  assert.equal(notes.topic, 'water-cycle');
  assert.equal(notes.mechanismSteps.length, 4, 'exemplar has one step per transition');
  assert.equal(notes.trap.misconception, BANK_BEAT.wrongTurn);
  const text = JSON.stringify(notes).toLowerCase();
  assert.ok(text.includes('disappear'));
});

test('template exports are strings and the builder source is ASCII-only', () => {
  assert.equal(typeof Notes.NOTES_SYSTEM_TEMPLATE, 'string');
  assert.ok(Notes.NOTES_SYSTEM_TEMPLATE.includes('WORKED EXAMPLE - hand-authored water-cycle notes, trimmed'));
  assert.ok(Notes.NOTES_SYSTEM_TEMPLATE.endsWith(Notes.WATER_CYCLE_NOTES_EXEMPLAR));
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_notes_prompt.js'), 'utf8');
  assert.ok(!/[^\x00-\x7F]/.test(src), 'builder source must be ASCII-only');
});

test('d.ts export names match the runtime exports', () => {
  const dts = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_notes_prompt.d.ts'), 'utf8');
  for (const name of ['buildNotesPrompts', 'NOTES_SYSTEM_TEMPLATE', 'WATER_CYCLE_NOTES_EXEMPLAR']) {
    assert.ok(dts.includes(name), 'd.ts must declare ' + name);
    assert.ok(name in Notes, 'runtime must export ' + name);
  }
});
