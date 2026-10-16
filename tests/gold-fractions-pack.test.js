/* animath gold fractions-pack tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards issue #776: the hand-authored gold lesson pack for a second
 * subject (primary-math fractions addition) - deck, worksheet, exit
 * ticket, student notes and teacher script under
 * samples/{decks,worksheets,tickets,notes,scripts}/, mirroring the
 * water-cycle golds and keyed to the fractions animation
 * (samples/primary-math-fractions-addition.json) and the bank beat
 * MISCONCEPTIONS['fractions'].
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateSlides, validateWorksheet, validateExitTicket, validateNotes, validateScript
} = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

const animation = load('samples/primary-math-fractions-addition.json');
const deck = load('samples/decks/primary-math-fractions-addition.json');
const worksheet = load('samples/worksheets/primary-math-fractions-addition.json');
const ticket = load('samples/tickets/primary-math-fractions-addition.json');
const notes = load('samples/notes/primary-math-fractions-addition.json');
const script = load('samples/scripts/primary-math-fractions-addition.json');

const BANK_BEAT = MISCONCEPTIONS['fractions'];
const TITLE = 'Adding fractions: 1/2 + 1/4';
const EXPECTED_KINDS = ['title', 'objective', 'hook', 'concept', 'mechanism',
  'mechanism', 'mechanism', 'mechanism', 'example', 'practice', 'exit-ticket'];
const SCENE_IDS = animation.scenes.map((s) => s.id);

/* Envelope + animation grounding */

test('fractions animation carries scenes s1 to s4 with the brief captions', () => {
  assert.deepEqual(SCENE_IDS, ['s1', 's2', 's3', 's4']);
  assert.deepEqual(animation.scenes.map((s) => s.caption), [
    'Adding fractions',
    'Make the pieces the same size',
    'Count the quarters',
    'Watch out: 1/2 + 1/4 is not 2/6'
  ]);
  assert.equal(animation.title, TITLE);
  assert.equal(animation.topic, 'fractions');
});

test('all five gold materials share the fractions envelope', () => {
  for (const [name, spec] of Object.entries({ deck, worksheet, ticket, notes, script })) {
    assert.equal(spec.level, 'primary', name + ' level');
    assert.equal(spec.subject, 'math', name + ' subject');
    assert.equal(spec.topic, 'fractions', name + ' topic');
  }
  assert.equal(deck.title, TITLE);
  assert.equal(worksheet.title, TITLE);
  assert.equal(notes.title, TITLE);
  assert.equal(script.title, TITLE);
  assert.equal(ticket.title, TITLE + ' Exit Ticket');
});

test('all five gold materials validate with zero errors', () => {
  assert.deepEqual(validateSlides(deck), []);
  assert.deepEqual(validateWorksheet(worksheet), []);
  assert.deepEqual(validateExitTicket(ticket), []);
  assert.deepEqual(validateNotes(notes), []);
  assert.deepEqual(validateScript(script), []);
});

/* Deck */

test('gold fractions deck kind sequence is the 11-slide structure', () => {
  assert.deepEqual(deck.slides.map((s) => s.kind), EXPECTED_KINDS);
});

test('gold fractions deck mechanism visuals are s1 to s4, all real animation scenes', () => {
  const mech = deck.slides.filter((s) => s.kind === 'mechanism');
  assert.deepEqual(mech.map((s) => s.visual), ['s1', 's2', 's3', 's4']);
  for (const v of mech.map((s) => s.visual)) {
    assert.ok(SCENE_IDS.includes(v), 'visual ' + v + ' is a real animation scene id');
  }
});

test('every gold fractions deck slide has a heading, 1-3 bullets and speaker notes', () => {
  for (const slide of deck.slides) {
    assert.ok(slide.heading && slide.heading.trim(), 'slide heading present');
    assert.ok(Array.isArray(slide.bullets) && slide.bullets.length >= 1 && slide.bullets.length <= 3,
      'slide has 1-3 bullets');
    assert.ok(slide.notes && slide.notes.trim(), 'slide has speaker notes');
  }
});

test('gold fractions deck practice and exit-ticket slides address the 2/6 wrong turn', () => {
  for (const kind of ['practice', 'exit-ticket']) {
    const slide = deck.slides.find((s) => s.kind === kind);
    const text = [slide.heading].concat(slide.bullets).concat([slide.notes]).join('\n');
    assert.ok(text.includes('2/6'), kind + ' slide must name the 2/6 wrong turn');
  }
});

/* Worksheet */

test('gold fractions worksheet has 5 mixed questions, each with an explanation', () => {
  assert.equal(worksheet.questions.length, 5);
  assert.deepEqual(worksheet.questions.map((q) => q.id), ['q1', 'q2', 'q3', 'q4', 'q5']);
  const kinds = new Set(worksheet.questions.map((q) => q.kind));
  assert.ok(kinds.has('multiple-choice') && kinds.has('short-answer'), 'worksheet mixes question kinds');
  for (const q of worksheet.questions) {
    assert.ok(q.explanation && q.explanation.trim(), q.id + ' has an explanation');
    if (q.kind === 'multiple-choice') {
      assert.equal(q.choices.filter((c) => c.correct === true).length, 1,
        q.id + ' has exactly one correct choice');
    }
  }
});

test('gold fractions worksheet encodes the bank misconception in a 2/6 distractor', () => {
  const hit = worksheet.questions.find((q) => q.kind === 'multiple-choice'
    && q.choices.some((c) => c.text === '2/6'));
  assert.ok(hit, 'a multiple-choice question offers 2/6 as a distractor');
  assert.equal(hit.misconception, BANK_BEAT.wrongTurn);
  assert.ok(hit.explanation.includes(BANK_BEAT.wrongTurn),
    'the distractor explanation includes the bank wrong turn verbatim');
});

/* Exit ticket */

test('gold fractions ticket has 3-5 mixed questions, each with feedback', () => {
  assert.ok(ticket.questions.length >= 3 && ticket.questions.length <= 5,
    'ticket has 3-5 questions, got ' + ticket.questions.length);
  const kinds = new Set(ticket.questions.map((q) => q.kind));
  assert.ok(kinds.has('multiple-choice') && kinds.has('short-answer'), 'ticket mixes question kinds');
  for (const q of ticket.questions) {
    assert.ok(q.feedback && q.feedback.trim(), q.id + ' has non-empty feedback');
  }
});

test('gold fractions ticket keys a question to the bank misconception with a reteach point', () => {
  const keyed = ticket.questions.find((q) => q.misconception === BANK_BEAT.wrongTurn);
  assert.ok(keyed, 'a ticket question misconception equals the bank wrong turn verbatim');
  assert.ok(keyed.feedback.includes(BANK_BEAT.wrongTurn),
    'the keyed question feedback names the bank wrong turn verbatim');
  assert.ok(/piece size/.test(keyed.feedback),
    'the keyed question feedback carries the denominator-is-piece-size reteach point');
});

/* Notes */

test('gold fractions notes carry 4 mechanism steps, a worked example and the bank trap', () => {
  assert.ok(notes.objectives.length >= 1);
  const terms = notes.definitions.map((d) => d.term.toLowerCase());
  for (const term of ['fraction', 'numerator', 'denominator', 'equivalent fraction', 'common denominator']) {
    assert.ok(terms.includes(term), 'definitions include ' + term);
  }
  for (const d of notes.definitions) {
    assert.ok(d.meaning && d.meaning.trim(), 'definition ' + d.term + ' has a meaning');
  }
  assert.equal(notes.mechanismSteps.length, 4, 'one mechanism step per animation scene');
  assert.ok(notes.workedExample.includes('1/2 + 1/4') && notes.workedExample.includes('3/4'),
    'worked example shows the full 1/2 + 1/4 = 3/4 working');
  assert.equal(notes.trap.misconception, BANK_BEAT.wrongTurn);
  assert.ok(notes.trap.explanation.includes(BANK_BEAT.why),
    'trap explanation includes the bank why verbatim');
  assert.ok(notes.trap.explanation.includes(BANK_BEAT.correctTurn),
    'trap explanation includes the bank correct turn verbatim');
});

/* Script */

test('gold fractions script segments are timed inside 5-120 and every segment says something', () => {
  assert.equal(script.segments.length, 5);
  const total = script.segments.reduce((sum, s) => sum + s.minutes, 0);
  assert.ok(total >= 5 && total <= 120, 'script minutes sum ' + total + ' is inside 5-120');
  for (const s of script.segments) {
    assert.ok(s.say && s.say.trim(), 'segment has required say text');
  }
});

test('gold fractions script scene-like cues are real animation scene ids', () => {
  for (const s of script.segments) {
    if (s.cue && /^s\d+$/.test(s.cue)) {
      assert.ok(SCENE_IDS.includes(s.cue), 'cue ' + s.cue + ' is a real animation scene id');
    }
  }
  const cues = script.segments.map((s) => s.cue);
  assert.ok(cues.includes('s1') && cues.includes('s4'), 'script cues cover the first and last scenes');
});

test('gold fractions script watches for the bank misconception verbatim', () => {
  const watchers = script.segments.filter((s) => s.watchFor && s.watchFor.includes(BANK_BEAT.wrongTurn));
  assert.ok(watchers.length >= 1, 'at least one watchFor includes the bank wrong turn verbatim');
  const text = JSON.stringify(script);
  assert.ok(text.includes('worksheet') && text.includes('student notes') && text.includes('exit ticket'),
    'script cues and questions cover the other materials');
});
