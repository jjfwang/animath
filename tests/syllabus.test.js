/* Tests for the SYLLABUS.md <-> web/syllabus.js topic-slug sync.
 * SYLLABUS.md is the topic taxonomy (guidance authority #3); web/syllabus.js
 * is the picker data the web UI actually uses (window.ANIMATH_SYLLABUS feeds
 * the topic select in web/index.html). This regression test locks the two
 * together: every queue-refill run used to hand-check the 70 slugs, nothing
 * in the repo enforced it.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SUBJECTS } = require('../player/validate.js');

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

const EXPECTED_SLUG_COUNT = 70;

test('SYLLABUS.md and web/syllabus.js hold the same 70 topic slugs, 1:1', () => {
  const mdSlugs = parseSyllabusSlugs(syllabusMd);
  const { slugs: pickerSlugs, subjects } = collectPickerSlugs(loadPickerData());

  // Locks the expected count on both sides so a future drop/add of a whole
  // band cannot pass with two empty sets still "matching".
  assert.equal(mdSlugs.length, EXPECTED_SLUG_COUNT,
    'SYLLABUS.md band tables must carry exactly 70 topic slugs');
  assert.equal(pickerSlugs.length, EXPECTED_SLUG_COUNT,
    'web/syllabus.js must carry exactly 70 topic slugs');

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
    assert.ok(SUBJECTS.indexOf(subject) !== -1,
      'every track subject must be syllabus-known (one of ' + SUBJECTS.join('|') +
      ' in player/validate.js SUBJECTS); a new syllabus-covered subject must follow the ' +
      'add-a-subject checklist in CONTRIBUTING.md. Got: ' + String(subject));
  }

  // Symmetric with specs.test.js's per-subject sample-coverage lock: adding a
  // syllabus-known subject to SUBJECTS without a picker track would leave the
  // web UI with no way to pick it — a silent gap. Same fix: follow the checklist.
  for (const subject of SUBJECTS) {
    assert.ok(subjects.indexOf(subject) !== -1,
      'syllabus-known SUBJECTS subject ' + JSON.stringify(subject) + ' has no track in ' +
      'web/syllabus.js (add-a-subject checklist in CONTRIBUTING.md)');
  }
});

// Issue #770: generator/syllabus.js embeds a third copy of the taxonomy
// (the published package ships generator/ but not web/syllabus.js, so the
// generator cannot load the web file at runtime). This test locks all
// three sources 1:1 as (slug, level, track, subject) sequences in
// document order, parsing SYLLABUS.md with heading context: the ## band
// gives the level, and the band/subheading gives track + subject via the
// heading map below (built to match the actual headings in SYLLABUS.md
// and the actual level/track ids in web/syllabus.js).
const LEVEL_BY_BAND = {
  Primary: 'primary',
  Secondary: 'secondary',
  'Junior College': 'jc'
};
// Primary bands name their track directly in the ## heading.
const PRIMARY_TRACK_BY_HEADING = {
  Mathematics: ['p-math', 'math'],
  Science: ['p-sci', 'science'],
  Geography: ['p-geog', 'geography']
};
// Secondary / JC tracks are named by a plain "Name:" line above each
// table; the same subject name maps to different track ids per level
// (Physics under Secondary is physics, under JC it is h2-physics).
const SUBHEADING_TRACK = {
  secondary: {
    'E-Math': ['e-math', 'math'],
    'A-Math': ['a-math', 'math'],
    Physics: ['physics', 'science'],
    Chemistry: ['chemistry', 'science'],
    Biology: ['biology', 'science']
  },
  jc: {
    Mathematics: ['h2-math', 'math'],
    Physics: ['h2-physics', 'science'],
    Chemistry: ['h2-chemistry', 'science'],
    Biology: ['h2-biology', 'science']
  }
};

function parseSyllabusEntries(md) {
  const entries = [];
  let level = null;
  let track = null;
  let subject = null;
  for (const line of md.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const band = heading[1].split(' — ')[0].trim();
      const rest = heading[1].split(' — ')[1] || '';
      level = LEVEL_BY_BAND[band] || null;
      track = null;
      subject = null;
      if (level === 'primary') {
        const name = rest.split(' (')[0].trim();
        const mapped = PRIMARY_TRACK_BY_HEADING[name];
        if (mapped) {
          track = mapped[0];
          subject = mapped[1];
        }
      }
      continue;
    }
    const sub = line.match(/^([A-Za-z][A-Za-z-]*):\s*$/);
    if (sub && level && SUBHEADING_TRACK[level]) {
      const mapped = SUBHEADING_TRACK[level][sub[1]];
      if (mapped) {
        track = mapped[0];
        subject = mapped[1];
      }
      continue;
    }
    const row = line.match(/^\s*\|\s*`([a-z0-9-]+)`\s*\|/);
    if (row && level && track) {
      entries.push({ slug: row[1], level, track, subject });
    }
  }
  return entries;
}

function flattenSyllabusData(data) {
  const entries = [];
  for (const level of data.levels) {
    for (const track of level.tracks) {
      for (const topic of track.topics) {
        entries.push({
          slug: topic.slug,
          level: level.id,
          track: track.id,
          subject: track.subject
        });
      }
    }
  }
  return entries;
}

test('SYLLABUS.md, web/syllabus.js and generator SYLLABUS agree 1:1 (slug, level, track, subject)', () => {
  const mdEntries = parseSyllabusEntries(syllabusMd);
  assert.equal(mdEntries.length, EXPECTED_SLUG_COUNT,
    'SYLLABUS.md heading-context parse must yield exactly 70 entries');
  assert.deepEqual(flattenSyllabusData(loadPickerData()), mdEntries,
    'web/syllabus.js flattened (slug, level, track, subject) sequence must match SYLLABUS.md in document order');
  const { SYLLABUS } = require('../generator/syllabus.js');
  assert.deepEqual(flattenSyllabusData(SYLLABUS), mdEntries,
    'generator SYLLABUS flattened (slug, level, track, subject) sequence must match SYLLABUS.md in document order');
});

// Issue #497 regression: a shipped sample declared topic "ratio-sharing",
// which matches no taxonomy slug, so the taxonomy's "ratio" topic read as
// uncovered. This test locks every sample's topic to the 70 slugs parsed
// from SYLLABUS.md, and locks the full 70/70 slug coverage.
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
    'every taxonomy slug must have at least one sample (70/70 coverage)');
});
