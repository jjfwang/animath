/* animath exit-ticket-prompt tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards Materials Phase 2b (issue #756): the hand-authored gold exit
 * ticket (samples/tickets/primary-science-water-cycle.json), the
 * exit-ticket prompt builder (generator/build_exit_ticket_prompt.js),
 * its EXIT_TICKET_SYSTEM_TEMPLATE rules, and the trimmed
 * WATER_CYCLE_TICKET_EXEMPLAR embedded in it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Ticket = require('../generator/build_exit_ticket_prompt.js');
const { validateExitTicket } = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'tickets', 'primary-science-water-cycle.json');
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

/* (a) The gold exit ticket */

test('gold exit ticket loads and validateExitTicket returns no errors', () => {
  assert.equal(gold.title, 'The Water Cycle Exit Ticket');
  assert.equal(gold.level, 'primary');
  assert.equal(gold.subject, 'science');
  assert.equal(gold.topic, 'water-cycle');
  assert.deepEqual(validateExitTicket(gold), []);
});

test('gold exit ticket has 3-5 questions, each with per-question feedback', () => {
  assert.ok(gold.questions.length >= 3 && gold.questions.length <= 5,
    'ticket has 3-5 questions, got ' + gold.questions.length);
  for (const q of gold.questions) {
    assert.ok(typeof q.feedback === 'string' && q.feedback.trim(),
      q.id + ' carries per-question feedback');
    if (q.kind === 'multiple-choice') {
      assert.ok(q.choices.length >= 2, q.id + ' has at least 2 choices');
      assert.equal(q.choices.filter((c) => c.correct === true).length, 1,
        q.id + ' has exactly one correct choice');
    } else {
      assert.equal(q.kind, 'short-answer');
      assert.ok(typeof q.answer === 'string' && q.answer.trim(), q.id + ' has an answer');
    }
  }
});

test('gold exit ticket feedback addresses the evaporation misconception', () => {
  const hit = gold.questions.find((q) => /disappear/i.test(q.feedback || ''));
  assert.ok(hit, 'at least one question feedback addresses the disappears misconception');
  assert.ok(/evaporat/i.test(hit.feedback), 'that feedback ties the wrong turn to evaporation');
  const keyed = gold.questions.find((q) => q.misconception === BANK_BEAT.wrongTurn);
  assert.ok(keyed, 'at least one question misconception field names the bank beat');
});

/* (b) buildExitTicketPrompts with full water-cycle inputs */

test('built system prompt carries the exit-ticket rules and quality gates', () => {
  const { system } = Ticket.buildExitTicketPrompts(fullOpts());
  for (const phrase of [
    'Return ONLY the exit-ticket JSON',
    'title, level, subject, topic, questions',
    'Exactly 3-5 questions',
    'multiple-choice|short-answer',
    'at least 2 choices',
    'exactly one',
    'correct: true',
    'short-answer question requires',
    'feedback field on every question',
    'keyed to the',
    'misconception field wherever the',
    'Quick formative tone',
    'end-of-lesson',
    'what',
    'to reteach',
    'QUALITY GATES',
    'Key the questions to the transitions',
    Ticket.WATER_CYCLE_TICKET_EXEMPLAR
  ]) {
    assert.ok(system.includes(phrase), 'system prompt must contain: ' + phrase);
  }
});

test('built user prompt carries transitions in order, beats and the worked example', () => {
  const { user } = Ticket.buildExitTicketPrompts(fullOpts());
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
  assert.ok(user.includes('Exit-ticket misconception'),
    'user prompt must head the misconception beat with the exit-ticket heading');
  assert.ok(user.includes(BANK_BEAT.wrongTurn), 'user prompt must print the bank misconception beat');
  assert.ok(user.includes(CUSTOM_BEAT.wrongTurn), 'user prompt must print the supplied misconception beat');
  assert.ok(user.includes(WORKED_EXAMPLE), 'user prompt must render the worked example verbatim');
});

test('no unfilled placeholder survives buildExitTicketPrompts', () => {
  const { system, user } = Ticket.buildExitTicketPrompts(fullOpts());
  assert.ok(!system.includes('{{'), 'system must have no {{ }} placeholder left');
  assert.ok(!user.includes('{{'), 'user must have no {{ }} placeholder left');
});

/* (c) Degenerate inputs */

test('no transitions, misconceptions or worked example still yields a coherent prompt', () => {
  const out = Ticket.buildExitTicketPrompts({ subject: 'history', topic: 'fall-of-singapore' });
  assert.ok(out.system.includes('Primary school (PSLE)'), 'default level is primary');
  assert.ok(out.system.includes('Return ONLY the exit-ticket JSON'));
  assert.ok(!out.system.includes('TRANSITION QUESTIONS'),
    'no transition block is appended without transitions');
  assert.ok(out.user.includes('Address exactly one common misconception for the topic'),
    'unknown topic falls back to the generic misconception line');
  assert.ok(!out.user.includes('Worked example for this topic'),
    'no worked-example block without one supplied');
  assert.ok(!out.system.includes('{{') && !out.user.includes('{{'));
});

test('empty transitions and null misconceptions behave like absent ones', () => {
  const out = Ticket.buildExitTicketPrompts({
    subject: 'science', topic: 'water-cycle', transitions: [], misconceptions: null
  });
  assert.ok(!out.system.includes('TRANSITION QUESTIONS'));
  assert.ok(out.user.includes(BANK_BEAT.wrongTurn), 'bank beat still resolves for water-cycle');
  const outNull = Ticket.buildExitTicketPrompts({
    subject: 'science', topic: 'water-cycle', transitions: null, workedExample: null
  });
  assert.ok(!outNull.system.includes('TRANSITION QUESTIONS'));
  assert.ok(!outNull.user.includes('Worked example for this topic'));
});

test('missing subject throws the documented error', () => {
  assert.throws(() => Ticket.buildExitTicketPrompts({ topic: 'water-cycle' }),
    /buildExitTicketPrompts: subject is required/);
  assert.throws(() => Ticket.buildExitTicketPrompts(),
    /buildExitTicketPrompts: subject is required/);
});

test('malformed transitions throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, transitions: 'evaporation' }),
    /buildExitTicketPrompts: opts\.transitions must be an array/);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, transitions: [WATER_CYCLE_TRANSITIONS[0]] }),
    /buildExitTicketPrompts: opts\.transitions must hold 2-8 transitions, got 1/);
  const nine = WATER_CYCLE_TRANSITIONS.concat(WATER_CYCLE_TRANSITIONS).concat([WATER_CYCLE_TRANSITIONS[0]]);
  assert.equal(nine.length, 9);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, transitions: nine }),
    /buildExitTicketPrompts: opts\.transitions must hold 2-8 transitions, got 9/);
  const missingField = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour' },
    WATER_CYCLE_TRANSITIONS[1]
  ];
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, transitions: missingField }),
    /buildExitTicketPrompts: opts\.transitions\[0\]\.driver must be a non-empty string/);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, transitions: ['nope', WATER_CYCLE_TRANSITIONS[1]] }),
    /buildExitTicketPrompts: opts\.transitions\[0\] must be an object/);
});

test('malformed misconceptions and worked example throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, misconceptions: 'a beat' }),
    /buildExitTicketPrompts: opts\.misconceptions must be an array/);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, misconceptions: [42] }),
    /buildExitTicketPrompts: opts\.misconceptions\[0\] must be an object/);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, misconceptions: [{ wrongTurn: 'x', why: 'y' }] }),
    /buildExitTicketPrompts: opts\.misconceptions\[0\]\.correctTurn must be a non-empty string/);
  assert.throws(() => Ticket.buildExitTicketPrompts({ ...base, workedExample: 42 }),
    /buildExitTicketPrompts: opts\.workedExample must be a non-empty string/);
});

test('unknown level falls back like buildSlidePrompts', () => {
  const out = Ticket.buildExitTicketPrompts({
    level: 'kindergarten', subject: 'science', topic: 'water-cycle',
    transitions: WATER_CYCLE_TRANSITIONS
  });
  assert.ok(out.user.includes('Level: kindergarten (kindergarten)'),
    'unknown level label falls back to the level string itself');
  assert.ok(out.system.includes('direct, precise, exam-aware'),
    'unknown level tone falls back to the secondary tone');
  assert.ok(out.system.includes('Key the questions to the transitions'),
    'transitions still append the transition block');
});

/* (d) The trimmed exemplar */

test('exemplar parses back to a valid exit ticket addressing the misconception', () => {
  const reversed = Ticket.WATER_CYCLE_TICKET_EXEMPLAR.split('} }').join('}}');
  const ticket = JSON.parse(reversed);
  assert.deepEqual(validateExitTicket(ticket), []);
  assert.equal(ticket.level, 'primary');
  assert.equal(ticket.subject, 'science');
  assert.equal(ticket.topic, 'water-cycle');
  assert.ok(ticket.questions.length >= 3 && ticket.questions.length <= 5,
    'exemplar has 3-5 questions');
  for (const q of ticket.questions) {
    assert.ok(typeof q.feedback === 'string' && q.feedback.trim(),
      q.id + ' exemplar question carries feedback');
  }
  const text = JSON.stringify(ticket).toLowerCase();
  assert.ok(text.includes('disappear'), 'exemplar addresses the evaporation-disappears misconception');
});

test('template exports are strings and the builder source is ASCII-only', () => {
  assert.equal(typeof Ticket.EXIT_TICKET_SYSTEM_TEMPLATE, 'string');
  assert.ok(Ticket.EXIT_TICKET_SYSTEM_TEMPLATE.includes('WORKED EXAMPLE - hand-authored water-cycle exit ticket, trimmed'),
    'template embeds the exemplar under the worked-example header');
  assert.ok(Ticket.EXIT_TICKET_SYSTEM_TEMPLATE.endsWith(Ticket.WATER_CYCLE_TICKET_EXEMPLAR),
    'exemplar sits at the end of the system template');
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_exit_ticket_prompt.js'), 'utf8');
  assert.ok(!/[^\x00-\x7F]/.test(src), 'builder source must be ASCII-only');
});

test('d.ts export names match the runtime exports', () => {
  const dts = fs.readFileSync(path.join(__dirname, '..', 'generator', 'build_exit_ticket_prompt.d.ts'), 'utf8');
  for (const name of ['buildExitTicketPrompts', 'EXIT_TICKET_SYSTEM_TEMPLATE', 'WATER_CYCLE_TICKET_EXEMPLAR']) {
    assert.ok(dts.includes(name), 'd.ts must declare ' + name);
    assert.ok(name in Ticket, 'runtime must export ' + name);
  }
});
