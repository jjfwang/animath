/* animath embed API tests — zero dependencies, Node built-in test runner.
 * Run: node --test "tests/*.test.js"
 *
 * web/embed.js is required like any CommonJS module; mount()'s browser
 * dependencies (fetch, AnimathPlayer) are stubbed per-test because Node
 * has no DOM.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AnimathEmbed = require('../web/embed.js');

const samplesDir = path.join(__dirname, '..', 'samples');
const realSpec = JSON.parse(fs.readFileSync(
  path.join(samplesDir, 'primary-math-fractions-addition.json'), 'utf8'));

test('applyDefaults fills in baseUrl and autoplay', () => {
  const d = AnimathEmbed.applyDefaults();
  assert.equal(d.baseUrl, '../samples/');
  assert.equal(d.autoplay, false);
});

test('applyDefaults honors overrides and normalizes the trailing slash', () => {
  const d = AnimathEmbed.applyDefaults({ baseUrl: 'https://cdn.example.com/specs', autoplay: true });
  assert.equal(d.baseUrl, 'https://cdn.example.com/specs/');
  assert.equal(d.autoplay, true);
  const already = AnimathEmbed.applyDefaults({ baseUrl: 'https://cdn.example.com/specs/' });
  assert.equal(already.baseUrl, 'https://cdn.example.com/specs/');
  // autoplay is strict: only true passes
  assert.equal(AnimathEmbed.applyDefaults({ autoplay: 1 }).autoplay, false);
});

test('resolveSampleUrl maps a known slug to its JSON URL', () => {
  assert.equal(
    AnimathEmbed.resolveSampleUrl('primary-math-fractions-addition'),
    '../samples/primary-math-fractions-addition.json');
  assert.equal(
    AnimathEmbed.resolveSampleUrl('primary-math-fractions-addition', 'https://x.example/a'),
    'https://x.example/a/primary-math-fractions-addition.json');
  assert.equal(
    AnimathEmbed.resolveSampleUrl('primary-math-fractions-addition', 'https://x.example/a/'),
    'https://x.example/a/primary-math-fractions-addition.json');
});

test('resolveSampleUrl rejects missing/empty/non-string slugs', () => {
  assert.throws(() => AnimathEmbed.resolveSampleUrl(''), /non-empty string/);
  assert.throws(() => AnimathEmbed.resolveSampleUrl('   '), /non-empty string/);
  assert.throws(() => AnimathEmbed.resolveSampleUrl(undefined), /non-empty string/);
  assert.throws(() => AnimathEmbed.resolveSampleUrl(42), /non-empty string/);
});

function withStubs(fetchStub, mountStub, body) {
  const origFetch = globalThis.fetch;
  const origPlayer = globalThis.AnimathPlayer;
  globalThis.fetch = fetchStub;
  globalThis.AnimathPlayer = { mount: mountStub };
  return Promise.resolve()
    .then(body)
    .finally(() => {
      globalThis.fetch = origFetch;
      globalThis.AnimathPlayer = origPlayer;
    });
}

function fakeResponse(ok, jsonValue) {
  return { ok: ok, json: () => Promise.resolve(jsonValue) };
}

test('mount by slug fetches the spec and resolves to the controller', async () => {
  const seen = {};
  let playCalls = 0;
  const stubController = { play: () => { playCalls += 1; } };
  await withStubs(
    (url) => { seen.url = url; return Promise.resolve(fakeResponse(true, realSpec)); },
    (container, spec) => { seen.container = container; seen.spec = spec; return stubController; },
    async () => {
      const got = await AnimathEmbed.mount({ id: 'stage' }, 'primary-math-fractions-addition');
      assert.equal(got, stubController, 'mount must resolve to the player controller');
      assert.equal(seen.url, '../samples/primary-math-fractions-addition.json');
      assert.deepEqual(seen.spec, realSpec, 'the fetched spec must be passed through to AnimathPlayer.mount');
      assert.equal(seen.container.id, 'stage');
      assert.equal(playCalls, 0, 'autoplay defaults to false, so play must not be called');
      // the stub controller's play is callable by the caller
      assert.equal(typeof got.play, 'function');
    });
});

test('mount honors baseUrl and autoplay options on the slug path', async () => {
  const seen = {};
  let playCalls = 0;
  await withStubs(
    (url) => { seen.url = url; return Promise.resolve(fakeResponse(true, realSpec)); },
    () => ({ play: () => { playCalls += 1; } }),
    async () => {
      await AnimathEmbed.mount({ id: 'x' }, 'primary-math-fractions-addition',
        { baseUrl: '/embed-samples', autoplay: true });
      assert.equal(seen.url, '/embed-samples/primary-math-fractions-addition.json');
      assert.equal(playCalls, 1, 'autoplay: true must call play() once');
    });
});

test('mount rejects with a clear error on a 404 slug', async () => {
  await withStubs(
    () => Promise.resolve(fakeResponse(false, null)),
    () => { throw new Error('AnimathPlayer.mount must not run on a failed fetch'); },
    async () => {
      await assert.rejects(
        () => AnimathEmbed.mount({ id: 'x' }, 'no-such-sample'),
        /sample not found at .*no-such-sample\.json/);
    });
});

test('mount with a spec object mounts directly without fetching', async () => {
  const seen = {};
  await withStubs(
    () => { throw new Error('fetch must not run for a spec object'); },
    (container, spec) => { seen.container = container; seen.spec = spec; return { play: () => {} }; },
    async () => {
      const got = await AnimathEmbed.mount({ id: 'direct' }, realSpec);
      assert.deepEqual(seen.spec, realSpec, 'the object must be passed through untouched');
      assert.equal(seen.container.id, 'direct');
      assert.equal(typeof got.play, 'function');
    });
});
