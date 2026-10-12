/* animath staging-shape tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * Guards the staging strategy (owner direction 2026-10-12): the unpacker
 * classifies a topic's shape — sequence, cycle, or system — and the author
 * prompt stages scenes accordingly. A cycle (water cycle) gets ONE holistic
 * scene showing the whole loop at once; a sequence keeps the
 * one-scene-per-transition mapping; a system gets one scene of interacting
 * parts. Legacy bare-array unpack responses still parse (shape: sequence),
 * so pre-shape behavior is byte-identical.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Unpack = require('../generator/unpack.js');
const Prompt = require('../generator/build_prompt.js');
const PIPELINE = require('../generator/pipeline.js');

const WATER_CYCLE = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' },
  { name: 'precipitation', from_state: 'droplets', to_state: 'falling water', driver: 'gravity' },
  { name: 'collection', from_state: 'fallen water', to_state: 'gathered seas and rivers', driver: 'gravity' }
];

const CYCLE_TEXT = JSON.stringify({ shape: 'cycle', transitions: WATER_CYCLE });
const SEQUENCE_TEXT = JSON.stringify({ shape: 'sequence', transitions: WATER_CYCLE.slice(0, 2) });
const SYSTEM_TEXT = JSON.stringify({ shape: 'system', transitions: WATER_CYCLE.slice(0, 2) });
const LEGACY_ARRAY_TEXT = JSON.stringify(WATER_CYCLE);

// --- unpack: parseUnpackResponse ---

test('parseUnpackResponse parses the object form with shape cycle', () => {
  const out = Unpack.parseUnpackResponse(CYCLE_TEXT);
  assert.equal(out.shape, 'cycle');
  assert.deepEqual(out.transitions, WATER_CYCLE);
});

test('parseUnpackResponse accepts the legacy bare array as shape sequence', () => {
  const out = Unpack.parseUnpackResponse(LEGACY_ARRAY_TEXT);
  assert.equal(out.shape, 'sequence');
  assert.deepEqual(out.transitions, WATER_CYCLE);
});

test('parseUnpackResponse throws on an unknown shape', () => {
  assert.throws(
    () => Unpack.parseUnpackResponse(JSON.stringify({ shape: 'spiral', transitions: WATER_CYCLE.slice(0, 2) })),
    /"shape" must be one of sequence, cycle, system/
  );
});

test('parseUnpackResponse throws when the object form lacks transitions', () => {
  assert.throws(
    () => Unpack.parseUnpackResponse(JSON.stringify({ shape: 'cycle' })),
    /needs a "transitions" array/
  );
});

test('parseUnpackResponse throws on empty input', () => {
  assert.throws(() => Unpack.parseUnpackResponse('   '), /non-empty model response text/);
});

test('parseUnpackResponse handles prose-wrapped object responses', () => {
  const out = Unpack.parseUnpackResponse('Here is the unpack:\n' + CYCLE_TEXT + '\nDone.');
  assert.equal(out.shape, 'cycle');
  assert.equal(out.transitions.length, 4);
});

test('parseUnpackResponse validates the transitions inside the object form', () => {
  const bad = [
    { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
    { name: 'condensation', from_state: '', to_state: 'liquid droplets', driver: 'cooling' }
  ];
  assert.throws(
    () => Unpack.parseUnpackResponse(JSON.stringify({ shape: 'cycle', transitions: bad })),
    /"from_state" must be a non-empty string/
  );
});

test('parseTransitions still returns the plain array for both forms', () => {
  assert.deepEqual(Unpack.parseTransitions(LEGACY_ARRAY_TEXT), WATER_CYCLE);
  assert.deepEqual(Unpack.parseTransitions(CYCLE_TEXT), WATER_CYCLE);
});

test('unpack system prompt asks for the shape classification', () => {
  const { system } = Unpack.buildUnpackPrompts('water cycle', { subject: 'science', level: 'primary' });
  for (const phrase of ['"shape"', '"sequence"', '"cycle"', '"system"', 'staging shape', 'the loop must close']) {
    assert.ok(system.indexOf(phrase) !== -1, 'unpack system prompt must mention ' + phrase);
  }
});

test('SHAPES export lists the three staging shapes', () => {
  assert.deepEqual(Unpack.SHAPES, ['sequence', 'cycle', 'system']);
});

// --- build_prompt: staging dispatch ---

function cycleOpts() {
  return {
    level: 'primary', subject: 'science', topic: 'water-cycle',
    topicLabel: 'Water cycle', kind: 'concept', transitions: WATER_CYCLE, shape: 'cycle'
  };
}

test('cycle shape stages one holistic scene, not one scene per transition', () => {
  const system = Prompt.buildPrompts(cycleOpts()).system;
  for (const phrase of [
    'ONE single holistic scene',
    'closed loop',
    'the looping itself is the concept',
    'see the whole cycle in one frame',
    'Animate FLOWS along the loop'
  ]) {
    assert.ok(system.indexOf(phrase) !== -1, 'cycle staging block missing "' + phrase + '"');
  }
  assert.ok(system.indexOf('one scene per transition') === -1,
    'cycle staging must not carry the sequence one-scene-per-transition block');
});

test('cycle shape user block names the holistic staging', () => {
  const user = Prompt.buildPrompts(cycleOpts()).user;
  assert.ok(user.indexOf('one holistic cycle scene') !== -1,
    'cycle user block must name the holistic staging');
  assert.ok(user.indexOf('evaporation') !== -1, 'cycle user block keeps the transition data');
});

test('system shape stages interacting parts in one scene', () => {
  const system = Prompt.buildPrompts(Object.assign(cycleOpts(), { shape: 'system' })).system;
  assert.ok(system.indexOf('SYSTEM STAGING') !== -1, 'system staging block missing');
  assert.ok(system.indexOf('interacting') !== -1, 'system staging must name interacting parts');
  assert.ok(system.indexOf('one scene per transition') === -1,
    'system staging must not carry the sequence block');
});

test('sequence shape keeps the one-scene-per-transition mapping', () => {
  const system = Prompt.buildPrompts(Object.assign(cycleOpts(), { shape: 'sequence' })).system;
  assert.ok(system.indexOf('one scene per transition') !== -1,
    'sequence staging must keep the transition-scenes block');
  assert.ok(system.indexOf('ONE single holistic scene') === -1,
    'sequence staging must not carry the cycle block');
});

test('omitted shape defaults to sequence staging', () => {
  const opts = cycleOpts();
  delete opts.shape;
  const system = Prompt.buildPrompts(opts).system;
  assert.ok(system.indexOf('one scene per transition') !== -1,
    'missing shape must default to the sequence staging');
});

test('invalid shape throws a descriptive error', () => {
  assert.throws(
    () => Prompt.buildPrompts(Object.assign(cycleOpts(), { shape: 'spiral' })),
    /opts\.shape must be one of sequence, cycle, system/
  );
});

test('shape is ignored when there are no transitions', () => {
  const base = { level: 'primary', subject: 'science', topic: 'water-cycle', topicLabel: 'Water cycle' };
  const a = Prompt.buildPrompts(base);
  const b = Prompt.buildPrompts(Object.assign({ shape: 'cycle' }, base));
  assert.equal(a.system, b.system, 'shape must not change the no-transitions prompt');
  assert.equal(a.user, b.user, 'shape must not change the no-transitions user message');
});

// --- pipeline: shape flows from unpack to author ---

const GOOD_SPEC = { title: 'Water cycle', scenes: [{ id: 's1' }] };

test('pipeline feeds the unpacked cycle shape to the author prompt', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    const isUnpack = user.indexOf('ordered state transitions') !== -1;
    return Promise.resolve(isUnpack ? CYCLE_TEXT : JSON.stringify(GOOD_SPEC));
  };
  const spec = await PIPELINE.generateAnimation(
    { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science', kind: 'concept' },
    { callChat, validate: () => [] }
  );
  assert.deepEqual(spec, GOOD_SPEC);
  assert.ok(calls[1].system.indexOf('ONE single holistic scene') !== -1,
    'author system prompt must carry the cycle staging block');
});

test('pipeline degrades a legacy array unpack to sequence staging', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    const isUnpack = user.indexOf('ordered state transitions') !== -1;
    return Promise.resolve(isUnpack ? LEGACY_ARRAY_TEXT : JSON.stringify(GOOD_SPEC));
  };
  await PIPELINE.generateAnimation(
    { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science', kind: 'concept' },
    { callChat, validate: () => [] }
  );
  assert.ok(calls[1].system.indexOf('one scene per transition') !== -1,
    'legacy array unpack must stage as sequence');
});

// --- validator: 1..8 scenes (holistic cycle/system staging) ---

const Validate = require('../player/validate.js');

function oneSceneSpec(n) {
  const scenes = [];
  for (let i = 0; i < n; i++) {
    scenes.push({
      id: 's' + (i + 1), caption: 'scene ' + (i + 1), narration: 'narr',
      duration_ms: 4000,
      steps: [{ at_ms: 0, do: 'show', shape: { id: 'r' + i, kind: 'rect', x: 5, y: 5, w: 20, h: 20 } }]
    });
  }
  return {
    animath: '0.1', title: 't', level: 'primary', subject: 'science',
    topic: 'water-cycle', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: scenes
  };
}

test('validator accepts a single holistic scene', () => {
  assert.deepEqual(Validate.validateSpec(oneSceneSpec(1)), [],
    'one scene must validate: holistic cycle/system staging');
});

test('validator still rejects zero scenes', () => {
  const problems = Validate.validateSpec(oneSceneSpec(0));
  assert.ok(problems.some((p) => p.indexOf('1..8 scenes') !== -1),
    'zero scenes must be rejected, got: ' + problems.join('; '));
});

test('validator still rejects nine scenes', () => {
  const problems = Validate.validateSpec(oneSceneSpec(9));
  assert.ok(problems.some((p) => p.indexOf('1..8 scenes') !== -1),
    'nine scenes must be rejected, got: ' + problems.join('; '));
});
