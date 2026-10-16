/* animath generateLessonPack pipeline tests — zero network.
 * Guards generator/pipeline.js generateLessonPack (issue #768): ONE
 * shared unpack authors all six materials (animation, slides,
 * worksheet, notes, exit ticket, teacher script), each through its
 * existing builder + validator + repair discipline; the resolved pack
 * carries a manifest (slug, topic, level, subject, generator version,
 * material keys) and is cached in memory by slug — a repeat call makes
 * zero additional callChat calls, opts.force regenerates, and
 * clearPackCache empties the cache. deps.callChat is stubbed throughout.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PIPELINE = require('../generator/pipeline.js');
const validate = require('../player/validate.js');
const pkg = require('../package.json');

function gold(rel) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}
const GOLD_ANIMATION = gold('samples/primary-science-water-cycle.json');
const GOLD_DECK = gold('samples/decks/primary-science-water-cycle.json');
const GOLD_WORKSHEET = gold('samples/worksheets/primary-science-water-cycle.json');
const GOLD_NOTES = gold('samples/notes/primary-science-water-cycle.json');
const GOLD_TICKET = gold('samples/tickets/primary-science-water-cycle.json');
const GOLD_SCRIPT = gold('samples/scripts/primary-science-water-cycle.json');

const TRANSITIONS = [
  { name: 'evaporation', from_state: 'liquid water', to_state: 'water vapour', driver: "the sun's heat" },
  { name: 'condensation', from_state: 'water vapour', to_state: 'liquid droplets', driver: 'cooling' }
];
const TRANSITIONS_TEXT = JSON.stringify(TRANSITIONS);

const OPTS = {
  topic: 'The Water Cycle',
  topicLabel: 'Water cycle',
  level: 'Primary Science',
  subject: 'Science'
};
const EXPECTED_SLUG = 'the-water-cycle-primary-science-science';

function route(system) {
  if (system.indexOf('topic unpacker') !== -1) return TRANSITIONS_TEXT;
  if (system.indexOf('animation author') !== -1) return JSON.stringify(GOLD_ANIMATION);
  if (system.indexOf('slide-deck author') !== -1) return JSON.stringify(GOLD_DECK);
  if (system.indexOf('worksheet author') !== -1) return JSON.stringify(GOLD_WORKSHEET);
  if (system.indexOf('notes author') !== -1) return JSON.stringify(GOLD_NOTES);
  if (system.indexOf('exit-ticket author') !== -1) return JSON.stringify(GOLD_TICKET);
  if (system.indexOf('script author') !== -1) return JSON.stringify(GOLD_SCRIPT);
  throw new Error('unrouted system prompt: ' + system.slice(0, 60));
}

function stubChat(handler) {
  const calls = [];
  const callChat = (system, user) => {
    calls.push({ system, user });
    return Promise.resolve(handler(system, user, calls.length - 1));
  };
  return { calls, callChat };
}

test('full pack: one unpack, six validate-clean materials, manifest correct', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  const pack = await PIPELINE.generateLessonPack(OPTS, { callChat });

  const unpackCalls = calls.filter((c) => c.system.indexOf('topic unpacker') !== -1);
  assert.equal(unpackCalls.length, 1, 'exactly one shared unpack call');
  assert.equal(calls.length, 7, 'one unpack + six author calls, no repairs');

  assert.deepEqual(validate.validateSpec(pack.animation), [], 'animation validates clean');
  assert.deepEqual(validate.validateSlides(pack.slides), [], 'slides validate clean');
  assert.deepEqual(validate.validateWorksheet(pack.worksheet), [], 'worksheet validates clean');
  assert.deepEqual(validate.validateNotes(pack.notes), [], 'notes validate clean');
  assert.deepEqual(validate.validateExitTicket(pack.exitTicket), [], 'exit ticket validates clean');
  assert.deepEqual(validate.validateScript(pack.script), [], 'script validates clean');
  assert.deepEqual(pack.animation, GOLD_ANIMATION);
  assert.deepEqual(pack.notes, GOLD_NOTES);
  assert.deepEqual(pack.script, GOLD_SCRIPT);

  assert.equal(pack.manifest.slug, EXPECTED_SLUG, 'slug derived from topic + level + subject');
  assert.equal(pack.manifest.topic, 'The Water Cycle');
  assert.equal(pack.manifest.level, 'Primary Science');
  assert.equal(pack.manifest.subject, 'Science');
  assert.equal(pack.manifest.version, pkg.version, 'manifest names the generator version');
  assert.deepEqual(pack.manifest.materials,
    ['animation', 'slides', 'worksheet', 'notes', 'exitTicket', 'script']);
});

test('cache: second identical call makes zero additional callChat calls', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  const first = await PIPELINE.generateLessonPack(OPTS, { callChat });
  const countAfterFirst = calls.length;
  const second = await PIPELINE.generateLessonPack(OPTS, { callChat });
  assert.equal(calls.length, countAfterFirst, 'cached call adds no LLM calls');
  assert.equal(second, first, 'the cached pack object is resolved');
});

test('force: opts.force regenerates and replaces the cached entry', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  const first = await PIPELINE.generateLessonPack(OPTS, { callChat });
  const countAfterFirst = calls.length;
  const forced = await PIPELINE.generateLessonPack({ ...OPTS, force: true }, { callChat });
  assert.ok(calls.length > countAfterFirst, 'force bypass makes fresh LLM calls');
  assert.notEqual(forced, first, 'a fresh pack object replaces the cache entry');
  const third = await PIPELINE.generateLessonPack(OPTS, { callChat });
  assert.equal(third, forced, 'the regenerated pack is now the cached one');
});

test('clearPackCache: the next call regenerates', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  await PIPELINE.generateLessonPack(OPTS, { callChat });
  const countAfterFirst = calls.length;
  PIPELINE.clearPackCache();
  await PIPELINE.generateLessonPack(OPTS, { callChat });
  assert.ok(calls.length > countAfterFirst, 'after clearing, generation runs again');
});

test('slug derivation collapses punctuation and drops empty parts', async () => {
  PIPELINE.clearPackCache();
  const { callChat } = stubChat(route);
  const pack = await PIPELINE.generateLessonPack(
    { topic: 'Water Cycle!', level: '', subject: 'Science' }, { callChat });
  assert.equal(pack.manifest.slug, 'water-cycle-science');
});

test('material failure rejects the pack naming the material with err.problems', async () => {
  PIPELINE.clearPackCache();
  const { callChat } = stubChat((system) => {
    if (system.indexOf('script author') !== -1) return '{}';
    return route(system);
  });
  await assert.rejects(
    () => PIPELINE.generateLessonPack({ ...OPTS, maxRepairs: 0 }, { callChat }),
    (err) => {
      assert.equal(err.material, 'script', 'the failing material is named');
      assert.deepEqual(err.problems, validate.validateScript({}),
        'err.problems comes from validateScript');
      return true;
    });
});

test('by syllabus id: composite id authors a validate-clean pack with the resolved manifest', async () => {
  PIPELINE.clearPackCache();
  const { callChat } = stubChat(route);
  const pack = await PIPELINE.generateLessonPackForSyllabus('primary/p-sci/water-cycle', {}, { callChat });

  assert.deepEqual(validate.validateSpec(pack.animation), [], 'animation validates clean');
  assert.deepEqual(validate.validateSlides(pack.slides), [], 'slides validate clean');
  assert.deepEqual(validate.validateWorksheet(pack.worksheet), [], 'worksheet validates clean');
  assert.deepEqual(validate.validateNotes(pack.notes), [], 'notes validate clean');
  assert.deepEqual(validate.validateExitTicket(pack.exitTicket), [], 'exit ticket validates clean');
  assert.deepEqual(validate.validateScript(pack.script), [], 'script validates clean');

  assert.equal(pack.manifest.slug, 'water-cycle-primary-science');
  assert.equal(pack.manifest.topic, 'water-cycle');
  assert.equal(pack.manifest.level, 'primary');
  assert.equal(pack.manifest.subject, 'science');
});

test('by syllabus id: cache is shared with a direct call using the resolved values verbatim', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  const first = await PIPELINE.generateLessonPackForSyllabus('water-cycle', {}, { callChat });
  const countAfterFirst = calls.length;
  const second = await PIPELINE.generateLessonPack(
    { topic: 'water-cycle', topicLabel: 'Water cycle', level: 'primary', subject: 'science' },
    { callChat });
  assert.equal(second, first, 'the direct call resolves the cached pack object');
  assert.equal(calls.length, countAfterFirst, 'the direct call adds zero callChat calls');
});

test('by syllabus id: explicit opts win over resolved values, undefined opts do not', async () => {
  PIPELINE.clearPackCache();
  const { callChat } = stubChat(route);
  const pack = await PIPELINE.generateLessonPackForSyllabus('water-cycle',
    { level: 'secondary', subject: undefined }, { callChat });
  assert.equal(pack.manifest.level, 'secondary', 'explicit level overlays the resolved level');
  assert.equal(pack.manifest.subject, 'science',
    'an undefined subject opt leaves the resolved subject in place');
  assert.equal(pack.manifest.slug, 'water-cycle-secondary-science');
});

test('by syllabus id: unknown id rejects naming the id with zero callChat calls', async () => {
  PIPELINE.clearPackCache();
  const { calls, callChat } = stubChat(route);
  await assert.rejects(
    () => PIPELINE.generateLessonPackForSyllabus('primary/p-sci/nope', {}, { callChat }),
    /resolveSyllabusTopic: unknown syllabus id "primary\/p-sci\/nope"/);
  assert.equal(calls.length, 0, 'resolution failure happens before any LLM call');
});

test('missing deps: no callChat rejects naming callChat', async () => {
  PIPELINE.clearPackCache();
  await assert.rejects(() => PIPELINE.generateLessonPack(OPTS), /callChat/);
  await assert.rejects(() => PIPELINE.generateLessonPack(OPTS, {}), /callChat/);
});
