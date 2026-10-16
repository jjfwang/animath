/* animath generateExitTicket pipeline tests — zero network.
 * Guards generator/pipeline.js generateExitTicket (issue #760): the
 * exit-ticket sibling of generateSlides — same unpack -> author -> repair
 * stages, author prompts from build_exit_ticket_prompt.js, validation
 * through validateExitTicket (deps.validateExitTicket, else deps.validate,
 * else the built-in player/validate.js validateExitTicket). No LLM calls
 * leave the process; deps.callChat is stubbed throughout.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const PIPELINE = require('../generator/pipeline.js');
const { validateExitTicket } = require('../player/validate.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'tickets', 'primary-science-water-cycle.json');
const GOLD_DOC = JSON.parse(fs.readFileSync(GOLD_PATH, 'utf8'));
const GOLD_TEXT = JSON.stringify(GOLD_DOC);

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
// "topic unpacker", the exit-ticket author system prompt names the
// "exit-ticket author" (repair turns reuse the author system prompt).
function isUnpackCall(system) {
  return system.indexOf('topic unpacker') !== -1;
}
function isExitTicketCall(system) {
  return system.indexOf('exit-ticket author') !== -1;
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

test('happy path: built-in validateExitTicket default resolves the gold exit ticket', async () => {
  const workedExample = 'Example: trace one drop from sea to cloud to rain to sea.';
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  const rec = progressRecorder();
  // No deps.validate / deps.validateExitTicket: the built-in
  // player/validate.js validateExitTicket is the default validator.
  const doc = await PIPELINE.generateExitTicket(
    { ...OPTS, workedExample },
    { callChat, onProgress: rec.onProgress });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'one unpack call + one author call, no repairs');
  assert.ok(isExitTicketCall(calls[1].system), 'author call uses the exit-ticket author prompt');
  assert.ok(calls[1].user.indexOf('evaporation') !== -1,
    'author user prompt carries the unpacked transition data');
  assert.ok(calls[1].user.indexOf(workedExample) !== -1,
    'author user prompt carries opts.workedExample');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('repair: non-JSON first response is repaired with exit-ticket wording', async () => {
  let authorCalls = 0;
  const { calls, callChat } = stubChat((system) => {
    if (isUnpackCall(system)) return TRANSITIONS_TEXT;
    authorCalls += 1;
    return authorCalls === 1 ? 'oops, not JSON at all' : GOLD_TEXT;
  });
  const rec = progressRecorder();
  const doc = await PIPELINE.generateExitTicket(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('did not produce a valid exit ticket') !== -1,
    'repair prompt carries the exit-ticket wording');
  assert.ok(calls[2].user.indexOf(
    'The response was not valid JSON. Return ONLY the corrected exit ticket as JSON.') !== -1,
    'repair prompt carries the not-valid-JSON problem');
  assert.ok(calls[2].user.indexOf('Return ONLY the corrected exit ticket as a single JSON object.') !== -1,
    'repair prompt asks for the corrected exit ticket');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('exhaustion: always-invalid exit tickets reject with validateExitTicket problems', async () => {
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : '{}');
  await assert.rejects(
    () => PIPELINE.generateExitTicket({ ...OPTS, maxRepairs: 1 }, { callChat }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /still invalid after 1 repair attempt/);
      assert.ok(Array.isArray(err.problems) && err.problems.length > 0,
        'err.problems is a non-empty array');
      assert.deepEqual(err.problems, validateExitTicket({}),
        'err.problems comes from validateExitTicket');
      return true;
    });
  assert.equal(calls.length, 3, 'unpack + author + 1 repair');
});

test('missing deps: no callChat rejects naming callChat', async () => {
  await assert.rejects(() => PIPELINE.generateExitTicket(OPTS), /callChat/);
  await assert.rejects(() => PIPELINE.generateExitTicket(OPTS, {}), /callChat/);
});

test('deps.validateExitTicket is honoured over the built-in validator', async () => {
  const seen = [];
  const validateExitTicketSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal exit ticket' }; // invalid for the real validateExitTicket
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateExitTicket(OPTS, {
    callChat, validateExitTicket: validateExitTicketSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'the custom validateExitTicket received the authored exit ticket');
});

test('a custom validateExitTicket returning problems drives the repair loop', async () => {
  let validations = 0;
  const validateExitTicketSpy = () => {
    validations += 1;
    return validations === 1 ? ['custom problem: exit ticket too thin'] : [];
  };
  const minimal = { title: 'Minimal exit ticket' };
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const rec = progressRecorder();
  const doc = await PIPELINE.generateExitTicket(OPTS, {
    callChat, validateExitTicket: validateExitTicketSpy, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, minimal);
  assert.equal(validations, 2, 'validator ran on the author attempt and the repair attempt');
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('custom problem: exit ticket too thin') !== -1,
    'repair prompt carries the custom validator problem');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('deps.validate is the fallback when validateExitTicket is not supplied', async () => {
  const seen = [];
  const validateSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal exit ticket' };
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateExitTicket(OPTS, {
    callChat, validate: validateSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'deps.validate received the authored exit ticket');
});

test('degraded unpack: a rejecting unpack call still resolves a valid exit ticket', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    if (isUnpackCall(system)) return Promise.reject(new Error('network down'));
    return Promise.resolve(GOLD_TEXT);
  };
  const rec = progressRecorder();
  const doc = await PIPELINE.generateExitTicket(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'failed unpack + one author call, no repairs');
  assert.ok(calls[1].user.indexOf('Ordered state transitions') === -1,
    'author was called without transitions');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('browser globals path: no validator global rejects naming validateExitTicket', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js'),
    AnimathWorksheetPrompt: require('../generator/build_worksheet_prompt.js'),
    AnimathExitTicketPrompt: require('../generator/build_exit_ticket_prompt.js')
    // No AnimathValidate: no exit-ticket validator is available anywhere.
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-exit-ticket-no-validator.js' });
  const { callChat } = stubChat(() => GOLD_TEXT);
  await assert.rejects(
    () => sandbox.AnimathPipeline.generateExitTicket(OPTS, { callChat }),
    /validateExitTicket/);
});

test('browser globals path: generateExitTicket runs off window globals', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js'),
    AnimathWorksheetPrompt: require('../generator/build_worksheet_prompt.js'),
    AnimathExitTicketPrompt: require('../generator/build_exit_ticket_prompt.js'),
    AnimathValidate: require('../player/validate.js')
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-exit-ticket-browser-globals.js' });
  const pipeline = sandbox.AnimathPipeline;
  assert.ok(pipeline && typeof pipeline.generateExitTicket === 'function',
    'UMD sets the browser global with generateExitTicket');
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  // No validate deps: the AnimathValidate global supplies validateExitTicket.
  const doc = await pipeline.generateExitTicket(OPTS, { callChat });
  assert.equal(JSON.stringify(doc), JSON.stringify(GOLD_DOC));
  assert.equal(calls.length, 2, 'unpack + author through the browser-global siblings');
});
