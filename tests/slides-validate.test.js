/* Tests for validateSlides (SPEC.md "Slide spec", issue #744). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSlides } = require('../player/validate.js');

function validDeck() {
  return {
    title: 'The Water Cycle',
    level: 'primary',
    subject: 'science',
    topic: 'water-cycle',
    slides: [
      { kind: 'title', heading: 'The Water Cycle' },
      { kind: 'objective', heading: 'What we will learn', bullets: ['Name each stage of the cycle'] },
      { kind: 'concept', heading: 'Water changes state', bullets: ['Evaporation', 'Condensation'] },
      { kind: 'exit-ticket', heading: 'Exit ticket', bullets: ['What makes water vapour rise?'] }
    ]
  };
}

function hasError(errors, substr) {
  return errors.some((e) => e.includes(substr));
}

test('minimal valid deck passes', () => {
  const deck = {
    title: 'Fractions',
    level: 'primary',
    subject: 'math',
    topic: 'fractions',
    slides: [
      { kind: 'title', heading: 'Fractions' },
      { kind: 'exit-ticket', bullets: ['Shade half of the bar'] }
    ]
  };
  assert.deepEqual(validateSlides(deck), []);
});

test('full valid deck passes: all 8 kinds, both visual forms, non-syllabus subject', () => {
  const deck = {
    title: 'The Fall of Singapore',
    level: 'secondary',
    subject: 'history',
    topic: 'fall-of-singapore',
    slides: [
      { kind: 'title', heading: 'The Fall of Singapore', visual: 'scene-intro' },
      { kind: 'objective', bullets: ['Explain why Singapore fell in 1942'], notes: 'Read aloud.' },
      { kind: 'hook', heading: 'A fortress that faced the wrong way' },
      { kind: 'concept', heading: 'The Malaya campaign', bullets: ['Japanese forces advanced down the peninsula'] },
      { kind: 'mechanism', heading: 'How the defences were bypassed', visual: { sceneId: 'scene-map' } },
      { kind: 'example', heading: 'The guns of Sentosa', visual: { kind: 'arrow' } },
      { kind: 'practice', heading: 'Try it', bullets: ['Order the events'], visual: { sceneId: 'scene-timeline', kind: 'rect' }, notes: '' },
      { kind: 'exit-ticket', heading: 'Exit ticket', bullets: ['One reason Singapore fell'] }
    ]
  };
  assert.deepEqual(validateSlides(deck), []);
});

test('non-object deck returns exactly the spec error', () => {
  for (const bad of [null, undefined, 'deck', 42, true]) {
    assert.deepEqual(validateSlides(bad), ['spec: must be an object']);
  }
});

test('missing or empty title is rejected', () => {
  const a = validDeck(); delete a.title;
  assert.ok(hasError(validateSlides(a), 'title: required non-empty string'));
  const b = validDeck(); b.title = '   ';
  assert.ok(hasError(validateSlides(b), 'title: required non-empty string'));
});

test('bad level is rejected', () => {
  const deck = validDeck(); deck.level = 'kindergarten';
  assert.ok(hasError(validateSlides(deck), 'level: must be primary|secondary|jc'));
});

test('empty or non-string subject is rejected; any subject value accepted', () => {
  const a = validDeck(); a.subject = '';
  assert.ok(hasError(validateSlides(a), 'subject: required non-empty string'));
  const b = validDeck(); b.subject = 7;
  assert.ok(hasError(validateSlides(b), 'subject: required non-empty string'));
  const c = validDeck(); c.subject = 'history';
  assert.deepEqual(validateSlides(c), []);
});

test('empty topic is rejected', () => {
  const deck = validDeck(); deck.topic = '  ';
  assert.ok(hasError(validateSlides(deck), 'topic: required non-empty string'));
});

test('empty, missing, or non-array slides is rejected', () => {
  const a = validDeck(); a.slides = [];
  assert.ok(hasError(validateSlides(a), 'slides: required non-empty array'));
  const b = validDeck(); delete b.slides;
  assert.ok(hasError(validateSlides(b), 'slides: required non-empty array'));
  const c = validDeck(); c.slides = 'nope';
  assert.ok(hasError(validateSlides(c), 'slides: required non-empty array'));
});

test('non-object slide is rejected and validation continues', () => {
  const deck = validDeck(); deck.slides[1] = 'oops';
  const errors = validateSlides(deck);
  assert.ok(hasError(errors, 'slides[1]: must be an object'));
});

test('unknown kind is rejected with the kind enum message', () => {
  const deck = validDeck(); deck.slides[1].kind = 'quiz';
  assert.ok(hasError(validateSlides(deck),
    'slides[1].kind: must be title|objective|hook|concept|mechanism|example|practice|exit-ticket'));
});

test('slide with neither heading nor bullets is rejected', () => {
  const a = validDeck(); delete a.slides[2].heading; delete a.slides[2].bullets;
  assert.ok(hasError(validateSlides(a), 'slides[2]: must have a heading or non-empty bullets'));
  const b = validDeck(); delete b.slides[2].heading; b.slides[2].bullets = [];
  assert.ok(hasError(validateSlides(b), 'slides[2]: must have a heading or non-empty bullets'));
});

test('present-but-empty heading is rejected', () => {
  const deck = validDeck(); deck.slides[0].heading = '   ';
  assert.ok(hasError(validateSlides(deck), 'slides[0].heading: must be a non-empty string when present'));
});

test('non-array bullets is rejected', () => {
  const deck = validDeck(); deck.slides[2].bullets = 'Evaporation';
  assert.ok(hasError(validateSlides(deck), 'slides[2].bullets: must be an array when present'));
});

test('empty or non-string bullet entry is rejected', () => {
  const a = validDeck(); a.slides[2].bullets = ['Evaporation', ''];
  assert.ok(hasError(validateSlides(a), 'slides[2].bullets[1]: required non-empty string'));
  const b = validDeck(); b.slides[2].bullets = [42];
  assert.ok(hasError(validateSlides(b), 'slides[2].bullets[0]: required non-empty string'));
});

test('non-string notes is rejected; empty-string notes allowed', () => {
  const a = validDeck(); a.slides[0].notes = 5;
  assert.ok(hasError(validateSlides(a), 'slides[0].notes: must be a string when present'));
  const b = validDeck(); b.slides[0].notes = '';
  assert.deepEqual(validateSlides(b), []);
});

test('every dangling visual form is rejected', () => {
  const dangling = [null, 42, true, [], '', '   ', {}, { sceneId: '' }, { sceneId: '  ' },
    { kind: 'bogus' }, { sceneId: '', kind: 'rect' }, { sceneId: 'scene-1', kind: 'bogus' }];
  for (const v of dangling) {
    const deck = validDeck(); deck.slides[0].visual = v;
    assert.ok(hasError(validateSlides(deck), 'slides[0].visual: dangling visual reference'),
      'expected dangling error for ' + JSON.stringify(v));
  }
});

test('valid visual forms pass on their own', () => {
  const ok = ['scene-1', { sceneId: 'scene-1' }, { kind: 'sector' }, { sceneId: 's', kind: 'text' }];
  for (const v of ok) {
    const deck = validDeck(); deck.slides[0].visual = v;
    assert.deepEqual(validateSlides(deck), [], 'expected valid for ' + JSON.stringify(v));
  }
});

test('missing title slide is rejected', () => {
  const deck = validDeck(); deck.slides[0].kind = 'hook';
  const errors = validateSlides(deck);
  assert.ok(hasError(errors, 'slides: missing a title slide'));
  assert.ok(!hasError(errors, 'title slide must be first'));
});

test('title slide not first is rejected', () => {
  const deck = validDeck();
  const t = deck.slides[0]; deck.slides[0] = deck.slides[1]; deck.slides[1] = t;
  const errors = validateSlides(deck);
  assert.ok(hasError(errors, 'slides[0].kind: title slide must be first'));
  assert.ok(!hasError(errors, 'missing a title slide'));
});

test('missing exit-ticket slide is rejected', () => {
  const deck = validDeck(); deck.slides[3].kind = 'practice';
  const errors = validateSlides(deck);
  assert.ok(hasError(errors, 'slides: missing an exit-ticket slide'));
  assert.ok(!hasError(errors, 'exit-ticket slide must be last'));
});

test('exit-ticket slide not last is rejected', () => {
  const deck = validDeck();
  deck.slides.push({ kind: 'practice', heading: 'Extra practice' });
  const errors = validateSlides(deck);
  assert.ok(hasError(errors, 'slides[4].kind: exit-ticket slide must be last'));
  assert.ok(!hasError(errors, 'missing an exit-ticket slide'));
});

test('objective after concept is rejected', () => {
  const deck = validDeck();
  const o = deck.slides[1]; deck.slides[1] = deck.slides[2]; deck.slides[2] = o;
  assert.ok(hasError(validateSlides(deck),
    'slides: objective slide must come before concept/mechanism slides'));
});

test('objective after mechanism is rejected', () => {
  const deck = validDeck();
  deck.slides[2].kind = 'mechanism';
  const o = deck.slides[1]; deck.slides[1] = deck.slides[2]; deck.slides[2] = o;
  assert.ok(hasError(validateSlides(deck),
    'slides: objective slide must come before concept/mechanism slides'));
});

test('objective is not required', () => {
  const deck = validDeck(); deck.slides[1].kind = 'hook';
  assert.deepEqual(validateSlides(deck), []);
});
