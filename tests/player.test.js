/* Tests for player/player.js applyPos — rect size field translation (issue #134).
 * DOM-less: a stub node records setAttribute calls.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const player = require('../player/player.js');

function stubNode() {
  var calls = [];
  return {
    calls: calls,
    setAttribute: function (name, value) { calls.push([name, value]); }
  };
}

test('applyPos maps rect w/h to width/height attributes with interpolated values', () => {
  var node = stubNode();
  var shape = { id: 'r1', kind: 'rect', x: 10, y: 20, w: 100, h: 50 };
  var from = { x: 10, y: 20, w: 100, h: 50 };
  var pos = player.interpFields(from, { w: 200, h: 100 }, 0.5);
  player.applyPos(node, shape, pos);
  var byName = {};
  node.calls.forEach(function (c) { byName[c[0]] = c[1]; });
  assert.equal(byName.width, 150, 'width interpolated to 150 at p=0.5');
  assert.equal(byName.height, 75, 'height interpolated to 75 at p=0.5');
  assert.ok(!('w' in byName), 'no raw w attribute set');
  assert.ok(!('h' in byName), 'no raw h attribute set');
});

/* Tests for issue #135 — polygon move (pointwise point interpolation).
 * interpFields/applyPos tests are DOM-less; validator tests build a
 * minimal two-scene spec in memory.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test135 } = require('node:test');
const assert135 = require('node:assert/strict');

const player135 = require('../player/player.js');
const { validateSpec: validateSpec135 } = require('../player/validate.js');

function stubNode135() {
  var calls = [];
  return {
    calls: calls,
    setAttribute: function (name, value) { calls.push([name, value]); }
  };
}

function polygonMoveSpec135(showPoints, toPoints) {
  function scene(id) {
    return {
      id: id, caption: 'a triangle', narration: 'the triangle travels',
      duration_ms: 4000,
      steps: [
        { at_ms: 0, do: 'show', shape: { id: 'tri', kind: 'polygon', points: showPoints } },
        { at_ms: 500, do: 'move', target: 'tri', to: { points: toPoints }, dur_ms: 500 }
      ]
    };
  }
  return {
    animath: '0.1', title: 't', level: 'primary', subject: 'math',
    topic: 'shapes', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: [scene('s1'), scene('s2')]
  };
}

test135('interpFields interpolates polygon points pointwise mid-flight (issue #135)', () => {
  var from = { points: [[0, 0], [120, 0], [60, 90]] };
  var to = { points: [[240, 180], [360, 180], [300, 270]] };
  var mid = player135.interpFields(from, to, 0.5);
  assert135.deepEqual(mid.points, [[120, 90], [240, 90], [180, 180]],
    'triangle midpoint across the canvas');
  assert135.deepEqual(player135.interpFields(from, to, 1).points, to.points,
    'p=1 lands exactly on the target points');
});

test135('interpFields skips malformed polygon points instead of throwing (issue #135)', () => {
  assert135.deepEqual(player135.interpFields({ points: [[0, 0]] }, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'unequal point counts no-op');
  assert135.deepEqual(player135.interpFields({ points: [[0, 0], [1, 1]] }, { points: 'nope' }, 0.5), {},
    'non-array to points no-op');
  assert135.deepEqual(player135.interpFields({}, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'missing from points no-op');
  assert135.deepEqual(player135.interpFields({ points: [[0, 0], ['x', 1]] }, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'non-numeric from pair no-op');
  assert135.deepEqual(player135.interpFields({ points: [[0, 0], [1, 1]] }, { points: [[0, 0], [1, 'y']] }, 0.5), {},
    'non-numeric to pair no-op');
});

test135('applyPos serializes polygon points to the SVG points attribute (issue #135)', () => {
  var node = stubNode135();
  var shape = { id: 'tri', kind: 'polygon', points: [[0, 0], [120, 0], [60, 90]] };
  player135.applyPos(node, shape, { points: [[120, 90], [240, 90], [180, 180]] });
  var byName = {};
  node.calls.forEach(function (c) { byName[c[0]] = c[1]; });
  assert135.equal(byName.points, '120,90 240,90 180,180',
    'points serialized as x,y pairs, mirroring drawShape');
});

test135('validator accepts a polygon move with matching point counts (issue #135)', () => {
  var spec = polygonMoveSpec135(
    [[0, 0], [120, 0], [60, 90]],
    [[240, 180], [360, 180], [300, 270]]
  );
  assert135.deepEqual(validateSpec135(spec), [],
    'polygon + {points} with matching point count must be accepted');
});

test135('validator rejects a polygon move with mismatched point counts (issue #135)', () => {
  var spec = polygonMoveSpec135(
    [[0, 0], [120, 0], [60, 90]],
    [[240, 180], [360, 180], [300, 270], [270, 210]]
  );
  var problems = validateSpec135(spec);
  assert135.ok(problems.some(function (p) { return p.includes('.to.points') && p.includes('must match'); }),
    'expected a point-count mismatch error, got: ' + problems.join('; '));
});

test135('validator rejects a polygon move with a non-numeric pair (issue #135)', () => {
  var spec = polygonMoveSpec135(
    [[0, 0], [120, 0], [60, 90]],
    [[240, 180], [360, 'high'], [300, 270]]
  );
  var problems = validateSpec135(spec);
  assert135.ok(problems.some(function (p) { return p.includes('.to:') && p.includes('at least one numeric field'); }),
    'expected a numeric-field error, got: ' + problems.join('; '));
});

/* Tests for issue #150 — dark-mode chrome (prefers-color-scheme: dark).
 * Reads player/player.css as text: the dark block must exist, cover every
 * chrome surface, and redefine the full light palette (no light hex leaks in).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test150 } = require('node:test');
const assert150 = require('node:assert/strict');
const fs150 = require('node:fs');
const path150 = require('node:path');

const css150 = fs150.readFileSync(path150.join(__dirname, '..', 'player', 'player.css'), 'utf8');

function darkBlock150(css) {
  const at = css.indexOf('@media (prefers-color-scheme: dark)');
  assert150.ok(at >= 0, 'player.css has a prefers-color-scheme: dark block');
  const start = css.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  assert150.fail('dark media block braces do not balance');
}

// Every hex hard-coded in the light chrome must be redefined, not reused.
const lightHex150 = ['#1a1a1a', '#fdfcf8', '#e2ddd2', '#3a352c', '#4a4438',
  '#d8d2c4', '#f4f0e6', '#6b6455', '#d99', '#fff5f5', '#8a1f1f'];
const chromeSelectors150 = [
  '.animath-player', '.ap-header', '.ap-stage', '.ap-caption', '.ap-narration',
  '.ap-controls button', '.ap-controls select', '.ap-filmstrip button', '.ap-error',
  '[aria-current="true"]'
];

test150('dark block redefines the whole chrome palette, no light color leaks', () => {
  const dark = darkBlock150(css150);
  lightHex150.forEach(function (hex) {
    assert150.ok(!new RegExp(hex.replace('#', '\\#') + '(?![0-9a-fA-F])').test(dark),
      'dark block must redefine ' + hex + ', not reuse it');
  });
  assert150.ok(!/(^|[^0-9a-fA-F])#fff(?![0-9a-fA-F])/i.test(dark),
    'dark block must not reuse #fff');
  chromeSelectors150.forEach(function (sel) {
    assert150.ok(dark.indexOf(sel) >= 0, 'dark block covers ' + sel);
  });
  assert150.ok(dark.indexOf('.ap-stage svg') >= 0, 'dark block covers the svg stage background');
  assert150.ok(dark.indexOf(':hover') >= 0, 'dark block covers button hover states');
  assert150.ok(dark.indexOf('span[data-a="tlabel"]') >= 0, 'dark block covers the time label');
});
