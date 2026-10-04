/* animath teacher-rubric tests — R-4 (issue #111).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { scoreSpec } = require('../generator/rubric.js');

function loadSample(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'samples', name), 'utf8'));
}

function dimByName(result, name) {
  const d = result.dimensions.find((x) => x.name === name);
  assert.ok(d, 'expected a "' + name + '" dimension');
  return d;
}

function showShape(id, shape, atMs) {
  return { at_ms: atMs === undefined ? 0 : atMs, do: 'show', shape };
}

function textShape(id, x, y, size, text) {
  const s = { id, kind: 'text', x, y, text };
  if (size !== undefined) s.size = size;
  return s;
}

function mkScene(id, caption, durationMs, steps) {
  return { id, caption, narration: 'Narration for ' + id + '.', duration_ms: durationMs, steps };
}

// A deliberately broken spec: fails every dimension, with each dimension
// naming its failures in notes.
function brokenSpec() {
  return {
    animath: '0.1',
    title: '', // contract: title required
    level: 'primary',
    subject: 'math',
    topic: 'percentage', // resolves -> wrong-turn marker check applies
    kind: 'concept',
    canvas: { width: 960, height: 540 },
    scenes: [
      {
        id: 's1',
        caption: '', // captions + contract
        narration: 'A plain narration with no marker words at all.',
        duration_ms: 2000, // pacing: below the 6000 measured band
        steps: [
          showShape('t1', textShape('t1', 2000, 100, 48,
            'This heading is far too long for size 48 text and must fail the char budget')),
          // canvas: t1 is off-canvas (x 2000) and over budget (size>=48 -> 24)
          { at_ms: 5000, do: 'show', shape: textShape('t2', 10, 10, 24, 'ok') }
          // pacing: gap 5000 > 3700; contract: at_ms >= duration_ms
        ]
      },
      {
        id: 's2',
        caption: 'This caption is deliberately far too long for the rubric on purpose, ' +
          'it keeps going well past the eighty character limit.',
        narration: 'More plain narration.',
        duration_ms: 8000,
        steps: [
          showShape('r1', { id: 'r1', kind: 'rect', x: 10, y: 10, w: 100, h: 50 }, 0),
          showShape('c1', { id: 'c1', kind: 'circle', cx: 10, cy: 500, r: 20 }, 100), // cx-r < 0
          showShape('l1', { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 100 }, 200),
          showShape('a1', { id: 'a1', kind: 'arrow', x1: 5, y1: 5, x2: 50, y2: 50 }, 300),
          // no id on this shape -> '?' label; off-canvas so the label appears in notes
          { at_ms: 400, do: 'show', shape: textShape(undefined, 2000, 50, 40, 'no id on this shape') },
          showShape('small', textShape('small', 50, 90, 18,
            'this small text is longer than sixty characters so it fails its tier budget'), 500),
          showShape('nosize', textShape('nosize', 50, 130, undefined, 'default size text, fine'), 600),
          showShape('weirdsize', textShape('weirdsize', 50, 170, 'big', 'non-numeric size, also fine'), 700),
          showShape('notext', { id: 'notext', kind: 'text', x: 5, y: 5 }, 800), // no text field
          showShape('poly1', { id: 'poly1', kind: 'polygon', points: [[10, 10], [50, 10], [30, 60]] }, 900),
          showShape('poly2', { id: 'poly2', kind: 'polygon', points: [[10, 10], [2000, 10], [30, 60]] }, 1000),
          showShape('poly3', { id: 'poly3', kind: 'polygon' }, 1100), // no points
          showShape('mystery', { id: 'mystery', kind: 'star', x: 5, y: 5 }, 1200), // unknown kind
          showShape('tex1', { id: 'tex1', kind: 'latex', x: 60, y: 200, tex: 'x^2' }, 1300),
          showShape('tex2', { id: 'tex2', kind: 'latex', x: 60, y: 240, tex: 'y=' + 'z'.repeat(150) }, 1400),
          { at_ms: 1500, do: 'hide', target: 'r1' },
          null, // contract: step must be an object
          { at_ms: 'soon', do: 'show', shape: textShape('t3', 5, 5, 24, 'non-numeric at_ms') }
        ]
      },
      null // contract/pacing/captions: scene must be an object
    ]
  };
}

function problemSpec(finalCaption, finalSteps, sceneCount) {
  const scenes = [];
  for (let i = 1; i <= sceneCount; i++) {
    const isFinal = i === sceneCount;
    scenes.push(mkScene(
      'p' + i,
      isFinal ? finalCaption : 'Scene ' + i,
      7000,
      isFinal ? finalSteps : [showShape('t' + i, textShape('t' + i, 10, 10, 24, 'hi'))]
    ));
  }
  return {
    animath: '0.1', title: 'Problem', level: 'primary', subject: 'math',
    topic: 'zzz-no-such-topic', kind: 'problem', // unresolvable topic isolates the answer-beat check
    canvas: { width: 960, height: 540 }, scenes
  };
}

test('exemplar sample scores near-max with a full 6-dimension breakdown', () => {
  const spec = loadSample('primary-math-percentage-of-quantity.json');
  const r = scoreSpec(spec);
  assert.ok(r.score >= 90, 'exemplar should score >= 90, got ' + r.score);
  assert.equal(r.maxScore, 120);
  assert.equal(r.dimensions.length, 6);
  assert.deepEqual(r.dimensions.map((d) => d.name),
    ['contract validity', 'pacing', 'captions', 'pedagogy', 'canvas bounds',
      'mechanism density']);
  for (const d of r.dimensions) {
    assert.equal(d.max, 20, d.name + ' should be worth 20');
    assert.ok(Array.isArray(d.notes), d.name + ' notes should be an array');
  }
  const sum = r.dimensions.reduce((a, d) => a + d.score, 0);
  assert.equal(r.score, sum, 'score must equal the dimension sum');
  assert.equal(dimByName(r, 'contract validity').score, 20);
  // the sample has a "Watch out:" beat, so the wrong-turn marker check passes
  assert.equal(dimByName(r, 'pedagogy').score, 20);
});

test('deliberately broken spec scores low with each failing dimension named', () => {
  const r = scoreSpec(brokenSpec());
  assert.ok(r.score < 50, 'broken spec should score low, got ' + r.score);
  assert.equal(r.maxScore, 120);
  const contract = dimByName(r, 'contract validity');
  assert.equal(contract.score, 0);
  assert.ok(contract.notes.some((n) => n.includes('title')), 'contract notes name the title error');
  assert.ok(contract.notes.some((n) => n.includes('more')), 'contract notes cap long error lists');
  const pacing = dimByName(r, 'pacing');
  assert.ok(pacing.score < pacing.max);
  assert.ok(pacing.notes.some((n) => n.includes('duration_ms')), 'pacing notes name the duration failure');
  assert.ok(pacing.notes.some((n) => n.includes('gap')), 'pacing notes name the gap failure');
  const captions = dimByName(r, 'captions');
  assert.equal(captions.score, 0);
  assert.ok(captions.notes.length > 0);
  const pedagogy = dimByName(r, 'pedagogy');
  assert.equal(pedagogy.score, 0);
  assert.ok(pedagogy.notes.some((n) => n.includes('wrong-turn')), 'pedagogy notes name the marker failure');
  const canvas = dimByName(r, 'canvas bounds');
  assert.ok(canvas.score < canvas.max);
  assert.ok(canvas.notes.some((n) => n.includes('t1')), 'canvas notes name the off-canvas text');
  assert.ok(canvas.notes.some((n) => n.includes('budget')), 'canvas notes name the char-budget failure');
  assert.ok(canvas.notes.some((n) => n.includes('?')), 'canvas notes label the id-less shape with ?');
});

test('invalid inputs score 0 without throwing', () => {
  for (const bad of [null, undefined, 'nope', 42, [1, 2]]) {
    const r = scoreSpec(bad);
    assert.equal(r.score, 0);
    assert.equal(r.maxScore, 0);
    assert.equal(r.dimensions.length, 1);
    assert.equal(r.dimensions[0].name, 'invalid input');
    assert.ok(r.dimensions[0].notes.length > 0, 'invalid input carries a reason');
  }
  // {} is an object, so it goes through the dimensions — still 0, no throw
  const r = scoreSpec({});
  assert.equal(r.score, 0);
});

test('problem-kind spec: answer beat in the final scene', () => {
  const good = [showShape('t3', textShape('t3', 10, 10, 24, 'hi'))];
  const withBeat = problemSpec('The answer is 42', good, 3);
  const ped = dimByName(scoreSpec(withBeat), 'pedagogy');
  assert.equal(ped.max, 20);
  assert.equal(ped.score, 20, 'regex answer beat should pass: ' + JSON.stringify(ped.notes));

  const noBeat = problemSpec('Recap of the idea', good, 3);
  const ped2 = dimByName(scoreSpec(noBeat), 'pedagogy');
  assert.equal(ped2.score, 0);
  assert.ok(ped2.notes.some((n) => n.includes('answer beat')), 'notes name the missing beat');

  const tooShort = problemSpec('The answer is 42', good, 2);
  const ped3 = dimByName(scoreSpec(tooShort), 'pedagogy');
  assert.equal(ped3.score, 0);
  assert.ok(ped3.notes.some((n) => n.includes('3 scenes')), 'notes name the scene-count failure');

  // emphasize step counts as an answer beat even without the regex words
  const emphSteps = [
    showShape('t3', textShape('t3', 10, 10, 24, 'hi')),
    { at_ms: 500, do: 'emphasize', target: 't3' }
  ];
  const ped4 = dimByName(scoreSpec(problemSpec('Recap', emphSteps, 3)), 'pedagogy');
  assert.equal(ped4.score, 20, 'emphasize answer beat should pass: ' + JSON.stringify(ped4.notes));
});

test('unresolvable-topic spec skips the wrong-turn sub-check', () => {
  const spec = {
    animath: '0.1', title: 'T', level: 'primary', subject: 'math',
    topic: 'zzz-no-such-topic', kind: 'concept',
    canvas: { width: 960, height: 540 },
    scenes: [mkScene('s1', 'Hello', 7000, [showShape('t1', textShape('t1', 10, 10, 24, 'hi'))])]
  };
  const r = scoreSpec(spec);
  const ped = dimByName(r, 'pedagogy');
  assert.equal(ped.max, 0, 'no applicable checks -> max 0');
  assert.equal(ped.score, 0);
  assert.ok(ped.notes.some((n) => n.includes('skipped')), 'notes record the skip');
  assert.equal(r.maxScore, 100, 'maxScore adjusts when pedagogy is fully skipped');
});

test('empty scenes score 0 on pacing/captions/canvas without throwing', () => {
  const spec = {
    animath: '0.1', title: 'T', level: 'primary', subject: 'math',
    topic: 'zzz-no-such-topic', kind: 'concept',
    canvas: { width: 960, height: 540 }, scenes: []
  };
  const r = scoreSpec(spec);
  assert.equal(dimByName(r, 'pacing').score, 0);
  assert.equal(dimByName(r, 'captions').score, 0);
  assert.equal(dimByName(r, 'canvas bounds').score, 0);
  assert.equal(r.score, 0);
});

test('spec without a canvas defaults to 960x540', () => {
  const spec = {
    animath: '0.1', title: 'T', level: 'primary', subject: 'math',
    topic: 'percentage', kind: 'concept',
    scenes: [mkScene('s1', 'Watch out: a trap', 7000,
      [showShape('t1', textShape('t1', 100, 100, 24, 'hi'))])]
  };
  const canvas = dimByName(scoreSpec(spec), 'canvas bounds');
  assert.equal(canvas.score, 20, 'in-bounds shape on the default canvas: ' + JSON.stringify(canvas.notes));
});

// --- mechanism density (issue #131) -----------------------------------------

function rectShape(id, x, y, w, h) {
  return { id, kind: 'rect', x, y, w, h };
}

function moveStep(target, atMs) {
  return { at_ms: atMs, do: 'move', target };
}

function mechSpec(scenes) {
  return {
    animath: '0.1', title: 'T', level: 'primary', subject: 'math',
    topic: 'zzz-no-such-topic', kind: 'concept',
    canvas: { width: 960, height: 540 }, scenes
  };
}

test('mechanism density: one move step per scene scores full marks', () => {
  const scenes = ['a', 'b', 'c'].map((s) => mkScene(
    s, 'Caption for ' + s, 7000,
    [showShape('t', textShape('t', 10, 10, 24, 'hi')), moveStep('t', 500)]
  ));
  const d = dimByName(scoreSpec(mechSpec(scenes)), 'mechanism density');
  assert.equal(d.max, 20);
  assert.equal(d.score, 20);
  assert.equal(d.notes.length, 3);
  assert.ok(d.notes.every((n) => n.includes('move step')),
    'notes name the counted move steps: ' + JSON.stringify(d.notes));
});

test('mechanism density: fully text-only spec scores 0', () => {
  const scenes = ['a', 'b'].map((s) => mkScene(
    s, 'Caption for ' + s, 7000,
    [showShape('t1', textShape('t1', 10, 10, 24, 'hello')),
      showShape('t2', textShape('t2', 10, 60, 24, 'world'), 300)]
  ));
  const d = dimByName(scoreSpec(mechSpec(scenes)), 'mechanism density');
  assert.equal(d.max, 20);
  assert.equal(d.score, 0);
  assert.ok(d.notes.some((n) => n.includes('no mechanism')),
    'notes record the absence: ' + JSON.stringify(d.notes));
});

test('mechanism density: staged diagram build counts when bboxes intersect', () => {
  const scene = mkScene('s1', 'Two bars', 7000, [
    showShape('r1', rectShape('r1', 10, 10, 100, 50), 0),
    showShape('r2', rectShape('r2', 50, 30, 80, 40), 200) // intersects r1
  ]);
  const d = dimByName(scoreSpec(mechSpec([scene])), 'mechanism density');
  assert.equal(d.score, 20);
  assert.ok(d.notes.some((n) => n.includes('staged build')),
    'notes name the staged build: ' + JSON.stringify(d.notes));
});

test('mechanism density: disjoint diagram shows do not count as staged', () => {
  const scene = mkScene('s1', 'Far apart', 7000, [
    showShape('r1', rectShape('r1', 10, 10, 50, 50), 0),
    showShape('r2', rectShape('r2', 800, 400, 50, 50), 200) // nowhere near r1
  ]);
  const d = dimByName(scoreSpec(mechSpec([scene])), 'mechanism density');
  assert.equal(d.score, 0);
});

test('mechanism density: hide followed by an intersecting show counts as rebuild', () => {
  const scene = mkScene('s1', 'Rebuild', 7000, [
    showShape('r1', rectShape('r1', 10, 10, 100, 50), 0),
    { at_ms: 500, do: 'hide', target: 'r1' },
    showShape('r2', rectShape('r2', 20, 20, 80, 40), 1000) // intersects the hidden r1
  ]);
  const d = dimByName(scoreSpec(mechSpec([scene])), 'mechanism density');
  assert.equal(d.score, 20);
  assert.ok(d.notes.some((n) => n.includes('rebuild')),
    'notes name the rebuild: ' + JSON.stringify(d.notes));

  // too late to count as a staged transform (replacement placed far away so
  // the staged-build check stays out of it too)
  const late = mkScene('s2', 'Late', 7000, [
    showShape('r1', rectShape('r1', 10, 10, 100, 50), 0),
    { at_ms: 500, do: 'hide', target: 'r1' },
    showShape('r2', rectShape('r2', 400, 400, 80, 40), 2500)
  ]);
  const d2 = dimByName(scoreSpec(mechSpec([late])), 'mechanism density');
  assert.equal(d2.score, 0, 'rebuild past the 1600ms window must not count');

  // hiding an id that was never shown never throws
  const ghost = mkScene('s3', 'Ghost', 7000, [
    { at_ms: 500, do: 'hide', target: 'never-shown' }
  ]);
  assert.doesNotThrow(() => scoreSpec(mechSpec([ghost])));
  assert.equal(dimByName(scoreSpec(mechSpec([ghost])), 'mechanism density').score, 0);
});

test('mechanism density: partial credit is proportional with per-scene notes', () => {
  const scenes = [
    mkScene('move', 'Move scene', 7000,
      [showShape('t', textShape('t', 10, 10, 24, 'hi')), moveStep('t', 500)]),
    mkScene('text', 'Text scene', 7000,
      [showShape('t', textShape('t', 10, 10, 24, 'hi'))]),
    mkScene('staged', 'Staged scene', 7000, [
      showShape('r1', rectShape('r1', 10, 10, 100, 50), 0),
      showShape('r2', rectShape('r2', 50, 30, 80, 40), 200)
    ])
  ];
  const d = dimByName(scoreSpec(mechSpec(scenes)), 'mechanism density');
  assert.equal(d.score, Math.round(20 * 2 / 3));
  assert.equal(d.notes.length, 3);
  assert.ok(d.notes.some((n) => n.startsWith('move:') && n.includes('move step')),
    'move scene note names the evidence');
  assert.ok(d.notes.some((n) => n.startsWith('text:') && n.includes('no mechanism')),
    'text scene note records the absence');
  assert.ok(d.notes.some((n) => n.startsWith('staged:') && n.includes('staged build')),
    'staged scene note names the evidence');
});

test('mechanism density: malformed bboxes count as no-bbox and never throw', () => {
  const scene = mkScene('s1', 'Malformed', 7000, [
    showShape('r1', { id: 'r1', kind: 'rect', x: 10, y: 10, h: 50 }, 0), // missing w
    showShape('c1', { id: 'c1', kind: 'circle', cx: 100, cy: 100 }, 100), // missing r
    showShape('l1', { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 50 }, 200), // missing y2
    showShape('a1', { id: 'a1', kind: 'arrow', x1: 0, y1: 0, x2: 50, y2: 50 }, 300),
    showShape('p1', { id: 'p1', kind: 'polygon', points: [] }, 400), // empty points
    showShape('p2', { id: 'p2', kind: 'polygon', points: [[10, 10], null] }, 500), // bad point
    showShape('t1', textShape('t1', 10, 10, 24, 'hi'), 600) // non-diagram kind
  ]);
  const d = dimByName(scoreSpec(mechSpec([scene])), 'mechanism density');
  assert.equal(d.score, 0);
});

test('mechanism density: empty scenes score 0 without throwing', () => {
  const r = scoreSpec(mechSpec([]));
  assert.equal(dimByName(r, 'mechanism density').score, 0);
});
