/* Tests for validateNotes and validateScript (SPEC.md
 * "Student notes spec" / "Teacher script spec", issue #762). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateNotes, validateScript } = require('../player/validate.js');

function validNotes() {
  return {
    title: 'Water Cycle Notes',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    objectives: ['Describe evaporation', 'Describe condensation'],
    definitions: [
      { term: 'Evaporation', meaning: 'Liquid water turns into vapour.' },
      { term: 'Condensation', meaning: 'Vapour cools and turns back into liquid.' }
    ],
    mechanismSteps: ['Sun heats water', 'Vapour rises and cools', 'Droplets form clouds'],
    workedExample: 'A puddle dries because the water evaporates into the air.',
    trap: {
      misconception: 'Steam is smoke',
      explanation: 'The white cloud is tiny liquid droplets formed by condensation.'
    }
  };
}

function segment(minutes, extra) {
  const seg = { minutes, say: 'Explain the next step.' };
  if (extra) Object.assign(seg, extra);
  return seg;
}

function validScript() {
  return {
    title: 'Water Cycle Teacher Script',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    segments: [
      segment(5, { cue: 'Show the animation', questions: ['What do you see?'], watchFor: 'Students confusing steam with smoke' }),
      segment(10)
    ]
  };
}

function hasError(errors, substr) {
  return errors.some((e) => e.includes(substr));
}

test('valid notes passes with a non-syllabus subject', () => {
  const notes = validNotes(); notes.subject = 'history';
  assert.deepEqual(validateNotes(notes), []);
});

test('valid notes passes', () => {
  assert.deepEqual(validateNotes(validNotes()), []);
});

test('valid script passes with optional cue/questions/watchFor present', () => {
  assert.deepEqual(validateScript(validScript()), []);
});

test('valid script passes with optional fields absent', () => {
  const script = validScript();
  script.segments = [segment(10), segment(10)];
  assert.deepEqual(validateScript(script), []);
});

test('valid script passes with total exactly 5 minutes', () => {
  const script = validScript(); script.segments = [segment(5)];
  assert.deepEqual(validateScript(script), []);
});

test('valid script passes with total exactly 120 minutes', () => {
  const script = validScript(); script.segments = [segment(60), segment(60)];
  assert.deepEqual(validateScript(script), []);
});

test('non-object spec returns exactly the spec error for both validators', () => {
  for (const bad of [null, undefined, 'notes', 42, true]) {
    assert.deepEqual(validateNotes(bad), ['spec: must be an object']);
    assert.deepEqual(validateScript(bad), ['spec: must be an object']);
  }
});

test('notes: missing or blank header fields are rejected', () => {
  const a = validNotes(); delete a.title;
  assert.ok(hasError(validateNotes(a), 'title: required non-empty string'));
  const b = validNotes(); b.title = '   ';
  assert.ok(hasError(validateNotes(b), 'title: required non-empty string'));
  const c = validNotes(); c.level = 'kindergarten';
  assert.ok(hasError(validateNotes(c), 'level: must be primary|secondary|jc'));
  const d = validNotes(); delete d.level;
  assert.ok(hasError(validateNotes(d), 'level: must be primary|secondary|jc'));
  const e = validNotes(); e.subject = '';
  assert.ok(hasError(validateNotes(e), 'subject: required non-empty string'));
  const f = validNotes(); f.subject = 7;
  assert.ok(hasError(validateNotes(f), 'subject: required non-empty string'));
  const g = validNotes(); g.topic = '  ';
  assert.ok(hasError(validateNotes(g), 'topic: required non-empty string'));
  const h = validNotes(); delete h.topic;
  assert.ok(hasError(validateNotes(h), 'topic: required non-empty string'));
});

test('script: missing or blank header fields are rejected', () => {
  const a = validScript(); delete a.title;
  assert.ok(hasError(validateScript(a), 'title: required non-empty string'));
  const b = validScript(); b.level = 'kindergarten';
  assert.ok(hasError(validateScript(b), 'level: must be primary|secondary|jc'));
  const c = validScript(); c.subject = '';
  assert.ok(hasError(validateScript(c), 'subject: required non-empty string'));
  const d = validScript(); d.topic = ' ';
  assert.ok(hasError(validateScript(d), 'topic: required non-empty string'));
});

test('notes: objectives missing, non-array, or empty is rejected', () => {
  const a = validNotes(); delete a.objectives;
  assert.ok(hasError(validateNotes(a), 'objectives: required non-empty array'));
  const b = validNotes(); b.objectives = 'nope';
  assert.ok(hasError(validateNotes(b), 'objectives: required non-empty array'));
  const c = validNotes(); c.objectives = [];
  assert.ok(hasError(validateNotes(c), 'objectives: required non-empty array'));
});

test('notes: empty objective entry is rejected', () => {
  const a = validNotes(); a.objectives = ['Valid', '  '];
  assert.ok(hasError(validateNotes(a), 'objectives[1]: required non-empty string'));
  const b = validNotes(); b.objectives = [42];
  assert.ok(hasError(validateNotes(b), 'objectives[0]: required non-empty string'));
});

test('notes: definitions missing, non-array, or empty is rejected', () => {
  const a = validNotes(); delete a.definitions;
  assert.ok(hasError(validateNotes(a), 'definitions: required array of at least 1 definition'));
  const b = validNotes(); b.definitions = 'nope';
  assert.ok(hasError(validateNotes(b), 'definitions: required array of at least 1 definition'));
  const c = validNotes(); c.definitions = [];
  assert.ok(hasError(validateNotes(c), 'definitions: required array of at least 1 definition'));
});

test('notes: non-object definition entry is rejected', () => {
  const a = validNotes(); a.definitions = ['oops'];
  assert.ok(hasError(validateNotes(a), 'definitions[0]: must be an object'));
  const b = validNotes(); b.definitions = [null];
  assert.ok(hasError(validateNotes(b), 'definitions[0]: must be an object'));
});

test('notes: definition missing or blank term/meaning is rejected', () => {
  const a = validNotes(); delete a.definitions[0].term;
  assert.ok(hasError(validateNotes(a), 'definitions[0].term: required non-empty string'));
  const b = validNotes(); b.definitions[0].term = '  ';
  assert.ok(hasError(validateNotes(b), 'definitions[0].term: required non-empty string'));
  const c = validNotes(); delete c.definitions[1].meaning;
  assert.ok(hasError(validateNotes(c), 'definitions[1].meaning: required non-empty string'));
  const d = validNotes(); d.definitions[1].meaning = '';
  assert.ok(hasError(validateNotes(d), 'definitions[1].meaning: required non-empty string'));
});

test('notes: mechanismSteps missing, non-array, or empty is rejected', () => {
  const a = validNotes(); delete a.mechanismSteps;
  assert.ok(hasError(validateNotes(a), 'mechanismSteps: required non-empty array'));
  const b = validNotes(); b.mechanismSteps = 'nope';
  assert.ok(hasError(validateNotes(b), 'mechanismSteps: required non-empty array'));
  const c = validNotes(); c.mechanismSteps = [];
  assert.ok(hasError(validateNotes(c), 'mechanismSteps: required non-empty array'));
});

test('notes: empty mechanism step entry is rejected', () => {
  const a = validNotes(); a.mechanismSteps = ['Valid', ''];
  assert.ok(hasError(validateNotes(a), 'mechanismSteps[1]: required non-empty string'));
  const b = validNotes(); b.mechanismSteps = [null];
  assert.ok(hasError(validateNotes(b), 'mechanismSteps[0]: required non-empty string'));
});

test('notes: missing or blank workedExample is rejected', () => {
  const a = validNotes(); delete a.workedExample;
  assert.ok(hasError(validateNotes(a), 'workedExample: required non-empty string'));
  const b = validNotes(); b.workedExample = '   ';
  assert.ok(hasError(validateNotes(b), 'workedExample: required non-empty string'));
});

test('notes: missing or non-object trap is rejected', () => {
  const a = validNotes(); delete a.trap;
  assert.ok(hasError(validateNotes(a), 'trap: required object'));
  const b = validNotes(); b.trap = 'nope';
  assert.ok(hasError(validateNotes(b), 'trap: required object'));
  const c = validNotes(); c.trap = null;
  assert.ok(hasError(validateNotes(c), 'trap: required object'));
});

test('notes: trap without misconception or with blank explanation is rejected', () => {
  const a = validNotes(); delete a.trap.misconception;
  assert.ok(hasError(validateNotes(a), 'trap.misconception: required non-empty string'));
  const b = validNotes(); b.trap.misconception = ' ';
  assert.ok(hasError(validateNotes(b), 'trap.misconception: required non-empty string'));
  const c = validNotes(); c.trap.explanation = '  ';
  assert.ok(hasError(validateNotes(c), 'trap.explanation: required non-empty string'));
  const d = validNotes(); delete d.trap.explanation;
  assert.ok(hasError(validateNotes(d), 'trap.explanation: required non-empty string'));
});

test('script: segments missing, non-array, or empty is rejected', () => {
  const a = validScript(); delete a.segments;
  assert.ok(hasError(validateScript(a), 'segments: required non-empty array'));
  const b = validScript(); b.segments = 'nope';
  assert.ok(hasError(validateScript(b), 'segments: required non-empty array'));
  const c = validScript(); c.segments = [];
  assert.ok(hasError(validateScript(c), 'segments: required non-empty array'));
});

test('script: non-object segment is rejected and total is not evaluated', () => {
  const a = validScript(); a.segments = ['oops'];
  const errors = validateScript(a);
  assert.ok(hasError(errors, 'segments[0]: must be an object'));
  assert.ok(!hasError(errors, 'segments: total timing must be 5..120 minutes'));
  const b = validScript(); b.segments = [null];
  assert.ok(hasError(validateScript(b), 'segments[0]: must be an object'));
});

test('script: missing, zero, negative, or non-numeric minutes is rejected', () => {
  const a = validScript(); delete a.segments[0].minutes;
  assert.ok(hasError(validateScript(a), 'segments[0].minutes: required positive number'));
  const b = validScript(); b.segments[0].minutes = 0;
  assert.ok(hasError(validateScript(b), 'segments[0].minutes: required positive number'));
  const c = validScript(); c.segments[0].minutes = -3;
  assert.ok(hasError(validateScript(c), 'segments[0].minutes: required positive number'));
  const d = validScript(); d.segments[0].minutes = 'ten';
  assert.ok(hasError(validateScript(d), 'segments[0].minutes: required positive number'));
});

test('script: invalid minutes suppresses the total timing check', () => {
  const script = validScript(); script.segments = [segment(0), segment(1)];
  const errors = validateScript(script);
  assert.ok(hasError(errors, 'segments[0].minutes: required positive number'));
  assert.ok(!hasError(errors, 'segments: total timing must be 5..120 minutes'));
});

test('script: missing or blank say is rejected', () => {
  const a = validScript(); delete a.segments[0].say;
  assert.ok(hasError(validateScript(a), 'segments[0].say: required non-empty string'));
  const b = validScript(); b.segments[1].say = '  ';
  assert.ok(hasError(validateScript(b), 'segments[1].say: required non-empty string'));
});

test('script: invalid present cue or watchFor is rejected', () => {
  const a = validScript(); a.segments[0].cue = '';
  assert.ok(hasError(validateScript(a), 'segments[0].cue: must be a non-empty string when present'));
  const b = validScript(); b.segments[0].cue = 42;
  assert.ok(hasError(validateScript(b), 'segments[0].cue: must be a non-empty string when present'));
  const c = validScript(); c.segments[0].watchFor = ' ';
  assert.ok(hasError(validateScript(c), 'segments[0].watchFor: must be a non-empty string when present'));
  const d = validScript(); d.segments[0].watchFor = null;
  assert.ok(hasError(validateScript(d), 'segments[0].watchFor: must be a non-empty string when present'));
});

test('script: non-array questions and empty question entry are rejected', () => {
  const a = validScript(); a.segments[0].questions = 'nope';
  assert.ok(hasError(validateScript(a), 'segments[0].questions: must be an array when present'));
  const b = validScript(); b.segments[0].questions = ['Valid?', ' '];
  assert.ok(hasError(validateScript(b), 'segments[0].questions[1]: required non-empty string'));
  const c = validScript(); c.segments[0].questions = [42];
  assert.ok(hasError(validateScript(c), 'segments[0].questions[0]: required non-empty string'));
});

test('script: empty questions array is accepted when present', () => {
  const script = validScript(); script.segments = [segment(10, { questions: [] })];
  assert.deepEqual(validateScript(script), []);
});

test('script: total of 4 minutes is rejected', () => {
  const script = validScript(); script.segments = [segment(4)];
  assert.ok(hasError(validateScript(script), 'segments: total timing must be 5..120 minutes'));
});

test('script: total of 121 minutes is rejected', () => {
  const script = validScript(); script.segments = [segment(60), segment(61)];
  assert.ok(hasError(validateScript(script), 'segments: total timing must be 5..120 minutes'));
});
