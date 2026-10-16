/* animath generateWorksheet pipeline tests — zero network.
 * Guards generator/pipeline.js generateWorksheet (issue #760): the
 * worksheet sibling of generateSlides — same unpack -> author -> repair
 * stages, author prompts from build_worksheet_prompt.js, validation
 * through validateWorksheet (deps.validateWorksheet, else deps.validate,
 * else the built-in player/validate.js validateWorksheet). No LLM calls
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
const { validateWorksheet } = require('../player/validate.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'worksheets', 'primary-science-water-cycle.json');
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
// "topic unpacker", the worksheet author system prompt names the
// "worksheet author" (repair turns reuse the author system prompt).
function isUnpackCall(system) {
  return system.indexOf('topic unpacker') !== -1;
}
function isWorksheetCall(system) {
  return system.indexOf('worksheet author') !== -1;
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

test('happy path: built-in validateWorksheet default resolves the gold worksheet', async () => {
  const workedExample = 'Example: trace one drop from sea to cloud to rain to sea.';
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  const rec = progressRecorder();
  // No deps.validate / deps.validateWorksheet: the built-in
  // player/validate.js validateWorksheet is the default validator.
  const doc = await PIPELINE.generateWorksheet(
    { ...OPTS, workedExample },
    { callChat, onProgress: rec.onProgress });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'one unpack call + one author call, no repairs');
  assert.ok(isWorksheetCall(calls[1].system), 'author call uses the worksheet author prompt');
  assert.ok(calls[1].user.indexOf('evaporation') !== -1,
    'author user prompt carries the unpacked transition data');
  assert.ok(calls[1].user.indexOf(workedExample) !== -1,
    'author user prompt carries opts.workedExample');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('repair: non-JSON first response is repaired with worksheet wording', async () => {
  let authorCalls = 0;
  const { calls, callChat } = stubChat((system) => {
    if (isUnpackCall(system)) return TRANSITIONS_TEXT;
    authorCalls += 1;
    return authorCalls === 1 ? 'oops, not JSON at all' : GOLD_TEXT;
  });
  const rec = progressRecorder();
  const doc = await PIPELINE.generateWorksheet(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('did not produce a valid worksheet') !== -1,
    'repair prompt carries the worksheet wording');
  assert.ok(calls[2].user.indexOf(
    'The response was not valid JSON. Return ONLY the corrected worksheet as JSON.') !== -1,
    'repair prompt carries the not-valid-JSON problem');
  assert.ok(calls[2].user.indexOf('Return ONLY the corrected worksheet as a single JSON object.') !== -1,
    'repair prompt asks for the corrected worksheet');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('exhaustion: always-invalid worksheets reject with validateWorksheet problems', async () => {
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : '{}');
  await assert.rejects(
    () => PIPELINE.generateWorksheet({ ...OPTS, maxRepairs: 1 }, { callChat }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /still invalid after 1 repair attempt/);
      assert.ok(Array.isArray(err.problems) && err.problems.length > 0,
        'err.problems is a non-empty array');
      assert.deepEqual(err.problems, validateWorksheet({}),
        'err.problems comes from validateWorksheet');
      return true;
    });
  assert.equal(calls.length, 3, 'unpack + author + 1 repair');
});

test('missing deps: no callChat rejects naming callChat', async () => {
  await assert.rejects(() => PIPELINE.generateWorksheet(OPTS), /callChat/);
  await assert.rejects(() => PIPELINE.generateWorksheet(OPTS, {}), /callChat/);
});

test('deps.validateWorksheet is honoured over the built-in validator', async () => {
  const seen = [];
  const validateWorksheetSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal worksheet' }; // invalid for the real validateWorksheet
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateWorksheet(OPTS, {
    callChat, validateWorksheet: validateWorksheetSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'the custom validateWorksheet received the authored worksheet');
});

test('a custom validateWorksheet returning problems drives the repair loop', async () => {
  let validations = 0;
  const validateWorksheetSpy = () => {
    validations += 1;
    return validations === 1 ? ['custom problem: worksheet too thin'] : [];
  };
  const minimal = { title: 'Minimal worksheet' };
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const rec = progressRecorder();
  const doc = await PIPELINE.generateWorksheet(OPTS, {
    callChat, validateWorksheet: validateWorksheetSpy, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, minimal);
  assert.equal(validations, 2, 'validator ran on the author attempt and the repair attempt');
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('custom problem: worksheet too thin') !== -1,
    'repair prompt carries the custom validator problem');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('deps.validate is the fallback when validateWorksheet is not supplied', async () => {
  const seen = [];
  const validateSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal worksheet' };
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateWorksheet(OPTS, {
    callChat, validate: validateSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'deps.validate received the authored worksheet');
});

test('degraded unpack: a rejecting unpack call still resolves a valid worksheet', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    if (isUnpackCall(system)) return Promise.reject(new Error('network down'));
    return Promise.resolve(GOLD_TEXT);
  };
  const rec = progressRecorder();
  const doc = await PIPELINE.generateWorksheet(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'failed unpack + one author call, no repairs');
  assert.ok(calls[1].user.indexOf('Ordered state transitions') === -1,
    'author was called without transitions');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('browser globals path: no validator global rejects naming validateWorksheet', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js'),
    AnimathWorksheetPrompt: require('../generator/build_worksheet_prompt.js'),
    AnimathExitTicketPrompt: require('../generator/build_exit_ticket_prompt.js')
    // No AnimathValidate: no worksheet validator is available anywhere.
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-worksheet-no-validator.js' });
  const { callChat } = stubChat(() => GOLD_TEXT);
  await assert.rejects(
    () => sandbox.AnimathPipeline.generateWorksheet(OPTS, { callChat }),
    /validateWorksheet/);
});

test('browser globals path: generateWorksheet runs off window globals', async () => {
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
  vm.runInContext(src, sandbox, { filename: 'pipeline-worksheet-browser-globals.js' });
  const pipeline = sandbox.AnimathPipeline;
  assert.ok(pipeline && typeof pipeline.generateWorksheet === 'function',
    'UMD sets the browser global with generateWorksheet');
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  // No validate deps: the AnimathValidate global supplies validateWorksheet.
  const doc = await pipeline.generateWorksheet(OPTS, { callChat });
  assert.equal(JSON.stringify(doc), JSON.stringify(GOLD_DOC));
  assert.equal(calls.length, 2, 'unpack + author through the browser-global siblings');
});
