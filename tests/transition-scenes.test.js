/* animath transition-scenes tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards generate-pipeline slice 2 (issue #687): generator/build_prompt.js
 * buildPrompts accepts opts.transitions (the unpacked {name, from_state,
 * to_state, driver} list from generator/unpack.js) and wires each transition
 * into the authoring prompt as exactly one scene. Without transitions the
 * output must be byte-identical to the pre-slice-2 behavior; malformed
 * transitions input throws a descriptive Error.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Prompt = require('../generator/build_prompt.js');

// The four water-cycle transitions (slice 1, issue #685 unpack output).
const WATER_CYCLE = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: 'the sun\'s heat' },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' },
  { name: 'precipitation', from_state: 'droplets', to_state: 'falling water', driver: 'gravity' },
  { name: 'collection', from_state: 'fallen water', to_state: 'gathered seas and rivers', driver: 'gravity' }
];

function waterCycleOpts(transitions) {
  return {
    level: 'secondary', subject: 'science', topic: 'water-cycle',
    topicLabel: 'Water cycle', kind: 'concept', focus: 'exam prep',
    transitions: transitions
  };
}

// Stored baseline: the exact pre-slice-2 output for waterCycleOpts() with no
// transitions. The no-transitions tests below assert byte-identical output
// against this snapshot.
const BASELINE = {"system":"You are animath's animation author. You write short animated explainers for\nSingapore students as JSON documents following the animath spec v0.1.\n\nHARD RULES — violate any of these and the spec is rejected:\n1. Return ONLY the JSON document. No markdown fences, no commentary.\n2. Top-level fields, exactly: animath (\"0.1\"), title, level, subject, topic,\n   kind, canvas ({width:960, height:540}), scenes (2 to 8).\n3. Each scene: id (unique), caption (<= 60 chars), narration (1-2 sentences,\n   spoken tone for the level), duration_ms (4000-12000), steps ordered by\n   at_ms ascending, every at_ms < duration_ms.\n4. Step verbs: show | hide | move | emphasize | caption.\n5. Shape kinds: text | rect | circle | line | arrow | polygon | latex. Every shape\n   needs a unique id within its scene. Coordinates are canvas pixels,\n   origin top-left. Colors are CSS hex. (latex: formal/symbolic notation rendered with KaTeX —\n   write plain LaTeX in its \"tex\" field, e.g. \"a^2 + b^2 = c^2\".)\n6. move supports text | rect | circle | line | arrow | latex | polygon.\n   Every move step needs a numeric dur_ms (milliseconds). to must carry\n   at least one field valid for the target kind: x/y for text/rect/latex,\n   cx/cy for circle, x1/y1/x2/y2 for line/arrow, points for polygon (an\n   array of [x,y] pairs, same length as the shape's points) — plus\n   w/h for rect and r for circle (size fields allowed, alone or with\n   position fields). hide/move/emphasize targets must be shown earlier in the SAME scene.\n7. Formal notation: prefer the latex shape kind where unicode symbols break\n   down (fractions, stacked notation, algebra, chemical formulae, annotated diagrams); text shapes stay UNICODE\n   ONLY — NEVER LaTeX backslash commands inside text, like \\frac, \\sqrt, \\times.\n8. Keep scenes visually uncluttered: max ~8 shapes visible at once. Prefer\n   building a diagram step by step over dumping it whole.\n\nExplain-tooltips: key chart/diagram shapes should carry an \"explain\" field:\na plain-text \"explain me this\" sentence the player shows when the viewer\nhovers over, taps, or keyboard-focuses the shape. Write it for a student\nstaring at that one part: name the part, state what it means in this scene,\none short sentence, plain text (no markdown, no LaTeX). Decorative shapes\nand captions do not carry one.\n\nChart shapes — author them in the canonical descriptor forms the validator\naccepts (the same forms generator/charts.js produces):\npie slices as first-class \"sector\" descriptors ({cx, cy, r, startAngle,\nendAngle}), one per value, with value-proportional sweeps (angles in degrees:\n0 is east, positive is clockwise); bar charts as \"rect\" descriptors growing up\nfrom a visible zero baseline (the zero line stays in the plot); axes with\n\"nice\" tick values (1/2/2.5/5/10 steps) and a few labeled tick marks; number lines\nas a baseline with tick marks and centered text labels; area under a curve\nas a \"polygon\" whose points close back to the axis baseline; chart grids as thin\n\"line\" descriptors at the tick positions, drawn behind the data.\n\nPEDAGOGY:\n- kind \"concept\": motivate (why it matters) -> build the idea visually ->\n  one worked micro-example -> recap the takeaway.\n- kind \"problem\": state the problem -> plan (what we need) -> solve it\n  step by step, each step appearing as it is explained -> box the answer.\nMECHANISM-FIRST — every scene must show the mechanism, not just tell it:\n- Each scene needs at least one genuine state transition: a move step,\n  or a staged show/hide sequence that builds or transforms the diagram.\n- On-screen text plays a supporting role only (labels, captions) — never\n  the teaching mechanism itself.\n- move vs. staged show/hide: use move for transformation or motion of a\n  persistent shape; staged show/hide for step-by-step diagram\n  construction; emphasize for attention without state change.\n- Address exactly one common misconception for the topic, visually:\n  Common wrong turn: Water disappears for good once it evaporates.\n  Why students slip: The water turns invisible as vapour, so it looks like it has gone away.\n  Show the correct turn: It is still there as invisible vapour; cooled into clouds it falls back as rain and returns to the sea.\n- Narration reads aloud naturally to a Secondary school (O/N-level) student. Tone: direct, precise, exam-aware.\n  No jargon above the level. Short sentences.","user":"Level: secondary (Secondary school (O/N-level))\nSubject: science\nTopic: Water cycle (water-cycle)\nKind: concept\nStudent's focus: exam prep\n\nWrite the animation spec JSON now. Teach the concept from first principles; assume the student has only prior-level knowledge."};

test('system prompt carries the one-scene-per-transition instructions', () => {
  const system = Prompt.buildPrompts(waterCycleOpts(WATER_CYCLE)).system;
  for (const phrase of [
    'one scene per transition',
    'in the given order',
    'move step IS the state change',
    'from_state',
    'to_state',
    'driver must be visible',
    'acting on the subject',
    'not just named in a caption',
    'caption names the phase'
  ]) {
    assert.ok(system.indexOf(phrase) !== -1,
      'system prompt must instruct transition scenes: missing "' + phrase + '"');
  }
});

test('user message carries the transition data in order', () => {
  const user = Prompt.buildPrompts(waterCycleOpts(WATER_CYCLE)).user;
  const names = ['evaporation', 'condensation', 'precipitation', 'collection'];
  const states = ['liquid water', 'water vapour', 'liquid droplets', 'falling water',
    'gathered seas and rivers', 'the sun\'s heat', 'cooling', 'gravity'];
  for (const value of names.concat(states)) {
    assert.ok(user.indexOf(value) !== -1,
      'user message must carry the transition data: missing "' + value + '"');
  }
  // Exactly four numbered transition lines, in the unpacked order.
  const lines = user.split('\n').filter((l) => /^[1-9]\. /.test(l));
  assert.strictEqual(lines.length, 4, 'user message must list one line per transition');
  assert.deepStrictEqual(lines.map((l) => l.split('.')[0]), ['1', '2', '3', '4']);
  assert.ok(lines[0].indexOf('evaporation') !== -1 && lines[3].indexOf('collection') !== -1,
    'transition lines must follow the unpacked order');
  for (const line of lines) {
    assert.ok(line.indexOf('driver:') !== -1, 'each transition line must name the driver');
  }
});

test('transition field values are trimmed in the user message', () => {
  const user = Prompt.buildPrompts(waterCycleOpts([
    { name: '  evaporation  ', from_state: ' liquid water ', to_state: 'water vapour', driver: ' heat ' },
    { name: 'condensation', from_state: 'water vapour', to_state: 'droplets', driver: 'cooling' }
  ])).user;
  assert.ok(user.indexOf('1. evaporation: "liquid water" -> "water vapour" (driver: heat)') !== -1,
    'user message must render trimmed transition values');
});

test('no transitions: output is byte-identical to the pre-slice-2 baseline', () => {
  const out = Prompt.buildPrompts(waterCycleOpts(undefined));
  assert.deepStrictEqual(out, BASELINE,
    'buildPrompts without transitions must be byte-identical to before');
});

test('empty/null transitions behave like absent transitions', () => {
  for (const empty of [[], null]) {
    const out = Prompt.buildPrompts(waterCycleOpts(empty));
    assert.deepStrictEqual(out, BASELINE,
      'buildPrompts with transitions=' + JSON.stringify(empty) + ' must match the baseline');
  }
});

test('non-array transitions throw a descriptive error', () => {
  for (const bad of ['evaporation', 4, true, { name: 'evaporation' }]) {
    assert.throws(
      () => Prompt.buildPrompts(waterCycleOpts(bad)),
      (e) => e instanceof Error &&
        /buildPrompts: opts\.transitions must be an array/.test(e.message),
      'transitions=' + JSON.stringify(bad) + ' must throw a descriptive array error');
  }
});

test('transition counts outside 2-8 throw a descriptive error', () => {
  assert.throws(
    () => Prompt.buildPrompts(waterCycleOpts([WATER_CYCLE[0]])),
    /buildPrompts: opts\.transitions must hold 2-8 transitions, got 1/,
    'one transition must throw the count error');
  const nine = WATER_CYCLE.concat(WATER_CYCLE.slice(0, 4)).concat([WATER_CYCLE[0]]);
  assert.strictEqual(nine.length, 9);
  assert.throws(
    () => Prompt.buildPrompts(waterCycleOpts(nine)),
    /buildPrompts: opts\.transitions must hold 2-8 transitions, got 9/,
    'nine transitions must throw the count error');
});

test('transitions with missing or empty fields throw descriptive errors', () => {
  const cases = [
    ['null entry', [null, WATER_CYCLE[1]]],
    ['array entry', [['evaporation'], WATER_CYCLE[1]]],
    ['missing name', [{ from_state: 'a', to_state: 'b', driver: 'c' }, WATER_CYCLE[1]]],
    ['empty name', [{ name: '   ', from_state: 'a', to_state: 'b', driver: 'c' }, WATER_CYCLE[1]]],
    ['non-string from_state', [{ name: 'x', from_state: 42, to_state: 'b', driver: 'c' }, WATER_CYCLE[1]]],
    ['missing to_state', [{ name: 'x', from_state: 'a', driver: 'c' }, WATER_CYCLE[1]]],
    ['empty driver', [{ name: 'x', from_state: 'a', to_state: 'b', driver: '' }, WATER_CYCLE[1]]]
  ];
  for (const [label, transitions] of cases) {
    assert.throws(
      () => Prompt.buildPrompts(waterCycleOpts(transitions)),
      (e) => e instanceof Error && /buildPrompts: opts\.transitions\[0\]/.test(e.message),
      label + ' must throw a descriptive entry error');
  }
});

test('malformed transitions still throw when other opts are valid', () => {
  assert.throws(
    () => Prompt.buildPrompts({ subject: 'science', transitions: 'nope' }),
    /must be an array/,
    'validation must run before prompt assembly');
});

test('2 and 8 transitions are accepted (boundary counts)', () => {
  const two = Prompt.buildPrompts(waterCycleOpts(WATER_CYCLE.slice(0, 2)));
  assert.ok(two.user.indexOf('2. condensation') !== -1, '2 transitions must be accepted');
  const eight = WATER_CYCLE.concat(WATER_CYCLE);
  assert.strictEqual(eight.length, 8);
  const out = Prompt.buildPrompts(waterCycleOpts(eight));
  assert.ok(out.user.indexOf('8. collection') !== -1, '8 transitions must be accepted');
  assert.ok(out.system.indexOf('one scene per transition') !== -1,
    'system must carry the transition instructions at the boundary counts');
});
