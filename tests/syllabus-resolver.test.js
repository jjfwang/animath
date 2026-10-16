/* Tests for generator/syllabus.js resolveSyllabusTopic (issue #770):
 * every one of the 70 taxonomy slugs resolves bare AND in the composite
 * level/track/slug form to the same {topic, topicLabel, level, subject,
 * track}; unknown, malformed, and ambiguous ids throw synchronously
 * naming the raw id verbatim.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { SYLLABUS, resolveSyllabusTopic } = require('../generator/syllabus.js');

function allTopics() {
  const out = [];
  for (const level of SYLLABUS.levels) {
    for (const track of level.tracks) {
      for (const topic of track.topics) {
        out.push({
          topic: topic.slug,
          topicLabel: topic.label,
          level: level.id,
          subject: track.subject,
          track: track.id
        });
      }
    }
  }
  return out;
}

test('all 70 slugs resolve bare and composite to the same topic', () => {
  const topics = allTopics();
  assert.equal(topics.length, 70);
  for (const expected of topics) {
    assert.deepEqual(resolveSyllabusTopic(expected.topic), expected,
      'bare slug resolves: ' + expected.topic);
    const composite = expected.level + '/' + expected.track + '/' + expected.topic;
    assert.deepEqual(resolveSyllabusTopic(composite), expected,
      'composite id resolves: ' + composite);
  }
});

test('acceptance example: primary/p-sci/water-cycle and bare water-cycle', () => {
  const expected = {
    topic: 'water-cycle',
    topicLabel: 'Water cycle',
    level: 'primary',
    subject: 'science',
    track: 'p-sci'
  };
  assert.deepEqual(resolveSyllabusTopic('primary/p-sci/water-cycle'), expected);
  assert.deepEqual(resolveSyllabusTopic('water-cycle'), expected);
  assert.deepEqual(resolveSyllabusTopic('  water-cycle  '), expected,
    'surrounding whitespace is trimmed');
});

test('unknown ids throw naming the raw id', () => {
  assert.throws(() => resolveSyllabusTopic('primary/p-sci/nope'),
    /resolveSyllabusTopic: unknown syllabus id "primary\/p-sci\/nope"/);
  assert.throws(() => resolveSyllabusTopic('nope'),
    /resolveSyllabusTopic: unknown syllabus id "nope"/);
  assert.throws(() => resolveSyllabusTopic('primary/nope/water-cycle'),
    /resolveSyllabusTopic: unknown syllabus id "primary\/nope\/water-cycle"/);
  assert.throws(() => resolveSyllabusTopic('nope/p-sci/water-cycle'),
    /resolveSyllabusTopic: unknown syllabus id "nope\/p-sci\/water-cycle"/);
});

test('malformed ids throw naming the raw id', () => {
  assert.throws(() => resolveSyllabusTopic(''),
    /resolveSyllabusTopic: malformed syllabus id ""/);
  assert.throws(() => resolveSyllabusTopic('   '),
    /resolveSyllabusTopic: malformed syllabus id "   "/);
  assert.throws(() => resolveSyllabusTopic(42),
    /resolveSyllabusTopic: malformed syllabus id "42"/);
  assert.throws(() => resolveSyllabusTopic(null),
    /resolveSyllabusTopic: malformed syllabus id "null"/);
  assert.throws(() => resolveSyllabusTopic(undefined),
    /resolveSyllabusTopic: malformed syllabus id "undefined"/);
  assert.throws(() => resolveSyllabusTopic('primary/water-cycle'),
    /resolveSyllabusTopic: malformed syllabus id "primary\/water-cycle"/);
  assert.throws(() => resolveSyllabusTopic('a/b/c/d'),
    /resolveSyllabusTopic: malformed syllabus id "a\/b\/c\/d"/);
  assert.throws(() => resolveSyllabusTopic('primary//water-cycle'),
    /resolveSyllabusTopic: malformed syllabus id "primary\/\/water-cycle"/);
  assert.throws(() => resolveSyllabusTopic('/water-cycle'),
    /resolveSyllabusTopic: malformed syllabus id "\/water-cycle"/);
});

test('ambiguous bare slug (custom data) throws naming the id', () => {
  const dupData = {
    levels: [
      {
        id: 'one', label: 'One', tracks: [
          { id: 't-one', label: 'T1', subject: 'math', topics: [{ slug: 'dup-slug', label: 'First' }] }
        ]
      },
      {
        id: 'two', label: 'Two', tracks: [
          { id: 't-two', label: 'T2', subject: 'science', topics: [{ slug: 'dup-slug', label: 'Second' }] }
        ]
      }
    ]
  };
  assert.throws(() => resolveSyllabusTopic('dup-slug', dupData),
    /resolveSyllabusTopic: ambiguous syllabus id "dup-slug" \(matches multiple topics; use the composite level\/track\/topic-slug form\)/);
  // The composite form still resolves unambiguously against custom data.
  assert.deepEqual(resolveSyllabusTopic('two/t-two/dup-slug', dupData), {
    topic: 'dup-slug',
    topicLabel: 'Second',
    level: 'two',
    subject: 'science',
    track: 't-two'
  });
});
