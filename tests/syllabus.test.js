/* Tests for the SYLLABUS.md <-> web/syllabus.js topic-slug sync.
 * SYLLABUS.md is the topic taxonomy (guidance authority #3); web/syllabus.js
 * is the picker data the web UI actually uses (window.ANIMATH_SYLLABUS feeds
 * the topic select in web/index.html). This regression test locks the two
 * together: every queue-refill run used to hand-check the 67 slugs, nothing
 * in the repo enforced it.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const syllabusMd = fs.readFileSync(path.join(root, 'SYLLABUS.md'), 'utf8');

// Topic slugs live in the band-table rows of the form `| `slug` | topic |`.
// Only backticked first cells of markdown table rows count — prose backticks
// (e.g. in the field-contract notes) are not table rows and are ignored.
function parseSyllabusSlugs(md) {
  const slugs = [];
  const rowRe = /^\s*\|\s*`([a-z0-9-]+)`\s*\|/gm;
  let m;
  while ((m = rowRe.exec(md)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

// web/syllabus.js is a browser file: it assigns window.ANIMATH_SYLLABUS and
// has no module.exports. Load it in Node by shimming window.
function loadPickerData() {
  const src = fs.readFileSync(path.join(root, 'web', 'syllabus.js'), 'utf8');
  const window = {};
  new Function('window', src)(window);
  assert.ok(
    window.ANIMATH_SYLLABUS && Array.isArray(window.ANIMATH_SYLLABUS.levels),
    'web/syllabus.js must assign window.ANIMATH_SYLLABUS with a levels array'
  );
  return window.ANIMATH_SYLLABUS;
}

function collectPickerSlugs(data) {
  const slugs = [];
  const subjects = [];
  for (const level of data.levels) {
    for (const track of level.tracks) {
      subjects.push(track.subject);
      for (const topic of track.topics) {
        slugs.push(topic.slug);
      }
    }
  }
  return { slugs, subjects };
}

const EXPECTED_SLUG_COUNT = 67;

test('SYLLABUS.md and web/syllabus.js hold the same 67 topic slugs, 1:1', () => {
  const mdSlugs = parseSyllabusSlugs(syllabusMd);
  const { slugs: pickerSlugs, subjects } = collectPickerSlugs(loadPickerData());

  // Locks the expected count on both sides so a future drop/add of a whole
  // band cannot pass with two empty sets still "matching".
  assert.equal(mdSlugs.length, EXPECTED_SLUG_COUNT,
    'SYLLABUS.md band tables must carry exactly 67 topic slugs');
  assert.equal(pickerSlugs.length, EXPECTED_SLUG_COUNT,
    'web/syllabus.js must carry exactly 67 topic slugs');

  const dupes = (list) => {
    const seen = new Set();
    const out = [];
    for (const s of list) {
      if (seen.has(s)) out.push(s);
      seen.add(s);
    }
    return out;
  };
  assert.deepEqual(dupes(mdSlugs), [], 'no duplicate slugs in SYLLABUS.md');
  assert.deepEqual(dupes(pickerSlugs), [], 'no duplicate slugs in web/syllabus.js');

  // 1:1 both directions: nothing hidden from the picker, nothing invented by it.
  const mdSet = new Set(mdSlugs);
  const pickerSet = new Set(pickerSlugs);
  const missingFromPicker = mdSlugs.filter((s) => !pickerSet.has(s));
  const missingFromDoc = pickerSlugs.filter((s) => !mdSet.has(s));
  assert.deepEqual(missingFromPicker, [],
    'slugs in SYLLABUS.md but missing from web/syllabus.js');
  assert.deepEqual(missingFromDoc, [],
    'slugs in web/syllabus.js but missing from SYLLABUS.md');

  for (const subject of subjects) {
    assert.ok(subject === 'math' || subject === 'science',
      'every track subject must be math or science, got: ' + String(subject));
  }
});

// Issue #497 regression: a shipped sample declared topic "ratio-sharing",
// which matches no taxonomy slug, so the taxonomy's "ratio" topic read as
// uncovered. This test locks every sample's topic to the 67 slugs parsed
// from SYLLABUS.md, and locks the full 67/67 slug coverage.
test('every sample topic is a taxonomy slug, and every slug has a sample', () => {
  const mdSlugs = parseSyllabusSlugs(syllabusMd);
  const slugSet = new Set(mdSlugs);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'samples', 'index.json'), 'utf8')
  );
  const offTaxonomy = [];
  const covered = new Set();
  for (const name of manifest) {
    const spec = JSON.parse(
      fs.readFileSync(path.join(root, 'samples', name), 'utf8')
    );
    if (slugSet.has(spec.topic)) {
      covered.add(spec.topic);
    } else {
      offTaxonomy.push(name + ' declares topic ' + JSON.stringify(spec.topic));
    }
  }
  assert.deepEqual(offTaxonomy, [],
    'every sample topic must be a SYLLABUS.md taxonomy slug');
  const uncovered = mdSlugs.filter((s) => !covered.has(s));
  assert.deepEqual(uncovered, [],
    'every taxonomy slug must have at least one sample (67/67 coverage)');
});
