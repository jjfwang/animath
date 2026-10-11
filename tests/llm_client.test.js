/* animath llm_client branch-coverage tests — zero dependencies.
 * Run: node --test "tests/*.test.js"
 *
 * Guards generator/llm_client.js error and retry paths (issue #632): the
 * file exposes no DI other than the bare global `fetch`, so every test stubs
 * globalThis.fetch per test (saved/restored in beforeEach/afterEach). There
 * are no timers/backoff in the retry path, so plain promise stubs suffice.
 * Goal: generator/llm_client.js branch coverage >= 90%.
 */
'use strict';
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const LLM = require('../generator/llm_client.js');

let realFetch;
let calls; // [{url, opts}]

beforeEach(() => {
  realFetch = globalThis.fetch;
  calls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const OPTS = {
  baseUrl: 'https://api.test/v1',
  apiKey: 'k-test',
  model: 'm-test',
  system: 'sys',
  user: 'usr'
};

function jsonOk(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: text } }] })
  };
}

function httpFail(status, text) {
  return { ok: false, status: status, text: async () => text };
}

function stubFetch(handler) {
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: url, opts: opts });
    return handler(calls.length - 1);
  };
}

function bodyOf(call) {
  return JSON.parse(call.opts.body);
}

const SPEC = { id: 's1', duration_ms: 1000 };
const SPEC_TEXT = JSON.stringify(SPEC);
const cleanValidate = () => [];

// --- stripFences / extractJson (unit-level) --------------------------------

test('extractJson parses fenced json blocks', () => {
  const out = LLM.extractJson('```json\n' + SPEC_TEXT + '\n```');
  assert.deepStrictEqual(out, SPEC);
});

test('extractJson parses plain fenced blocks without the json tag', () => {
  const out = LLM.extractJson('```\n' + SPEC_TEXT + '\n```');
  assert.deepStrictEqual(out, SPEC);
});

test('extractJson passes through plain JSON (no fence arm)', () => {
  assert.deepStrictEqual(LLM.extractJson(SPEC_TEXT), SPEC);
});

test('extractJson brace-scans prose-wrapped JSON (start/end arm)', () => {
  const out = LLM.extractJson('Here is your spec:\n' + SPEC_TEXT + '\nDone.');
  assert.deepStrictEqual(out, SPEC);
});

test('extractJson throws when nothing brace-shaped is present (no-brace arm)', () => {
  assert.throws(() => LLM.extractJson('not json at all'),
    /LLM response was not valid JSON/);
});

test('extractJson throws when braces wrap garbage (brace-scan-fail arm)', () => {
  assert.throws(() => LLM.extractJson('{oops}'),
    /LLM response was not valid JSON/);
});

// --- happy paths ------------------------------------------------------------

test('generateSpec resolves a parsed spec from a 200 fenced-JSON response', async () => {
  stubFetch(() => jsonOk('```json\n' + SPEC_TEXT + '\n```'));
  const spec = await LLM.generateSpec(OPTS);
  assert.deepStrictEqual(spec, SPEC);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://api.test/v1/chat/completions');
  assert.ok('response_format' in bodyOf(calls[0]),
    'first attempt must use JSON mode');
});

test('generateSpec strips trailing slashes from the baseUrl', async () => {
  stubFetch(() => jsonOk(SPEC_TEXT));
  const opts = Object.assign({}, OPTS, { baseUrl: 'https://api.test/v1//' });
  await LLM.generateSpec(opts);
  assert.strictEqual(calls[0].url, 'https://api.test/v1/chat/completions');
});

test('generateSpecWithRepair returns a clean spec without a repair turn', async () => {
  stubFetch(() => jsonOk(SPEC_TEXT));
  const progress = [];
  const spec = await LLM.generateSpecWithRepair(OPTS, cleanValidate,
    (n, max) => progress.push([n, max]));
  assert.deepStrictEqual(spec, SPEC);
  assert.strictEqual(calls.length, 1, 'no repair fetch expected');
  assert.deepStrictEqual(progress, [], 'onProgress must not fire without repairs');
});

// --- missing key / missing validator ----------------------------------------

test('generateSpec rejects without an API key', async () => {
  await assert.rejects(
    LLM.generateSpec(Object.assign({}, OPTS, { apiKey: '' })),
    /API key is required/);
});

test('generateSpecWithRepair rejects without an API key', async () => {
  await assert.rejects(
    LLM.generateSpecWithRepair(Object.assign({}, OPTS, { apiKey: null }),
      cleanValidate),
    /API key is required/);
});

test('generateSpecWithRepair rejects without a validator function', async () => {
  await assert.rejects(
    LLM.generateSpecWithRepair(OPTS, 'not-a-function'),
    /a validator function is required/);
});

// --- HTTP errors ------------------------------------------------------------

test('generateSpec rejects with the HTTP status and short body text', async () => {
  stubFetch(() => httpFail(500, 'server blew up'));
  const err = await LLM.generateSpec(OPTS).then(
    () => { throw new Error('should have rejected'); },
    (e) => e);
  assert.match(err.message, /^LLM HTTP 500: server blew up$/);
  assert.strictEqual(err.status, 500);
});

test('HTTP error body text is truncated at 300 chars', async () => {
  stubFetch(() => httpFail(503, 'x'.repeat(500)));
  const err = await LLM.generateSpec(OPTS).then(
    () => { throw new Error('should have rejected'); },
    (e) => e);
  assert.strictEqual(err.status, 503);
  assert.strictEqual(err.message, 'LLM HTTP 503: ' + 'x'.repeat(300));
});

// --- JSON-mode 400 fallback -------------------------------------------------

test('attemptOnce retries without response_format after a 400', async () => {
  stubFetch((i) => {
    if (i === 0) {
      const e = new Error('LLM HTTP 400: bad');
      e.status = 400;
      return Promise.reject(e);
    }
    return jsonOk(SPEC_TEXT);
  });
  const spec = await LLM.generateSpec(OPTS);
  assert.deepStrictEqual(spec, SPEC);
  assert.strictEqual(calls.length, 2);
  assert.ok('response_format' in bodyOf(calls[0]), 'first call uses JSON mode');
  assert.ok(!('response_format' in bodyOf(calls[1])),
    'retry must drop response_format');
});

test('400 fallback rethrows the second error when plain retry also fails', async () => {
  stubFetch((i) => {
    const e = new Error('LLM HTTP ' + (i === 0 ? 400 : 403) + ': denied');
    e.status = i === 0 ? 400 : 403;
    return Promise.reject(e);
  });
  await assert.rejects(LLM.generateSpec(OPTS), /LLM HTTP 403: denied/);
});

test('non-400 rejection rethrows the original error (status arm)', async () => {
  stubFetch(() => {
    const e = new Error('LLM HTTP 500: boom');
    e.status = 500;
    return Promise.reject(e);
  });
  await assert.rejects(LLM.generateSpec(OPTS), /LLM HTTP 500: boom/);
  assert.strictEqual(calls.length, 1, 'no retry for non-400');
});

test('falsy rejection passes through (e && ... false arm)', async () => {
  stubFetch(() => Promise.reject());
  await assert.rejects(LLM.generateSpec(OPTS), (err) => {
    assert.strictEqual(err, undefined);
    return true;
  });
});

// --- malformed JSON ---------------------------------------------------------

test('generateSpec rejects when the response is not valid JSON', async () => {
  stubFetch(() => jsonOk('total garbage {'));
  await assert.rejects(LLM.generateSpec(OPTS), /not valid JSON/);
});

test('generateSpecWithRepair treats non-JSON as a failed attempt and asks for JSON again', async () => {
  stubFetch((i) => (i === 0 ? jsonOk('garbage {') : jsonOk(SPEC_TEXT)));
  const spec = await LLM.generateSpecWithRepair(OPTS, cleanValidate);
  assert.deepStrictEqual(spec, SPEC);
  assert.strictEqual(calls.length, 2);
  const repairUser = bodyOf(calls[1]).messages[1].content;
  assert.match(repairUser, /Your raw response \(it was not valid JSON\):/);
  assert.match(repairUser, /Return ONLY the corrected animation spec as a single JSON object/);
});

// --- postChat no-content arms ------------------------------------------------

test('response with empty choices rejects (data present, no content)', async () => {
  stubFetch(() => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }));
  await assert.rejects(LLM.generateSpec(OPTS), /LLM returned no content/);
});

test('response with null JSON body rejects (data-falsy arm)', async () => {
  stubFetch(() => ({ ok: true, status: 200, json: async () => null }));
  await assert.rejects(LLM.generateSpec(OPTS), /LLM returned no content/);
});

test('response with a choice but no message content rejects', async () => {
  stubFetch(() => ({
    ok: true, status: 200, json: async () => ({ choices: [{ message: {} }] })
  }));
  await assert.rejects(LLM.generateSpec(OPTS), /LLM returned no content/);
});

// --- repair loop ------------------------------------------------------------

test('repair loop resolves after two failing turns, third clean', async () => {
  const texts = [JSON.stringify({ id: 'bad1' }), JSON.stringify({ id: 'bad2' }), SPEC_TEXT];
  stubFetch((i) => jsonOk(texts[i]));
  let seen = 0;
  const validate = (spec) => (++seen <= 2 ? ['problem on ' + spec.id] : []);
  const progress = [];
  const spec = await LLM.generateSpecWithRepair(
    Object.assign({}, OPTS, { maxRepairs: 2 }),
    validate,
    (n, max) => progress.push([n, max]));
  assert.deepStrictEqual(spec, SPEC);
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(progress, [[1, 2], [2, 2]],
    'onProgress called with (repairsUsed+1, maxRepairs) before each repair turn');
});

test('repair turn user prompt embeds the invalid spec (prev.spec arm)', async () => {
  const texts = [JSON.stringify({ id: 'bad1' }), SPEC_TEXT];
  stubFetch((i) => jsonOk(texts[i]));
  let seen = 0;
  await LLM.generateSpecWithRepair(OPTS, (spec) => (++seen === 1 ? ['bad'] : []));
  const repairUser = bodyOf(calls[1]).messages[1].content;
  assert.match(repairUser, /The invalid spec you returned:/);
  assert.match(repairUser, /"id": "bad1"/);
  assert.match(repairUser, /- bad/);
});

test('persistent problems reject after maxRepairs with problems attached', async () => {
  stubFetch(() => jsonOk(JSON.stringify({ id: 'bad' })));
  const err = await LLM.generateSpecWithRepair(
    Object.assign({}, OPTS, { maxRepairs: 2 }),
    () => ['p1', 'p2']).then(
    () => { throw new Error('should have rejected'); },
    (e) => e);
  assert.match(err.message, /still invalid after 2 repair attempt\(s\): p1 \| p2/);
  assert.deepStrictEqual(err.problems, ['p1', 'p2']);
  assert.strictEqual(calls.length, 3, 'initial attempt + 2 repair turns');
});

test('maxRepairs: 0 rejects straight after the first failed attempt', async () => {
  stubFetch(() => jsonOk(JSON.stringify({ id: 'bad' })));
  const progress = [];
  const err = await LLM.generateSpecWithRepair(
    Object.assign({}, OPTS, { maxRepairs: 0 }),
    () => ['always bad'],
    (n, max) => progress.push([n, max])).then(
    () => { throw new Error('should have rejected'); },
    (e) => e);
  assert.match(err.message, /still invalid after 0 repair attempt\(s\)/);
  assert.strictEqual(calls.length, 1, 'no repair fetch with maxRepairs 0');
  assert.deepStrictEqual(progress, [], 'onProgress never fires with maxRepairs 0');
});
