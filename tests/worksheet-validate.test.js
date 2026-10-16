/* Tests for validateWorksheet and validateExitTicket (SPEC.md
 * "Worksheet spec" / "Exit ticket spec" / "Question", issue #754). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateWorksheet, validateExitTicket } = require('../player/validate.js');

function mcQuestion(id) {
  return {
    id,
    prompt: 'What is 1/2 + 1/4?',
    kind: 'multiple-choice',
    choices: [
      { text: '1/6' },
      { text: '3/4', correct: true },
      { text: '2/6', correct: false }
    ],
    explanation: 'Convert to quarters: 2/4 + 1/4 = 3/4.',
    misconception: 'adding numerators and denominators directly'
  };
}

function saQuestion(id) {
  return {
    id,
    prompt: 'Name the process that turns liquid water into vapour.',
    kind: 'short-answer',
    answer: 'Evaporation',
    feedback: 'Correct naming of the process shows the state change was understood.',
    misconception: 'confusing evaporation with boiling'
  };
}

function validWorksheet() {
  return {
    title: 'Fractions Practice',
    level: 'primary',
    subject: 'math',
    topic: 'fractions',
    questions: [mcQuestion('q1'), saQuestion('q2')]
  };
}

function validExitTicket() {
  return {
    title: 'Water Cycle Exit Ticket',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    questions: [saQuestion('q1'), mcQuestion('q2'), saQuestion('q3')]
  };
}

function hasError(errors, substr) {
  return errors.some((e) => e.includes(substr));
}

test('valid worksheet passes: MC + short-answer mix, answer key with misconception', () => {
  assert.deepEqual(validateWorksheet(validWorksheet()), []);
});

test('valid worksheet passes with exactly 1 question (lower boundary)', () => {
  const ws = validWorksheet(); ws.questions = [mcQuestion('q1')];
  assert.deepEqual(validateWorksheet(ws), []);
});

test('valid exit ticket passes: 3 questions, per-answer feedback keyed to misconceptions', () => {
  assert.deepEqual(validateExitTicket(validExitTicket()), []);
});

test('valid exit ticket passes with 5 questions (upper boundary) and a non-syllabus subject', () => {
  const ticket = validExitTicket();
  ticket.subject = 'history';
  ticket.questions = [saQuestion('q1'), mcQuestion('q2'), saQuestion('q3'), mcQuestion('q4'), saQuestion('q5')];
  assert.deepEqual(validateExitTicket(ticket), []);
});

test('non-object spec returns exactly the spec error for both validators', () => {
  for (const bad of [null, undefined, 'worksheet', 42, true]) {
    assert.deepEqual(validateWorksheet(bad), ['spec: must be an object']);
    assert.deepEqual(validateExitTicket(bad), ['spec: must be an object']);
  }
});

test('missing or blank title is rejected by both validators', () => {
  const a = validWorksheet(); delete a.title;
  assert.ok(hasError(validateWorksheet(a), 'title: required non-empty string'));
  const b = validExitTicket(); b.title = '   ';
  assert.ok(hasError(validateExitTicket(b), 'title: required non-empty string'));
});

test('bad level is rejected', () => {
  const ws = validWorksheet(); ws.level = 'kindergarten';
  assert.ok(hasError(validateWorksheet(ws), 'level: must be primary|secondary|jc'));
});

test('empty or non-string subject is rejected', () => {
  const a = validWorksheet(); a.subject = '';
  assert.ok(hasError(validateWorksheet(a), 'subject: required non-empty string'));
  const b = validExitTicket(); b.subject = 7;
  assert.ok(hasError(validateExitTicket(b), 'subject: required non-empty string'));
});

test('blank topic is rejected', () => {
  const ticket = validExitTicket(); ticket.topic = '  ';
  assert.ok(hasError(validateExitTicket(ticket), 'topic: required non-empty string'));
});

test('worksheet questions missing, non-array, or empty is rejected', () => {
  const a = validWorksheet(); delete a.questions;
  assert.ok(hasError(validateWorksheet(a), 'questions: required array of 1 or more questions'));
  const b = validWorksheet(); b.questions = 'nope';
  assert.ok(hasError(validateWorksheet(b), 'questions: required array of 1 or more questions'));
  const c = validWorksheet(); c.questions = [];
  assert.ok(hasError(validateWorksheet(c), 'questions: required array of 1 or more questions'));
});

test('exit ticket with 2 or 6 questions is rejected', () => {
  const a = validExitTicket(); a.questions = a.questions.slice(0, 2);
  assert.ok(hasError(validateExitTicket(a), 'questions: required array of 3..5 questions'));
  const b = validExitTicket();
  b.questions = [saQuestion('q1'), mcQuestion('q2'), saQuestion('q3'), mcQuestion('q4'), saQuestion('q5'), mcQuestion('q6')];
  assert.ok(hasError(validateExitTicket(b), 'questions: required array of 3..5 questions'));
});

test('non-object question is rejected', () => {
  const ws = validWorksheet(); ws.questions[0] = 'oops';
  assert.ok(hasError(validateWorksheet(ws), 'questions[0]: must be an object'));
});

test('missing or blank question id is rejected', () => {
  const a = validWorksheet(); delete a.questions[0].id;
  assert.ok(hasError(validateWorksheet(a), 'questions[0].id: required non-empty string'));
  const b = validWorksheet(); b.questions[0].id = '   ';
  assert.ok(hasError(validateWorksheet(b), 'questions[0].id: required non-empty string'));
});

test('duplicate question id is rejected', () => {
  const ws = validWorksheet(); ws.questions[1].id = 'q1';
  assert.ok(hasError(validateWorksheet(ws), 'questions[1].id: duplicate question id "q1"'));
});

test('blank prompt is rejected', () => {
  const ticket = validExitTicket(); ticket.questions[0].prompt = ' ';
  assert.ok(hasError(validateExitTicket(ticket), 'questions[0].prompt: required non-empty string'));
});

test('bad kind is rejected with the kind enum message', () => {
  const ws = validWorksheet(); ws.questions[0].kind = 'essay';
  assert.ok(hasError(validateWorksheet(ws),
    'questions[0].kind: must be multiple-choice|short-answer'));
});

test('multiple-choice with missing, non-array, or fewer than 2 choices is rejected', () => {
  const a = validWorksheet(); delete a.questions[0].choices;
  assert.ok(hasError(validateWorksheet(a), 'questions[0].choices: required array of at least 2 choices'));
  const b = validWorksheet(); b.questions[0].choices = 'nope';
  assert.ok(hasError(validateWorksheet(b), 'questions[0].choices: required array of at least 2 choices'));
  const c = validWorksheet(); c.questions[0].choices = [{ text: '3/4', correct: true }];
  assert.ok(hasError(validateWorksheet(c), 'questions[0].choices: required array of at least 2 choices'));
});

test('multiple-choice with zero or two correct choices is rejected', () => {
  const a = validWorksheet(); delete a.questions[0].choices[1].correct;
  assert.ok(hasError(validateWorksheet(a), 'questions[0].choices: exactly one choice must be marked correct'));
  const b = validWorksheet(); b.questions[0].choices[0].correct = true;
  assert.ok(hasError(validateWorksheet(b), 'questions[0].choices: exactly one choice must be marked correct'));
});

test('non-object choice and empty-text choice are rejected', () => {
  const a = validWorksheet(); a.questions[0].choices[0] = 'oops';
  assert.ok(hasError(validateWorksheet(a), 'questions[0].choices[0]: must be an object'));
  const b = validWorksheet(); b.questions[0].choices[0].text = '  ';
  assert.ok(hasError(validateWorksheet(b), 'questions[0].choices[0].text: required non-empty string'));
});

test('short-answer with missing or empty answer is rejected', () => {
  const a = validWorksheet(); delete a.questions[1].answer;
  assert.ok(hasError(validateWorksheet(a), 'questions[1].answer: required non-empty string'));
  const b = validExitTicket(); b.questions[0].answer = '';
  assert.ok(hasError(validateExitTicket(b), 'questions[0].answer: required non-empty string'));
});

test('empty explanation, feedback, or misconception where present is rejected', () => {
  const a = validWorksheet(); a.questions[0].explanation = ' ';
  assert.ok(hasError(validateWorksheet(a), 'questions[0].explanation: must be a non-empty string when present'));
  const b = validExitTicket(); b.questions[0].feedback = '';
  assert.ok(hasError(validateExitTicket(b), 'questions[0].feedback: must be a non-empty string when present'));
  const c = validWorksheet(); c.questions[0].misconception = 42;
  assert.ok(hasError(validateWorksheet(c), 'questions[0].misconception: must be a non-empty string when present'));
});

test('explanation, feedback, and misconception are optional when absent', () => {
  const ws = validWorksheet();
  delete ws.questions[0].explanation; delete ws.questions[0].misconception;
  delete ws.questions[1].feedback; delete ws.questions[1].misconception;
  assert.deepEqual(validateWorksheet(ws), []);
});
