/* animath slide-prompt tests - zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards Materials Phase 1b (issue #745): the hand-authored gold deck
 * (samples/decks/primary-science-water-cycle.json), the slide prompt
 * builder (generator/build_slides_prompt.js), its SLIDE_SYSTEM_TEMPLATE
 * rules, and the trimmed WATER_CYCLE_DECK_EXEMPLAR embedded in it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Slides = require('../generator/build_slides_prompt.js');
const { validateSlides } = require('../player/validate.js');
const { MISCONCEPTIONS } = require('../generator/misconceptions.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'decks', 'primary-science-water-cycle.json');
const goldDeck = JSON.parse(fs.readFileSync(GOLD_PATH, 'utf8'));

const EXPECTED_KINDS = ['title', 'objective', 'hook', 'concept', 'mechanism',
  'mechanism', 'mechanism', 'mechanism', 'example', 'practice', 'exit-ticket'];

const BANK_BEAT = MISCONCEPTIONS['water-cycle'];
const CUSTOM_BEAT = {
  wrongTurn: 'Rain falls because clouds get too full and spill.',
  why: 'A cloud looks like a sponge that can overfill.',
  correctTurn: 'Drops grow too heavy to float, so gravity pulls them down.'
};

// The four water-cycle transitions (unpack output), the evaporation one
// carrying the bank misconception beat, as attachMisconceptions leaves it.
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

function slideText(slide) {
  return [slide.heading || ''].concat(slide.bullets || []).concat([slide.notes || '']).join('\n');
}

/* (a) The gold deck */

test('gold deck loads and validateSlides returns no errors', () => {
  assert.equal(goldDeck.title, 'The Water Cycle');
  assert.equal(goldDeck.level, 'primary');
  assert.equal(goldDeck.subject, 'science');
  assert.equal(goldDeck.topic, 'water-cycle');
  assert.deepEqual(validateSlides(goldDeck), []);
});

test('gold deck kind sequence is the 11-slide structure', () => {
  assert.deepEqual(goldDeck.slides.map((s) => s.kind), EXPECTED_KINDS);
});

test('gold deck mechanism slides carry scene ids s1 to s4 in order', () => {
  const mech = goldDeck.slides.filter((s) => s.kind === 'mechanism');
  assert.equal(mech.length, 4);
  assert.deepEqual(mech.map((s) => s.visual), ['s1', 's2', 's3', 's4']);
});

test('gold deck practice and exit-ticket slides address the evaporation misconception', () => {
  for (const kind of ['practice', 'exit-ticket']) {
    const slide = goldDeck.slides.find((s) => s.kind === kind);
    const text = slideText(slide).toLowerCase();
    assert.ok(text.includes('disappear'), kind + ' slide must name the disappears wrong turn');
    assert.ok(text.includes('evaporat'), kind + ' slide must tie the wrong turn to evaporation');
  }
});

test('every gold deck slide has a heading, 1-3 bullets and distinct spoken notes', () => {
  for (const slide of goldDeck.slides) {
    assert.ok(typeof slide.heading === 'string' && slide.heading.trim(), slide.kind + ' has a heading');
    assert.ok(Array.isArray(slide.bullets) && slide.bullets.length >= 1 && slide.bullets.length <= 3,
      slide.kind + ' has 1-3 bullets');
    assert.ok(typeof slide.notes === 'string' && slide.notes.trim(), slide.kind + ' has non-empty notes');
    assert.notEqual(slide.notes, slide.heading, slide.kind + ' notes must not repeat the heading');
    for (const b of slide.bullets) {
      assert.notEqual(slide.notes, b, slide.kind + ' notes must not repeat a bullet');
    }
  }
});

/* (b) buildSlidePrompts with full water-cycle inputs */

test('built system prompt carries the deck rules and quality gates', () => {
  const { system } = Slides.buildSlidePrompts(fullOpts());
  for (const phrase of [
    'Return ONLY the deck JSON',
    'title, level, subject, topic, slides',
    'title|objective|hook|concept|mechanism|example|practice|exit-ticket',
    'title first',
    'exit-ticket last',
    'objective before concept/mechanism',
    'one idea per slide',
    'QUALITY GATES',
    'notes say what the teacher should SAY',
    'never repeat the slide heading or bullets',
    'misconception is placed on the practice and exit-ticket slides',
    'Mechanism slides show the state change, not just name it',
    'heading or bullets',
    'one mechanism slide per transition',
    Slides.WATER_CYCLE_DECK_EXEMPLAR
  ]) {
    assert.ok(system.includes(phrase), 'system prompt must contain: ' + phrase);
  }
});

test('built user prompt carries transitions in order, beats and the worked example', () => {
  const { user } = Slides.buildSlidePrompts(fullOpts());
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
  assert.ok(user.includes('Practice and exit-ticket misconception'),
    'user prompt must head the misconception beat with the practice/exit-ticket heading');
  assert.ok(user.includes(BANK_BEAT.wrongTurn), 'user prompt must print the bank misconception beat');
  assert.ok(user.includes(CUSTOM_BEAT.wrongTurn), 'user prompt must print the supplied misconception beat');
  assert.ok(user.includes(WORKED_EXAMPLE), 'user prompt must render the worked example verbatim');
});

test('no unfilled placeholder survives buildSlidePrompts', () => {
  const { system, user } = Slides.buildSlidePrompts(fullOpts());
  assert.ok(!system.includes('{{'), 'system must have no {{ }} placeholder left');
  assert.ok(!user.includes('{{'), 'user must have no {{ }} placeholder left');
});

/* (c) Degenerate inputs */

test('no transitions, misconceptions or worked example still yields a coherent prompt', () => {
  const out = Slides.buildSlidePrompts({ subject: 'history', topic: 'fall-of-singapore' });
  assert.ok(out.system.includes('Primary school (PSLE)'), 'default level is primary');
  assert.ok(out.system.includes('Return ONLY the deck JSON'));
  assert.ok(!out.system.includes('TRANSITION MECHANISM SLIDES'),
    'no transition block is appended without transitions');
  assert.ok(out.user.includes('Address exactly one common misconception for the topic'),
    'unknown topic falls back to the generic misconception line');
  assert.ok(!out.user.includes('Worked example for this topic'),
    'no worked-example block without one supplied');
  assert.ok(!out.system.includes('{{') && !out.user.includes('{{'));
});

test('empty transitions and null misconceptions behave like absent ones', () => {
  const out = Slides.buildSlidePrompts({
    subject: 'science', topic: 'water-cycle', transitions: [], misconceptions: null
  });
  assert.ok(!out.system.includes('TRANSITION MECHANISM SLIDES'));
  assert.ok(out.user.includes(BANK_BEAT.wrongTurn), 'bank beat still resolves for water-cycle');
  const outNull = Slides.buildSlidePrompts({
    subject: 'science', topic: 'water-cycle', transitions: null, workedExample: null
  });
  assert.ok(!outNull.system.includes('TRANSITION MECHANISM SLIDES'));
  assert.ok(!outNull.user.includes('Worked example for this topic'));
});

test('missing subject throws the documented error', () => {
  assert.throws(() => Slides.buildSlidePrompts({ topic: 'water-cycle' }),
    /buildSlidePrompts: subject is required/);
  assert.throws(() => Slides.buildSlidePrompts(),
    /buildSlidePrompts: subject is required/);
});

test('malformed transitions throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Slides.buildSlidePrompts({ ...base, transitions: 'evaporation' }),
    /buildSlidePrompts: opts\.transitions must be an array/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, transitions: [WATER_CYCLE_TRANSITIONS[0]] }),
    /buildSlidePrompts: opts\.transitions must hold 2-8 transitions, got 1/);
  const nine = WATER_CYCLE_TRANSITIONS.concat(WATER_CYCLE_TRANSITIONS).concat([WATER_CYCLE_TRANSITIONS[0]]);
  assert.equal(nine.length, 9);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, transitions: nine }),
    /buildSlidePrompts: opts\.transitions must hold 2-8 transitions, got 9/);
  const missingField = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour' },
    WATER_CYCLE_TRANSITIONS[1]
  ];
  assert.throws(() => Slides.buildSlidePrompts({ ...base, transitions: missingField }),
    /buildSlidePrompts: opts\.transitions\[0\]\.driver must be a non-empty string/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, transitions: ['nope', WATER_CYCLE_TRANSITIONS[1]] }),
    /buildSlidePrompts: opts\.transitions\[0\] must be an object/);
});

test('malformed misconceptions and worked example throw descriptive errors', () => {
  const base = { subject: 'science', topic: 'water-cycle' };
  assert.throws(() => Slides.buildSlidePrompts({ ...base, misconceptions: 'a beat' }),
    /buildSlidePrompts: opts\.misconceptions must be an array/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, misconceptions: [42] }),
    /buildSlidePrompts: opts\.misconceptions\[0\] must be an object/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, misconceptions: [{ wrongTurn: 'x', why: 'y' }] }),
    /buildSlidePrompts: opts\.misconceptions\[0\]\.correctTurn must be a non-empty string/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, workedExample: 42 }),
    /buildSlidePrompts: opts\.workedExample must be a non-empty string/);
  assert.throws(() => Slides.buildSlidePrompts({ ...base, shape: 'spiral' }),
    /buildSlidePrompts: opts\.shape must be one of sequence, cycle, system/);
});

test('unknown level falls back like buildPrompts; a valid shape is accepted', () => {
  const out = Slides.buildSlidePrompts({
    level: 'kindergarten', subject: 'science', topic: 'water-cycle', shape: 'cycle',
    transitions: WATER_CYCLE_TRANSITIONS
  });
  assert.ok(out.user.includes('Level: kindergarten (kindergarten)'),
    'unknown level label falls back to the level string itself');
  assert.ok(out.system.includes('direct, precise, exam-aware'),
    'unknown level tone falls back to the secondary tone');
  assert.ok(out.system.includes('one mechanism slide per transition'),
    'transitions still append the mechanism block with a cycle shape');
});

/* (d) The trimmed exemplar */

test('exemplar parses back to a valid deck with the gold kind sequence', () => {
  const reversed = Slides.WATER_CYCLE_DECK_EXEMPLAR.split('} }').join('}}');
  const deck = JSON.parse(reversed);
  assert.deepEqual(validateSlides(deck), []);
  assert.deepEqual(deck.slides.map((s) => s.kind), EXPECTED_KINDS);
  assert.deepEqual(deck.slides.map((s) => s.kind), goldDeck.slides.map((s) => s.kind));
});

test('exemplar stays under the 3KB budget and the template exports are strings', () => {
  assert.ok(Buffer.byteLength(Slides.WATER_CYCLE_DECK_EXEMPLAR, 'utf8') < 3000,
    'exemplar must stay under 3KB');
  assert.equal(typeof Slides.SLIDE_SYSTEM_TEMPLATE, 'string');
  assert.ok(Slides.SLIDE_SYSTEM_TEMPLATE.includes('WORKED EXAMPLE - hand-authored water-cycle deck, trimmed'),
    'template embeds the exemplar under the worked-example header');
  assert.ok(Slides.SLIDE_SYSTEM_TEMPLATE.endsWith(Slides.WATER_CYCLE_DECK_EXEMPLAR),
    'exemplar sits at the end of the system template');
});
