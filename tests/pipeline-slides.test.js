/* animath generateSlides pipeline tests — zero network.
 * Guards generator/pipeline.js generateSlides (issue #747): the slide-deck
 * sibling of generateAnimation — same unpack -> author -> repair stages,
 * author prompts from build_slides_prompt.js, validation through
 * validateSlides (deps.validateSlides, else deps.validate, else the
 * built-in player/validate.js validateSlides). No LLM calls leave the
 * process; deps.callChat is stubbed throughout.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const PIPELINE = require('../generator/pipeline.js');
const { validateSlides } = require('../player/validate.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'decks', 'primary-science-water-cycle.json');
const GOLD_DECK = JSON.parse(fs.readFileSync(GOLD_PATH, 'utf8'));
const GOLD_TEXT = JSON.stringify(GOLD_DECK);

const TRANSITIONS = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' }
];
const TRANSITIONS_TEXT = JSON.stringify(TRANSITIONS);

const OPTS = {
  topic: 'water-cycle',
  topicLabel: 'Water cycle',
  level: 'primary',
  subject: 'science'
};

// Routing for the stub callChat: the unpack system prompt names the
// "topic unpacker", the slide author system prompt names the
// "slide-deck author" (repair turns reuse the author system prompt).
function isUnpackCall(system) {
  return system.indexOf('topic unpacker') !== -1;
}
function isSlidesCall(system) {
  return system.indexOf('slide-deck author') !== -1;
}

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

test('happy path: built-in validateSlides default resolves the gold deck', async () => {
  const workedExample = 'Example: trace one drop from sea to cloud to rain to sea.';
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  const rec = progressRecorder();
  // No deps.validate / deps.validateSlides: the built-in
  // player/validate.js validateSlides is the default validator.
  const deck = await PIPELINE.generateSlides(
    { ...OPTS, workedExample },
    { callChat, onProgress: rec.onProgress });
  assert.deepEqual(deck, GOLD_DECK);
  assert.equal(calls.length, 2, 'one unpack call + one author call, no repairs');
  assert.ok(isSlidesCall(calls[1].system), 'author call uses the slide-deck author prompt');
  assert.ok(calls[1].user.indexOf('evaporation') !== -1,
    'author user prompt carries the unpacked transition data');
  assert.ok(calls[1].user.indexOf(workedExample) !== -1,
    'author user prompt carries opts.workedExample');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('repair: non-JSON first response is repaired with slide-deck wording', async () => {
  let slidesCalls = 0;
  const { calls, callChat } = stubChat((system) => {
    if (isUnpackCall(system)) return TRANSITIONS_TEXT;
    slidesCalls += 1;
    return slidesCalls === 1 ? 'oops, not JSON at all' : GOLD_TEXT;
  });
  const rec = progressRecorder();
  const deck = await PIPELINE.generateSlides(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(deck, GOLD_DECK);
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('did not produce a valid slide deck') !== -1,
    'repair prompt carries the slide-deck wording');
  assert.ok(calls[2].user.indexOf(
    'The response was not valid JSON. Return ONLY the corrected slide deck as JSON.') !== -1,
    'repair prompt carries the not-valid-JSON problem');
  assert.ok(calls[2].user.indexOf('Return ONLY the corrected slide deck as a single JSON object.') !== -1,
    'repair prompt asks for the corrected slide deck');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('exhaustion: always-invalid decks reject with validateSlides problems', async () => {
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : '{}');
  await assert.rejects(
    () => PIPELINE.generateSlides({ ...OPTS, maxRepairs: 1 }, { callChat }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /still invalid after 1 repair attempt/);
      assert.ok(Array.isArray(err.problems) && err.problems.length > 0,
        'err.problems is a non-empty array');
      assert.deepEqual(err.problems, validateSlides({}),
        'err.problems comes from validateSlides');
      return true;
    });
  assert.equal(calls.length, 3, 'unpack + author + 1 repair');
});

test('missing deps: no callChat rejects naming callChat', async () => {
  await assert.rejects(() => PIPELINE.generateSlides(OPTS), /callChat/);
  await assert.rejects(() => PIPELINE.generateSlides(OPTS, {}), /callChat/);
});

test('deps.validateSlides is honoured over the built-in validator', async () => {
  const seen = [];
  const validateSlidesSpy = (deck) => { seen.push(deck); return []; };
  const minimal = { title: 'Minimal deck' }; // invalid for the real validateSlides
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const deck = await PIPELINE.generateSlides(OPTS, {
    callChat, validateSlides: validateSlidesSpy
  });
  assert.deepEqual(deck, minimal);
  assert.deepEqual(seen, [minimal], 'the custom validateSlides received the authored deck');
});

test('a custom validateSlides returning problems drives the repair loop', async () => {
  let validations = 0;
  const validateSlidesSpy = () => {
    validations += 1;
    return validations === 1 ? ['custom problem: deck too thin'] : [];
  };
  const minimal = { title: 'Minimal deck' };
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const rec = progressRecorder();
  const deck = await PIPELINE.generateSlides(OPTS, {
    callChat, validateSlides: validateSlidesSpy, onProgress: rec.onProgress
  });
  assert.deepEqual(deck, minimal);
  assert.equal(validations, 2, 'validator ran on the author attempt and the repair attempt');
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('custom problem: deck too thin') !== -1,
    'repair prompt carries the custom validator problem');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('deps.validate is the fallback when validateSlides is not supplied', async () => {
  const seen = [];
  const validateSpy = (deck) => { seen.push(deck); return []; };
  const minimal = { title: 'Minimal deck' };
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const deck = await PIPELINE.generateSlides(OPTS, {
    callChat, validate: validateSpy
  });
  assert.deepEqual(deck, minimal);
  assert.deepEqual(seen, [minimal], 'deps.validate received the authored deck');
});

test('degraded unpack: a rejecting unpack call still resolves a valid deck', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    if (isUnpackCall(system)) return Promise.reject(new Error('network down'));
    return Promise.resolve(GOLD_TEXT);
  };
  const rec = progressRecorder();
  const deck = await PIPELINE.generateSlides(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(deck, GOLD_DECK);
  assert.equal(calls.length, 2, 'failed unpack + one author call, no repairs');
  assert.ok(calls[1].system.indexOf('TRANSITION MECHANISM SLIDES') === -1,
    'degraded author prompt has no transition block');
  assert.ok(calls[1].user.indexOf('Ordered state transitions') === -1,
    'author was called without transitions');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('browser globals path: no validator global rejects naming validateSlides', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js')
    // No AnimathValidate: no slide validator is available anywhere.
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-slides-no-validator.js' });
  const { callChat } = stubChat(() => GOLD_TEXT);
  await assert.rejects(
    () => sandbox.AnimathPipeline.generateSlides(OPTS, { callChat }),
    /validateSlides/);
});

test('browser globals path: generateSlides runs off window globals', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js'),
    AnimathValidate: require('../player/validate.js')
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-slides-browser-globals.js' });
  const pipeline = sandbox.AnimathPipeline;
  assert.ok(pipeline && typeof pipeline.generateSlides === 'function',
    'UMD sets the browser global with generateSlides');
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  // No validate deps: the AnimathValidate global supplies validateSlides.
  const deck = await pipeline.generateSlides(OPTS, { callChat });
  assert.equal(JSON.stringify(deck), JSON.stringify(GOLD_DECK));
  assert.equal(calls.length, 2, 'unpack + author through the browser-global siblings');
});
