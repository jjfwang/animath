/* animath gallery filter tests — pure function, zero dependencies.
 * Run: node --test "tests/*.test.js"
 *
 * web/gallery.js is required like any CommonJS module; the DOM glue in
 * web/gallery.html is not node-coverable and is verified by reading it.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const AnimathGallery = require('../web/gallery.js');

function makeItems() {
  return [
    { title: 'Adding Fractions', topic: 'fractions', filename: 'primary-math-fractions-addition.json', level: 'primary', subject: 'math' },
    { title: 'Pythagoras Theorem', topic: 'geometry', filename: 'secondary-math-pythagoras.json', level: 'secondary', subject: 'math' },
    { title: 'Photosynthesis', topic: 'plants', filename: 'primary-science-photosynthesis.json', level: 'primary', subject: 'science' }
  ];
}

test('UMD shape: exports api and registers the browser global', () => {
  assert.equal(typeof AnimathGallery.filterSamples, 'function');
  assert.equal(AnimathGallery.version, '0.1');
  assert.equal(globalThis.AnimathGallery, AnimathGallery);
});

test('keyword matches title case-insensitively', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'FRACTIONS' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Adding Fractions');
});

test('keyword matches topic', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'plants' });
  assert.equal(got.length, 1);
  assert.equal(got[0].filename, 'primary-science-photosynthesis.json');
});

test('keyword matches filename', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'secondary-math' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Pythagoras Theorem');
});

test('keyword is trimmed before matching', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: '  fractions  ' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Adding Fractions');
});

test('whitespace-only keyword behaves as empty', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: '   ' });
  assert.equal(got.length, 3);
});

test('empty criteria returns all items in original order', () => {
  const items = makeItems();
  const got = AnimathGallery.filterSamples(items, {});
  assert.deepEqual(got.map((i) => i.filename), items.map((i) => i.filename));
  assert.notEqual(got, items);
});

test('undefined criteria returns all items', () => {
  const got = AnimathGallery.filterSamples(makeItems());
  assert.equal(got.length, 3);
});

test('level-only filter narrows the set', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { level: 'primary' });
  assert.deepEqual(got.map((i) => i.title), ['Adding Fractions', 'Photosynthesis']);
});

test('level comparison is exact (case-sensitive)', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { level: 'Primary' });
  assert.deepEqual(got, []);
});

test('subject-only filter narrows the set', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { subject: 'science' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Photosynthesis');
});

test('combined level + subject filter', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { level: 'primary', subject: 'math' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Adding Fractions');
});

test('combined keyword + level + subject filter', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'frac', level: 'primary', subject: 'math' });
  assert.equal(got.length, 1);
  assert.equal(got[0].title, 'Adding Fractions');
});

test('keyword + level that disagree yields no match', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'frac', level: 'secondary' });
  assert.deepEqual(got, []);
});

test('unknown keyword returns an empty array', () => {
  const got = AnimathGallery.filterSamples(makeItems(), { keyword: 'zzz-no-such-topic' });
  assert.deepEqual(got, []);
});

test('empty item list returns an empty array', () => {
  assert.deepEqual(AnimathGallery.filterSamples([], { keyword: 'frac' }), []);
});

test('input items are not mutated', () => {
  const items = makeItems();
  const snapshot = JSON.stringify(items);
  AnimathGallery.filterSamples(items, { keyword: 'frac', level: 'secondary', subject: 'science' });
  assert.equal(JSON.stringify(items), snapshot);
});

test('result preserves original order, not relevance order', () => {
  const items = makeItems();
  const got = AnimathGallery.filterSamples(items, { keyword: '.json' });
  assert.deepEqual(got.map((i) => i.filename), items.map((i) => i.filename));
});

test('items with missing fields do not crash', () => {
  const items = [{ title: 'Lonely' }, { topic: 'other' }, {}];
  const got = AnimathGallery.filterSamples(items, { keyword: 'lonely' });
  assert.equal(got.length, 1);
  const leveled = AnimathGallery.filterSamples(items, { level: 'primary' });
  assert.deepEqual(leveled, []);
});
