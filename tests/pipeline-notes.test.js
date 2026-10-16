/* animath generateNotes pipeline tests — zero network.
 * Guards generator/pipeline.js generateNotes (issue #768): the student
 * notes sibling of generateSlides — same unpack -> author -> repair
 * stages, author prompts from build_notes_prompt.js, validation through
 * validateNotes (deps.validateNotes, else deps.validate, else the
 * built-in player/validate.js validateNotes). No LLM calls leave the
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
const { validateNotes } = require('../player/validate.js');

const GOLD_PATH = path.join(__dirname, '..', 'samples', 'notes', 'primary-science-water-cycle.json');
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

function isUnpackCall(system) {
  return system.indexOf('topic unpacker') !== -1;
}
function isNotesCall(system) {
  return system.indexOf('notes author') !== -1;
}

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

test('happy path: built-in validateNotes default resolves the gold notes', async () => {
  const workedExample = 'Example: trace one drop from sea to cloud to rain to sea.';
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  const rec = progressRecorder();
  const doc = await PIPELINE.generateNotes(
    { ...OPTS, workedExample },
    { callChat, onProgress: rec.onProgress });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'one unpack call + one author call, no repairs');
  assert.ok(isNotesCall(calls[1].system), 'author call uses the notes author prompt');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

test('repair: non-JSON first response is repaired with notes wording', async () => {
  let authorCalls = 0;
  const { calls, callChat } = stubChat((system) => {
    if (isUnpackCall(system)) return TRANSITIONS_TEXT;
    authorCalls += 1;
    return authorCalls === 1 ? 'oops, not JSON at all' : GOLD_TEXT;
  });
  const rec = progressRecorder();
  const doc = await PIPELINE.generateNotes(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('did not produce valid student notes') !== -1,
    'repair prompt carries the notes wording');
  assert.ok(calls[2].user.indexOf(
    'The response was not valid JSON. Return ONLY the corrected student notes as JSON.') !== -1,
    'repair prompt carries the not-valid-JSON problem');
  assert.ok(calls[2].user.indexOf('Return ONLY the corrected student notes as a single JSON object.') !== -1,
    'repair prompt asks for the corrected student notes');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('exhaustion: always-invalid notes reject with validateNotes problems', async () => {
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : '{}');
  await assert.rejects(
    () => PIPELINE.generateNotes({ ...OPTS, maxRepairs: 1 }, { callChat }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Student notes still invalid after 1 repair attempt/);
      assert.ok(Array.isArray(err.problems) && err.problems.length > 0,
        'err.problems is a non-empty array');
      assert.deepEqual(err.problems, validateNotes({}),
        'err.problems comes from validateNotes');
      return true;
    });
  assert.equal(calls.length, 3, 'unpack + author + 1 repair');
});

test('missing deps: no callChat rejects naming callChat', async () => {
  await assert.rejects(() => PIPELINE.generateNotes(OPTS), /callChat/);
  await assert.rejects(() => PIPELINE.generateNotes(OPTS, {}), /callChat/);
});

test('deps.validateNotes is honoured over the built-in validator', async () => {
  const seen = [];
  const validateNotesSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal notes' };
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateNotes(OPTS, {
    callChat, validateNotes: validateNotesSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'the custom validateNotes received the authored notes');
});

test('a custom validateNotes returning problems drives the repair loop', async () => {
  let validations = 0;
  const validateNotesSpy = () => {
    validations += 1;
    return validations === 1 ? ['custom problem: notes too thin'] : [];
  };
  const minimal = { title: 'Minimal notes' };
  const { calls, callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const rec = progressRecorder();
  const doc = await PIPELINE.generateNotes(OPTS, {
    callChat, validateNotes: validateNotesSpy, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, minimal);
  assert.equal(validations, 2, 'validator ran on the author attempt and the repair attempt');
  assert.equal(calls.length, 3, 'unpack + author + one repair');
  assert.ok(calls[2].user.indexOf('custom problem: notes too thin') !== -1,
    'repair prompt carries the custom validator problem');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1], ['repair', 1, 3]]);
});

test('deps.validate is the fallback when validateNotes is not supplied', async () => {
  const seen = [];
  const validateSpy = (doc) => { seen.push(doc); return []; };
  const minimal = { title: 'Minimal notes' };
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : JSON.stringify(minimal));
  const doc = await PIPELINE.generateNotes(OPTS, {
    callChat, validate: validateSpy
  });
  assert.deepEqual(doc, minimal);
  assert.deepEqual(seen, [minimal], 'deps.validate received the authored notes');
});

test('degraded unpack: a rejecting unpack call still resolves valid notes', async () => {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    if (isUnpackCall(system)) return Promise.reject(new Error('network down'));
    return Promise.resolve(GOLD_TEXT);
  };
  const rec = progressRecorder();
  const doc = await PIPELINE.generateNotes(OPTS, {
    callChat, onProgress: rec.onProgress
  });
  assert.deepEqual(doc, GOLD_DOC);
  assert.equal(calls.length, 2, 'failed unpack + one author call, no repairs');
  assert.deepEqual(rec.events, [['unpack', 1, 1], ['author', 1, 1]]);
});

function browserSandbox(extra) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'generator', 'pipeline.js'), 'utf8');
  const sandbox = {
    AnimathUnpack: require('../generator/unpack.js'),
    AnimathPrompt: require('../generator/build_prompt.js'),
    AnimathSlidesPrompt: require('../generator/build_slides_prompt.js'),
    AnimathWorksheetPrompt: require('../generator/build_worksheet_prompt.js'),
    AnimathExitTicketPrompt: require('../generator/build_exit_ticket_prompt.js'),
    AnimathNotesPrompt: require('../generator/build_notes_prompt.js'),
    AnimathScriptPrompt: require('../generator/build_script_prompt.js'),
    ...extra
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'pipeline-notes-browser.js' });
  return sandbox;
}

test('browser globals path: no validator global rejects naming validateNotes', async () => {
  const sandbox = browserSandbox({});
  const { callChat } = stubChat(() => GOLD_TEXT);
  await assert.rejects(
    () => sandbox.AnimathPipeline.generateNotes(OPTS, { callChat }),
    /validateNotes/);
});

test('browser globals path: generateNotes runs off window globals', async () => {
  const sandbox = browserSandbox({ AnimathValidate: require('../player/validate.js') });
  const { callChat } = stubChat((system) =>
    isUnpackCall(system) ? TRANSITIONS_TEXT : GOLD_TEXT);
  const doc = await sandbox.AnimathPipeline.generateNotes(OPTS, { callChat });
  assert.equal(JSON.stringify(doc), JSON.stringify(GOLD_DOC));
});
