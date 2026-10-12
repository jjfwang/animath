/* animath generate pipeline tests — zero network.
 * Guards generator/pipeline.js (issue #693): the automatic unpack ->
 * author -> repair pipeline with mock deps.callChat / deps.validate /
 * deps.onProgress. No LLM calls leave the process.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const PIPELINE = require('../generator/pipeline.js');

const TRANSITIONS = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' }
];
const TRANSITIONS_TEXT = JSON.stringify(TRANSITIONS);

const GOOD_SPEC = { title: 'Water cycle', scenes: [{ id: 's1' }] };
const GOOD_TEXT = JSON.stringify(GOOD_SPEC);
const BAD_SPEC = { title: 'Broken' }; // fails validate: no scenes array
const BAD_TEXT = JSON.stringify(BAD_SPEC);

// The author user prompt never asks for state transitions; the unpack one
// always does — reliable routing for the stub callChat.
function isUnpackCall(user) {
  return user.indexOf('ordered state transitions') !== -1;
}

function validate(spec) {
  return (spec && Array.isArray(spec.scenes)) ? [] : ['spec.scenes must be an array'];
}

const OPTS = {
  topic: 'water-cycle',
  topicLabel: 'Water cycle',
  level: 'primary',
  subject: 'science',
  kind: 'concept',
  focus: '',
  facet: null
};

// Records every callChat (system, user) and routes canned responses.
function stubChat(handler) {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    return Promise.resolve(handler(system, user, calls.length - 1));
  };
  return { calls, callChat };
}

function progressRecorder() {
  const events = [];
  return {
    events,
    onProgress: (stage, n, max) => { events.push([stage, n, max]); }
  };
}

test('full pipeline resolves the first clean spec and feeds unpack transitions to the author', async () => {
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : GOOD_TEXT);
  const rec = progressRecorder();
  const spec = await PIPELINE.generateAnimation(OPTS, {
    callChat, validate, onProgress: rec.onProgress
  });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.equal(calls.length, 2, 'one unpack call + one author call, no repairs');
  assert.ok(calls[1].system.indexOf('TRANSITION SCENES') !== -1,
    'author system prompt carries the transition-scenes block');
  assert.ok(calls[1].user.indexOf('evaporation') !== -1,
    'author user prompt carries the unpacked transition data');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('full pipeline works without onProgress', async () => {
  const { callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : GOOD_TEXT);
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
});

test('a throwing unpack call degrades to the no-transitions author path', async () => {
  const { calls, callChat } = stubChat((system, user) => {
    if (isUnpackCall(user)) throw new Error('model exploded');
    return GOOD_TEXT;
  });
  const rec = progressRecorder();
  const spec = await PIPELINE.generateAnimation(OPTS, {
    callChat, validate, onProgress: rec.onProgress
  });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.equal(calls.length, 2, 'failed unpack + one author call, no repairs');
  assert.ok(calls[1].system.indexOf('TRANSITION SCENES') === -1,
    'degraded author prompt has no transition-scenes block');
  assert.ok(calls[1].user.indexOf('evaporation') === -1,
    'degraded author prompt has no transition data');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('a rejecting unpack call degrades to the no-transitions author path', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    if (isUnpackCall(user)) return Promise.reject(new Error('network down'));
    return Promise.resolve(GOOD_TEXT);
  };
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.ok(calls[1].system.indexOf('TRANSITION SCENES') === -1);
});

test('an unparseable unpack response degrades to the no-transitions author path', async () => {
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? 'definitely not a JSON array of transitions' : GOOD_TEXT);
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.ok(calls[1].system.indexOf('TRANSITION SCENES') === -1,
    'unusable unpack parse degrades like a failed unpack call');
});

test('invalid JSON on the first attempt triggers a repair turn that resolves', async () => {
  const { calls, callChat } = stubChat((system, user, i) => {
    if (isUnpackCall(user)) return TRANSITIONS_TEXT;
    return i === 1 ? 'oops, not JSON at all' : GOOD_TEXT;
  });
  const rec = progressRecorder();
  const spec = await PIPELINE.generateAnimation(OPTS, {
    callChat, validate, onProgress: rec.onProgress
  });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('not valid JSON') !== -1,
    'repair turn explains the JSON failure');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('validator problems are repaired within the cap and surface in the repair prompt', async () => {
  const { calls, callChat } = stubChat((system, user, i) => {
    if (isUnpackCall(user)) return TRANSITIONS_TEXT;
    return i === 1 ? BAD_TEXT : GOOD_TEXT;
  });
  const rec = progressRecorder();
  const spec = await PIPELINE.generateAnimation(OPTS, {
    callChat, validate, onProgress: rec.onProgress
  });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.equal(calls.length, 3);
  assert.ok(calls[2].user.indexOf('spec.scenes must be an array') !== -1,
    'repair turn carries the validator problem');
  assert.ok(calls[2].user.indexOf(JSON.stringify(BAD_SPEC, null, 2)) !== -1,
    'repair turn carries the invalid spec');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('persistent failure rejects with the surfaced errors after exhausting the cap', async () => {
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : BAD_TEXT);
  const rec = progressRecorder();
  await assert.rejects(
    () => PIPELINE.generateAnimation(OPTS, { callChat, validate, onProgress: rec.onProgress }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(err.message.indexOf('still invalid after 3 repair attempt(s)') !== -1);
      assert.deepEqual(err.problems, ['spec.scenes must be an array']);
      return true;
    });
  assert.equal(calls.length, 5, 'unpack + author + 3 repairs');
  assert.deepEqual(rec.events, [
    ['unpack', 1, 1], ['author', 1, 1],
    ['repair', 1, 3], ['repair', 2, 3], ['repair', 3, 3]
  ]);
});

test('maxRepairs 0 rejects after the first failed attempt', async () => {
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : BAD_TEXT);
  await assert.rejects(
    () => PIPELINE.generateAnimation({ ...OPTS, maxRepairs: 0 }, { callChat, validate }),
    (err) => {
      assert.deepEqual(err.problems, ['spec.scenes must be an array']);
      return true;
    });
  assert.equal(calls.length, 2, 'unpack + author, no repairs');
});

test('explicit maxRepairs caps the repair turns', async () => {
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : BAD_TEXT);
  await assert.rejects(
    () => PIPELINE.generateAnimation({ ...OPTS, maxRepairs: 1 }, { callChat, validate }));
  assert.equal(calls.length, 3, 'unpack + author + 1 repair');
});

test('a fenced author response still parses', async () => {
  const { callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : '```json\n' + GOOD_TEXT + '\n```');
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
});

test('prose-wrapped author JSON parses via the brace-scan fallback', async () => {
  const { callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : 'Here is your spec: ' + GOOD_TEXT + ' — enjoy!');
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
});

test('missing subject rejects: unpack degrades but the author path still requires it', async () => {
  const { calls, callChat } = stubChat(() => GOOD_TEXT);
  await assert.rejects(
    () => PIPELINE.generateAnimation({ topic: 'water-cycle' }, { callChat, validate }),
    /subject is required/);
  assert.equal(calls.length, 0, 'no chat call happens when the subject is missing');
});

test('missing deps reject with a clear error', async () => {
  await assert.rejects(() => PIPELINE.generateAnimation(OPTS),
    /deps\.callChat\(system, user\) must be a function/);
  await assert.rejects(() => PIPELINE.generateAnimation(OPTS, {}),
    /deps\.callChat\(system, user\) must be a function/);
  await assert.rejects(() => PIPELINE.generateAnimation(OPTS, { callChat: () => {} }),
    /deps\.validate\(spec\) must be a function/);
});

test('a throwing onProgress listener never breaks generation', async () => {
  const { callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : GOOD_TEXT);
  const spec = await PIPELINE.generateAnimation(OPTS, {
    callChat,
    validate,
    onProgress: () => { throw new Error('listener bug'); }
  });
  assert.deepEqual(spec, GOOD_SPEC);
});

test('browser globals path: pipeline runs off window globals (web/index.html script order)', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js')
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-browser-globals.js' });
  const pipeline = sandbox.AnimathPipeline;
  assert.ok(pipeline && typeof pipeline.generateAnimation === 'function',
    'UMD sets the browser global');
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : GOOD_TEXT);
  const spec = await pipeline.generateAnimation(OPTS, { callChat, validate });
  // JSON comparison: the spec was built inside the vm sandbox, so its
  // objects carry the sandbox's prototypes, not the main realm's.
  assert.equal(JSON.stringify(spec), JSON.stringify(GOOD_SPEC));
  assert.equal(calls.length, 2, 'unpack + author through the browser-global siblings');
  assert.ok(calls[1].user.indexOf('evaporation') !== -1,
    'transitions flowed from the unpack global into the author prompt');
});

test('full pipeline attaches the misconception beat to the named transition before authoring', async () => {
  // OPTS uses topic 'water-cycle' and the stub unpack returns an
  // evaporation transition, so the author user prompt must name the
  // evaporation scene as the one where the wrong turn plays out.
  const { calls, callChat } = stubChat((system, user) =>
    isUnpackCall(user) ? TRANSITIONS_TEXT : GOOD_TEXT);
  const spec = await PIPELINE.generateAnimation(OPTS, { callChat, validate });
  assert.deepEqual(spec, GOOD_SPEC);
  assert.ok(calls[1].user.indexOf('Play out this wrong turn VISUALLY in the "evaporation" scene') !== -1,
    'the author user prompt must name the misconceived transition');
  assert.ok(calls[1].user.indexOf('Wrong turn: Water disappears for good once it evaporates.') !== -1,
    'the author user prompt must carry the water-cycle wrong turn');
});

test('full pipeline skips attachment on the degraded no-transitions path', async () => {
  // A throwing unpack degrades to null; attachMisconceptions must never
  // run on null and the author prompt keeps the topic-wide generic line.
  const unknownOpts = Object.assign({}, OPTS, { topic: 'pythagoras' });
  const { calls, callChat } = stubChat((system, user) => {
    if (isUnpackCall(user)) throw new Error('model exploded');
    return GOOD_TEXT;
  });
  await PIPELINE.generateAnimation(unknownOpts, { callChat, validate });
  assert.ok(calls[1].system.indexOf('TRANSITION SCENES') === -1,
    'degraded author prompt has no transition-scenes block');
  assert.ok(calls[1].user.indexOf('Play out this wrong turn VISUALLY') === -1,
    'degraded author prompt carries no per-transition beat');
});
