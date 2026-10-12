/* Tests for player/player.js applyPos — rect size field translation (issue #134).
 * DOM-less: a stub node records setAttribute calls.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

const player = require('../player/player.js');

/* Public API surface lock (issue #707): the top-level player export list is
 * exactly mount, version, and internals. Internal helpers live behind
 * player.internals and must never leak back to the top level.
 */
test('public player export list is frozen', () => {
  assert.deepEqual(Object.keys(player).sort(), ['internals', 'mount', 'version'],
    'public player export list is frozen; new internals must go behind player.internals');
  assert.equal(typeof player.mount, 'function');
  assert.equal(typeof player.version, 'string');
});

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
  var pos = player.internals.interpFields(from, { w: 200, h: 100 }, 0.5);
  player.internals.applyPos(node, shape, pos);
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
  var mid = player135.internals.interpFields(from, to, 0.5);
  assert135.deepEqual(mid.points, [[120, 90], [240, 90], [180, 180]],
    'triangle midpoint across the canvas');
  assert135.deepEqual(player135.internals.interpFields(from, to, 1).points, to.points,
    'p=1 lands exactly on the target points');
});

test135('interpFields skips malformed polygon points instead of throwing (issue #135)', () => {
  assert135.deepEqual(player135.internals.interpFields({ points: [[0, 0]] }, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'unequal point counts no-op');
  assert135.deepEqual(player135.internals.interpFields({ points: [[0, 0], [1, 1]] }, { points: 'nope' }, 0.5), {},
    'non-array to points no-op');
  assert135.deepEqual(player135.internals.interpFields({}, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'missing from points no-op');
  assert135.deepEqual(player135.internals.interpFields({ points: [[0, 0], ['x', 1]] }, { points: [[0, 0], [1, 1]] }, 0.5), {},
    'non-numeric from pair no-op');
  assert135.deepEqual(player135.internals.interpFields({ points: [[0, 0], [1, 1]] }, { points: [[0, 0], [1, 'y']] }, 0.5), {},
    'non-numeric to pair no-op');
});

test135('applyPos serializes polygon points to the SVG points attribute (issue #135)', () => {
  var node = stubNode135();
  var shape = { id: 'tri', kind: 'polygon', points: [[0, 0], [120, 0], [60, 90]] };
  player135.internals.applyPos(node, shape, { points: [[120, 90], [240, 90], [180, 180]] });
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

/* Tests for issue #151 — keyboard-shortcut discoverability (hint + focus ring).
 * shortcutHint() is DOM-free and asserted directly; the CSS rules (hint style,
 * :focus-visible ring, dark-mode overrides) are asserted by reading
 * player/player.css as text, mirroring the #150 dark-block test pattern.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test151 } = require('node:test');
const assert151 = require('node:assert/strict');
const fs151 = require('node:fs');
const path151 = require('node:path');

const player151 = require('../player/player.js');
const css151 = fs151.readFileSync(path151.join(__dirname, '..', 'player', 'player.css'), 'utf8');

test151('shortcutHint names the play/pause key and the scene keys (issue #151)', () => {
  assert151.equal(typeof player151.internals.shortcutHint, 'function', 'shortcutHint is exported');
  const hint = player151.internals.shortcutHint();
  assert151.ok(hint.length > 0, 'hint text is non-empty');
  assert151.ok(/space/i.test(hint), 'hint names Space, got: ' + hint);
  assert151.ok(/arrow|scenes/.test(hint), 'hint names the scene keys, got: ' + hint);
  assert151.ok(!/[<>&`]/.test(hint), 'hint text is innerHTML-safe, got: ' + hint);
});

function ruleBody151(css, selector) {
  const at = css.indexOf(selector);
  assert151.ok(at >= 0, 'player.css has a ' + selector + ' rule');
  const start = css.indexOf('{', at);
  const end = css.indexOf('}', start);
  assert151.ok(start > 0 && end > start, selector + ' rule braces parse');
  return css.slice(start + 1, end);
}

function darkBlock151(css) {
  const at = css.indexOf('@media (prefers-color-scheme: dark)');
  assert151.ok(at >= 0, 'player.css has a prefers-color-scheme: dark block');
  const start = css.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  assert151.fail('dark media block braces do not balance');
}

test151('hint has a muted 12px chrome rule and a visible focus ring', () => {
  const hintRule = ruleBody151(css151, '.ap-kbd-hint');
  assert151.ok(/font-size:\s*12px/.test(hintRule), 'hint is muted 12px, got: ' + hintRule);
  assert151.ok(/color:/.test(hintRule), 'hint has a muted color');
  const focusRule = ruleBody151(css151, '.animath-player:focus-visible');
  assert151.ok(/outline:\s*3px\s+solid\s+#2b5cb8/i.test(focusRule),
    'focus ring uses the accent outline, got: ' + focusRule);
  assert151.ok(/outline-offset:/.test(focusRule), 'focus ring is offset from the chrome');
});

test151('dark block recolors the hint and the focus ring, no light leaks', () => {
  const dark = darkBlock151(css151);
  assert151.ok(dark.indexOf('.ap-kbd-hint') >= 0, 'dark block covers the hint');
  assert151.ok(dark.indexOf('.animath-player:focus-visible') >= 0,
    'dark block covers the focus ring');
  assert151.ok(!/#6b6455/i.test(dark), 'dark block must not reuse the light hint color');
  assert151.ok(!/#2b5cb8/i.test(dark), 'dark block must not reuse the light focus color');
});

/* Tests for issue #152 — responsive control row for narrow/mobile screens.
 * CSS-only change; the wrap rule, the 560px breakpoint, and the 44px touch
 * targets are asserted by reading player/player.css as text, mirroring the
 * #150/#151 test pattern.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test152 } = require('node:test');
const assert152 = require('node:assert/strict');
const fs152 = require('node:fs');
const path152 = require('node:path');

const css152 = fs152.readFileSync(path152.join(__dirname, '..', 'player', 'player.css'), 'utf8');

function ruleBody152(css, selector) {
  const at = css.indexOf(selector);
  assert152.ok(at >= 0, 'player.css has a ' + selector + ' rule');
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  assert152.ok(open > 0 && close > open, selector + ' rule braces parse');
  return css.slice(open + 1, close);
}

function mediaBody152(css, header) {
  const at = css.indexOf(header);
  assert152.ok(at >= 0, 'player.css has a ' + header + ' block');
  const start = css.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  assert152.fail('media block braces do not balance');
}

test152('control row may wrap, desktop flex values unchanged (issue #152)', () => {
  const body = ruleBody152(css152, '.ap-controls');
  assert152.ok(/display:\s*flex/.test(body), 'control row is a flex row, got: ' + body);
  assert152.ok(/flex-wrap:\s*wrap/.test(body), 'control row may wrap, got: ' + body);
  assert152.ok(/align-items:\s*center/.test(body), 'desktop alignment unchanged, got: ' + body);
  assert152.ok(/gap:\s*8px/.test(body), 'desktop gap unchanged, got: ' + body);
});

test152('desktop scrub share is unchanged (flex: 1 outside the breakpoint)', () => {
  const mqAt = css152.indexOf('@media (max-width: 560px)');
  assert152.ok(mqAt >= 0, '560px breakpoint exists');
  const body = ruleBody152(css152.slice(0, mqAt), '.ap-controls input[type="range"]');
  assert152.ok(/flex:\s*1\s*;/.test(body), 'desktop scrub keeps flex: 1, got: ' + body);
});

test152('narrow screens give the scrub slider a full-width second row', () => {
  const mq = mediaBody152(css152, '@media (max-width: 560px)');
  const body = ruleBody152(mq, '.ap-controls input[type="range"]');
  assert152.ok(/flex(-basis)?:\s*[^;]*100%/.test(body),
    'scrub takes the full row width, got: ' + body);
});

test152('coarse pointers get 44px minimum touch targets on control buttons', () => {
  const mq = mediaBody152(css152, '@media (pointer: coarse)');
  const body = ruleBody152(mq, '.ap-controls button');
  assert152.ok(/min-width:\s*44px/.test(body), 'buttons min-width 44px, got: ' + body);
  assert152.ok(/min-height:\s*44px/.test(body), 'buttons min-height 44px, got: ' + body);
});

/* Sector shape: pure sectorPath SVG generation (issue #155).
 * Angles in degrees, 0 = east, positive clockwise (canvas y-down).
 */

test('sectorPath draws a quarter wedge: center, line to arc start, clockwise arc, close', () => {
  var d = player.internals.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 90 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 0 1 100,150 Z');
});

test('sectorPath draws a half wedge with large-arc 0', () => {
  var d = player.internals.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 180 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 0 1 50,100 Z');
});

test('sectorPath sets the large-arc flag for sweeps over 180 degrees', () => {
  var d = player.internals.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 270 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 1 1 100,50 Z');
});

test('sectorPath normalizes wrap-around and reversed angles', () => {
  // 300 -> 60 is a 120-degree clockwise sweep crossing 0 degrees.
  var d = player.internals.sectorPath({ cx: 0, cy: 0, r: 10, startAngle: 300, endAngle: 60 });
  assert.equal(d, 'M0,0 L5,-8.66 A10,10 0 0 1 5,8.66 Z');
  // 90 -> 0 is a 270-degree sweep (not a -90 backtrack).
  var d2 = player.internals.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 90, endAngle: 0 });
  assert.equal(d2, 'M100,100 L100,150 A50,50 0 1 1 150,100 Z');
});

test('sectorPath emits two 180-degree arcs for a full circle', () => {
  var d = player.internals.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 360 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 1 1 50,100 A50,50 0 1 1 150,100 Z');
});

test('sectorPath accepts negative angles and trims float noise', () => {
  var d = player.internals.sectorPath({ cx: 200, cy: 200, r: 80, startAngle: -90, endAngle: 45 });
  assert.equal(d, 'M200,200 L200,120 A80,80 0 0 1 256.569,256.569 Z');
});

/* Dash style for line and arrow (issue #156): pure dashAttr helper.
 * Absent/null/empty = solid (undefined, so el() sets no stroke-dasharray
 * attribute and existing solid lines render byte-identical); otherwise the
 * pattern string passes through to stroke-dasharray verbatim.
 */
test('dashAttr returns undefined for absent, null, or empty dash', () => {
  assert.equal(typeof player.internals.dashAttr, 'function', 'dashAttr must be exported on player.internals');
  assert.equal(player.internals.dashAttr({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }), undefined);
  assert.equal(player.internals.dashAttr({ kind: 'arrow', x1: 0, y1: 0, x2: 10, y2: 0, dash: null }), undefined);
  assert.equal(player.internals.dashAttr({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, dash: '' }), undefined);
});

test('dashAttr passes the dash pattern through verbatim', () => {
  assert.equal(player.internals.dashAttr({ kind: 'line', dash: '6 4' }), '6 4');
  assert.equal(player.internals.dashAttr({ kind: 'arrow', dash: '6.5 4 2 4' }), '6.5 4 2 4');
});

/* Tapered arrow shafts (issue #164): optional widths [tailWidth, headWidth]
 * on arrow — pure isWidths check, pure taperShaft geometry (tail->head-base
 * quadrilateral), and componentwise widths interpolation in interpFields.
 * Plain arrows keep the old stroke-line shaft path.
 */
test('isWidths accepts exactly two positive numbers', () => {
  assert.equal(typeof player.internals.isWidths, 'function', 'isWidths must be exported on player.internals');
  assert.equal(player.internals.isWidths([24, 8]), true);
  assert.equal(player.internals.isWidths([24]), false);
  assert.equal(player.internals.isWidths([24, 8, 2]), false);
  assert.equal(player.internals.isWidths([0, 8]), false);
  assert.equal(player.internals.isWidths([24, -1]), false);
  assert.equal(player.internals.isWidths('24,8'), false);
  assert.equal(player.internals.isWidths([24, NaN]), false);
  assert.equal(player.internals.isWidths(undefined), false);
});

test('taperShaft builds the tail->head-base quadrilateral', () => {
  assert.equal(typeof player.internals.taperShaft, 'function', 'taperShaft must be exported on player.internals');
  // horizontal arrow (0,0)->(100,0), wt=20, wh=6, headSize=22: shaft ends at x=78.
  assert.equal(player.internals.taperShaft({ x1: 0, y1: 0, x2: 100, y2: 0 }, 20, 6, 22), '0,10 78,3 78,-3 0,-10');
});

test('taperShaft handles vertical shafts and equal widths', () => {
  // (50,10)->(50,110), wt=wh=8, headSize=26: shaft ends at y=84.
  assert.equal(player.internals.taperShaft({ x1: 50, y1: 10, x2: 50, y2: 110 }, 8, 8, 26), '46,10 46,84 54,84 54,10');
});

test('taperShaft falls back to a square nub on zero-length shafts', () => {
  assert.equal(player.internals.taperShaft({ x1: 5, y1: 5, x2: 5, y2: 5 }, 10, 10, 30), '5,10 5,10 5,0 5,0');
});

test('interpFields interpolates arrow widths componentwise (issue #164)', () => {
  var from = { x1: 0, y1: 0, x2: 100, y2: 0, widths: [4, 4] };
  assert.deepEqual(player.internals.interpFields(from, { widths: [20, 6] }, 0.5).widths, [12, 5]);
  assert.deepEqual(player.internals.interpFields(from, { widths: [20, 6] }, 1).widths, [20, 6]);
  assert.deepEqual(player.internals.interpFields(from, { widths: [20, 6] }, 0).widths, [4, 4]);
});

test('interpFields skips malformed widths instead of throwing (issue #164)', () => {
  var from = { x1: 0, y1: 0, x2: 100, y2: 0, widths: [4, 4] };
  assert.ok(!('widths' in player.internals.interpFields(from, { widths: 'wide' }, 0.5)), 'non-array skipped');
  assert.ok(!('widths' in player.internals.interpFields(from, { widths: [4] }, 0.5)), 'wrong length skipped');
  assert.ok(!('widths' in player.internals.interpFields(from, { widths: [4, -2] }, 0.5)), 'negative skipped');
  // no start value on the shown shape: the taper snaps in at move end,
  // so there is no interpolated mid-flight value.
  var noStart = player.internals.interpFields({ x1: 0, y1: 0, x2: 100, y2: 0 }, { widths: [20, 6] }, 0.5);
  assert.ok(!('widths' in noStart), 'no from.widths -> skipped mid-flight');
});

/* Issue #173 — explain-me-this tooltips: pure explainText + tipPoint.
 * explainText maps a shape to its tooltip text ('' = inert, never a
 * tooltip target); tipPoint clamps the tooltip's top-left corner inside
 * the stage. Both are DOM-free; the mount() event wiring and tooltip
 * positioning are browser-only (verified by reading the diff).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test173 } = require('node:test');
const assert173 = require('node:assert/strict');

const player173 = require('../player/player.js');

test173('explainText is exported and returns the authored text (issue #173)', () => {
  assert173.equal(typeof player173.internals.explainText, 'function', 'explainText must be exported');
  assert173.equal(player173.internals.explainText({ kind: 'circle', explain: 'A part, explained.' }), 'A part, explained.');
});

test173('explainText is blank for missing, empty, or non-string explain (issue #173)', () => {
  assert173.equal(player173.internals.explainText({ kind: 'circle' }), '', 'missing field is inert');
  assert173.equal(player173.internals.explainText({ kind: 'circle', explain: '' }), '', 'empty string is inert');
  assert173.equal(player173.internals.explainText({ kind: 'circle', explain: '   ' }), '', 'whitespace-only is inert');
  assert173.equal(player173.internals.explainText({ kind: 'circle', explain: 42 }), '', 'non-string is inert');
  assert173.equal(player173.internals.explainText({ kind: 'circle', explain: null }), '', 'null is inert');
  assert173.equal(player173.internals.explainText(null), '', 'null shape is inert');
});

test173('tipPoint offsets the tooltip from the pointer inside the stage (issue #173)', () => {
  assert173.equal(typeof player173.internals.tipPoint, 'function', 'tipPoint must be exported');
  assert173.deepEqual(player173.internals.tipPoint(480, 270, 960, 540), { x: 492, y: 286 },
    'centered pointer: tooltip lands dx=12, dy=16 away');
});

test173('tipPoint clamps the tooltip inside the stage edges (issue #173)', () => {
  assert173.deepEqual(player173.internals.tipPoint(950, 270, 960, 540), { x: 712, y: 286 },
    'pointer near the right edge: tooltip stays left of the edge');
  assert173.deepEqual(player173.internals.tipPoint(480, 530, 960, 540), { x: 492, y: 422 },
    'pointer near the bottom: tooltip stays above the edge');
  assert173.deepEqual(player173.internals.tipPoint(950, 530, 960, 540), { x: 712, y: 422 },
    'bottom-right corner clamps both axes');
  assert173.deepEqual(player173.internals.tipPoint(-50, -50, 960, 540), { x: 8, y: 8 },
    'pointer outside top-left clamps to the 8px margin');
});

test173('tipPoint degrades gracefully on a tiny stage (issue #173)', () => {
  assert173.deepEqual(player173.internals.tipPoint(10, 10, 100, 80), { x: 8, y: 8 },
    'stage smaller than the tooltip: pins to the margin, never negative');
});

/* Issue #173 — tooltip CSS: the .ap-tooltip rule positions the tooltip,
 * keeps it out of the click path, and hides it by default; explained
 * shapes get a visible keyboard focus ring; the dark block recolors both.
 * Mirrors the #150/#151/#152 CSS-as-text test pattern.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test173c } = require('node:test');
const assert173c = require('node:assert/strict');
const fs173c = require('node:fs');
const path173c = require('node:path');

const css173c = fs173c.readFileSync(path173c.join(__dirname, '..', 'player', 'player.css'), 'utf8');

function ruleBody173c(css, selector) {
  const at = css.indexOf(selector);
  assert173c.ok(at >= 0, 'player.css has a ' + selector + ' rule');
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  assert173c.ok(open > 0 && close > open, selector + ' rule braces parse');
  return css.slice(open + 1, close);
}

function mediaBody173c(css, header) {
  const at = css.indexOf(header);
  assert173c.ok(at >= 0, 'player.css has a ' + header + ' block');
  const start = css.indexOf('{', at);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  assert173c.fail('media block braces do not balance');
}

test173c('tooltip is absolutely positioned, click-transparent, hidden by default (issue #173)', () => {
  const body = ruleBody173c(css173c, '.ap-tooltip');
  assert173c.ok(/position:\s*absolute/.test(body), 'tooltip floats over the stage, got: ' + body);
  assert173c.ok(/display:\s*none/.test(body), 'tooltip hidden by default, got: ' + body);
  assert173c.ok(/pointer-events:\s*none/.test(body), 'tooltip never blocks clicks, got: ' + body);
  assert173c.ok(/max-width:\s*240px/.test(body), 'tooltip width capped at 240px, got: ' + body);
  assert173c.ok(/z-index:\s*\d+/.test(body), 'tooltip layers above stage art, got: ' + body);
});

test173c('explained shapes get a visible keyboard focus ring (issue #173)', () => {
  const body = ruleBody173c(css173c, '.ap-stage svg [data-shape-id]:focus');
  assert173c.ok(/outline:\s*2px\s+solid\s+#2b5cb8/i.test(body),
    'focus ring uses the accent outline, got: ' + body);
  assert173c.ok(/outline-offset:/.test(body), 'focus ring is offset from the shape');
});

test173c('dark block recolors the tooltip and the focus ring, no light leaks (issue #173)', () => {
  const dark = mediaBody173c(css173c, '@media (prefers-color-scheme: dark)');
  assert173c.ok(dark.indexOf('.ap-tooltip') >= 0, 'dark block covers the tooltip');
  assert173c.ok(dark.indexOf('.ap-stage svg [data-shape-id]:focus') >= 0,
    'dark block covers the shape focus ring');
  assert173c.ok(!/#2b5cb8/i.test(dark), 'dark block must not reuse the light focus color');
});

/* Tests for issue #463 — latexFallbackText balanced-brace fallback.
 * Pure string work: no DOM. Covers the acceptance case (nested \text
 * inside \frac on the real chem-mole s2 tex), \sqrt with nested braces,
 * backslash-space, unknown-command stripping (no name may leak), braced
 * superscripts, stray/unbalanced braces, and the no-leak sweep over every
 * tex string in samples/*.json.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test463 } = require('node:test');
const assert463 = require('node:assert/strict');
const fs463 = require('fs');
const path463 = require('path');

const player463 = require('../player/player.js');

test463('latexFallbackText resolves the chem-mole nested-brace tex exactly (issue #463)', () => {
  const tex = 'n = \\frac{12\\ \\text{g}}{12\\ \\text{g/mol}} = 1\\ \\text{mol}';
  assert463.equal(player463.internals.latexFallbackText(tex), 'n = 12 g/12 g/mol = 1 mol');
});

test463('latexFallbackText handles nested braces in \\frac and \\sqrt (issue #463)', () => {
  assert463.equal(player463.internals.latexFallbackText('\\frac{1}{2}'), '1/2');
  assert463.equal(player463.internals.latexFallbackText('\\frac{\\text{a}}{\\text{b}}'), 'a/b');
  assert463.equal(player463.internals.latexFallbackText('\\frac{\\frac{1}{2}}{3}'), '1/2/3');
  assert463.equal(player463.internals.latexFallbackText('\\sqrt{x^2 + y^2}'), '\u221A(x\u00B2 + y\u00B2)');
  assert463.equal(player463.internals.latexFallbackText('\\sqrt{\\frac{a}{b}}'), '\u221A(a/b)');
});

test463('latexFallbackText treats backslash-space as a space and keeps replacements (issue #463)', () => {
  assert463.equal(player463.internals.latexFallbackText('a\\ b'), 'a b');
  assert463.equal(player463.internals.latexFallbackText('a^2 + b^3'), 'a\u00B2 + b\u00B3');
  assert463.equal(player463.internals.latexFallbackText('x^{2} + y^{3}'), 'x\u00B2 + y\u00B3');
  assert463.equal(player463.internals.latexFallbackText('\\pi \\times \\theta \\approx 2'), '\u03C0 \u00D7 \u03B8 \u2248 2');
  assert463.equal(player463.internals.latexFallbackText('10\\% off'), '10% off');
});

test463('latexFallbackText strips unknown commands without leaking names (issue #463)', () => {
  assert463.equal(player463.internals.latexFallbackText('\\alpha + x'), ' + x');
  assert463.equal(player463.internals.latexFallbackText('\\rightarrow'), '');
  assert463.equal(player463.internals.latexFallbackText('\\text{plain}'), 'plain');
});

test463('latexFallbackText drops stray braces and survives unbalanced input (issue #463)', () => {
  assert463.equal(player463.internals.latexFallbackText('{a} b }c{'), 'a b c');
  assert463.equal(player463.internals.latexFallbackText('x^{n} + w^n'), 'x^n + w^n');
  assert463.equal(player463.internals.latexFallbackText('\\frac{1'), '1');
  assert463.equal(player463.internals.latexFallbackText('\\frac{1}'), '');
  assert463.equal(player463.internals.latexFallbackText('\\frac12'), '12');
  assert463.equal(player463.internals.latexFallbackText('\\frac{1}2'), '2');
  assert463.equal(player463.internals.latexFallbackText('plain text'), 'plain text');
});

test463('no tex string in samples/*.json leaks a command name into the fallback (issue #463)', () => {
  const samplesDir = path463.join(__dirname, '..', 'samples');
  const files = fs463.readdirSync(samplesDir).filter((f) => f.endsWith('.json'));
  let count = 0;
  function walk(o) {
    if (typeof o === 'string') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) {
        if (k === 'tex' && typeof o[k] === 'string') {
          count++;
          const out = player463.internals.latexFallbackText(o[k]);
          assert463.ok(!/\\[a-zA-Z]/.test(out),
            'fallback leaked a command in ' + JSON.stringify(o[k]) + ' -> ' + JSON.stringify(out));
        }
        walk(o[k]);
      }
    }
  }
  files.forEach((f) => walk(JSON.parse(fs463.readFileSync(path463.join(samplesDir, f), 'utf8'))));
  assert463.ok(count > 0, 'expected to find tex strings in samples/');
});

/* Tests for issue #554 — player keeps autoplay across scene boundaries.
 * mount() closes over document/requestAnimationFrame/performance, so this
 * test installs a minimal DOM + rAF stub and drives the captured rAF
 * callbacks by hand. Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test554 } = require('node:test');
const assert554 = require('node:assert/strict');

const player554 = require('../player/player.js');
const { validateSpec: validateSpec554 } = require('../player/validate.js');

function inertEl554(shared) {
  return {
    className: '', textContent: '', innerHTML: '', value: '0',
    style: {},
    setAttribute: function () {},
    removeAttribute: function () {},
    addEventListener: function () {},
    appendChild: function () {},
    removeChild: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 960, height: 540 }; },
    querySelector: function (sel) {
      return shared[sel] || inertEl554(shared);
    }
  };
}

function boundarySpec554() {
  function scene(id, duration) {
    return {
      id: id, caption: 'caption ' + id, narration: 'narration ' + id,
      duration_ms: duration,
      steps: [
        { at_ms: 0, do: 'show', shape: { id: 'box-' + id, kind: 'rect', x: 10, y: 10, w: 100, h: 50 } }
      ]
    };
  }
  return {
    animath: '0.1', title: 'boundary test', level: 'primary', subject: 'math',
    topic: 'shapes', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: [scene('s1', 4000), scene('s2', 6000)]
  };
}

test554('issue #554: autoplay continues across a scene boundary, pauses only at the final scene end', () => {
  var spec = boundarySpec554();
  assert554.deepEqual(validateSpec554(spec), [], 'fixture spec must validate clean');

  var shared = {};
  var btnPlay = inertEl554(shared);
  shared['[data-a="play"]'] = btnPlay;
  shared['[data-a="scrub"]'] = inertEl554(shared);
  var tlabel = inertEl554(shared);
  shared['[data-a="tlabel"]'] = tlabel;
  shared['[data-a="speed"]'] = inertEl554(shared);

  var rafQueue = [];
  var rafById = {};
  var rafId = 0;
  var now = 1000;

  var prevDocument = global.document;
  var prevRaf = global.requestAnimationFrame;
  var prevCaf = global.cancelAnimationFrame;
  var prevPerf = global.performance;
  global.document = {
    createElement: function () { return inertEl554(shared); },
    createElementNS: function () { return inertEl554(shared); }
  };
  global.requestAnimationFrame = function (cb) {
    rafId += 1;
    rafById[rafId] = cb;
    rafQueue.push(rafId);
    return rafId;
  };
  global.cancelAnimationFrame = function (id) {
    delete rafById[id];
    rafQueue = rafQueue.filter(function (x) { return x !== id; });
  };
  global.performance = { now: function () { return now; } };

  function pump(advance) {
    now += advance;
    var ids = rafQueue;
    rafQueue = [];
    ids.forEach(function (id) {
      var cb = rafById[id];
      delete rafById[id];
      if (cb) cb(now);
    });
  }

  try {
    var sceneEvents = [];
    var p = player554.mount(inertEl554(shared), spec);
    p.on('scene', function (i) { sceneEvents.push(i); });

    p.play();
    assert554.ok(btnPlay.innerHTML.indexOf('10074') !== -1, 'playing: pause glyph shown after play()');

    // Drive past scene 1's 4000ms duration; goScene(1, 0) must fire and the
    // loop must keep running into scene 2.
    for (var k = 0; k < 10 && sceneEvents.indexOf(1) === -1; k++) pump(500);
    assert554.ok(sceneEvents.indexOf(1) !== -1, 'boundary crossed: scene 1 rendered during autoplay');
    assert554.ok(btnPlay.innerHTML.indexOf('10074') !== -1,
      'still playing after the first scene boundary (no pause at the boundary)');

    // A further frame must advance scene 2's clock: the rAF loop is alive.
    var tlabelBefore = tlabel.textContent;
    pump(1500);
    assert554.notEqual(tlabel.textContent, tlabelBefore,
      'scene 2 time advances after the boundary: autoplay loop still ticking');

    // Drive past the final scene's 6000ms duration: only here may pause run.
    for (var j = 0; j < 20 && btnPlay.innerHTML.indexOf('10074') !== -1; j++) pump(500);
    assert554.ok(btnPlay.innerHTML.indexOf('9654') !== -1,
      'paused only at the end of the last scene (play glyph shown)');
    var frozen = tlabel.textContent;
    pump(500);
    assert554.equal(tlabel.textContent, frozen, 'clock frozen after final-scene pause');

    // Manual navigation must still pause: jump forward on a fresh playing run.
    p.play();
    assert554.ok(btnPlay.innerHTML.indexOf('10074') !== -1, 'playing again before the manual-jump check');
    p.nextScene();
    assert554.ok(btnPlay.innerHTML.indexOf('9654') !== -1,
      'manual nextScene() leaves the player paused');
    p.destroy();
  } finally {
    global.document = prevDocument;
    global.requestAnimationFrame = prevRaf;
    global.cancelAnimationFrame = prevCaf;
    global.performance = prevPerf;
  }
});

/* Tests for issue #634 — mount() validates the spec and throws a clear error.
 * (a) malformed spec throws naming the failing field; (b) version mismatch
 * rejected naming animath; (c) valid spec still mounts (positive smoke, with
 * the global AnimathValidate lookup branch covered via globalThis).
 */
'use strict';
const { test: test634 } = require('node:test');
const assert634 = require('node:assert/strict');

const player634 = require('../player/player.js');

function spec634(overrides) {
  var spec = {
    animath: '0.1', title: 'validate smoke', level: 'primary', subject: 'math',
    topic: 'shapes', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: [
      { id: 's1', caption: 'cap', narration: 'narr', duration_ms: 4000,
        steps: [{ at_ms: 0, do: 'show', shape: { id: 'b1', kind: 'rect', x: 10, y: 10, w: 100, h: 50 } }] },
      { id: 's2', caption: 'cap2', narration: 'narr2', duration_ms: 4000,
        steps: [{ at_ms: 0, do: 'show', shape: { id: 'b2', kind: 'rect', x: 20, y: 20, w: 100, h: 50 } }] }
    ]
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { spec[k] = overrides[k]; });
  return spec;
}

test634('issue #634: mount() throws Error naming the failing field for a malformed spec', () => {
  assert634.throws(
    function () { player634.mount(inertEl554({}), {}); },
    /canvas:/,
    'malformed spec must throw naming the failing field (canvas)'
  );
});

test634('issue #634: mount() rejects a version-mismatched spec naming animath', () => {
  assert634.throws(
    function () { player634.mount(inertEl554({}), spec634({ animath: '0.2' })); },
    /animath:/,
    'version mismatch must throw naming the animath field'
  );
});

test634('issue #634: valid spec still mounts, via the global AnimathValidate lookup', () => {
  var shared = {};
  var prevDocument = global.document;
  var prevRaf = global.requestAnimationFrame;
  var prevCaf = global.cancelAnimationFrame;
  var prevPerf = global.performance;
  var prevValidate = globalThis.AnimathValidate;
  global.document = {
    createElement: function () { return inertEl554(shared); },
    createElementNS: function () { return inertEl554(shared); }
  };
  global.requestAnimationFrame = function () { return 1; };
  global.cancelAnimationFrame = function () {};
  global.performance = { now: function () { return 0; } };
  globalThis.AnimathValidate = require('../player/validate.js');
  try {
    var p = player634.mount(inertEl554(shared), spec634());
    assert634.ok(p && typeof p.destroy === 'function', 'valid spec mounts via the global lookup');
    p.destroy();
  } finally {
    global.document = prevDocument;
    global.requestAnimationFrame = prevRaf;
    global.cancelAnimationFrame = prevCaf;
    global.performance = prevPerf;
    if (prevValidate === undefined) delete globalThis.AnimathValidate;
    else globalThis.AnimathValidate = prevValidate;
  }
});

/* Tests for issue #631 — player.js line coverage 77% -> 90%+.
 * The #554 harness stubs addEventListener as a no-op, so DOM rendering
 * paths (drawShape kinds, tweens, tooltip wiring, control/keyboard wiring,
 * caption/hide/emphasize, fitLatex) were uncovered. This block extends the
 * harness: the inert element records listeners per element (dispatch631
 * replays synthetic events), records setAttribute attrs, and maintains
 * parentNode/firstChild/children so hide-removal and clearScene work.
 * No production code changes — tests only.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test: test631 } = require('node:test');
const assert631 = require('node:assert/strict');

const player631 = require('../player/player.js');
const { validateSpec: validateSpec631 } = require('../player/validate.js');

function inertEl631(shared, tag) {
  var listeners = {};
  var el = {
    tagName: tag || '',
    className: '', textContent: '', innerHTML: '', value: '0',
    style: {},
    attrs: {},
    parentNode: null, firstChild: null, children: [],
    setAttribute: function (n, v) { el.attrs[n] = v; },
    removeAttribute: function (n) { delete el.attrs[n]; },
    getAttribute: function (n) { return el.attrs[n]; },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatch631: function (t, evt) {
      (listeners[t] || []).forEach(function (fn) { fn(evt || {}); });
    },
    listenerCount631: function (t) { return (listeners[t] || []).length; },
    appendChild: function (c) {
      // DOM move semantics: appending a node that already has a parent
      // reparents it (applyPos relies on this when rebuilding arrows).
      var old = c.parentNode;
      if (old && old !== el && typeof old.removeChild === 'function') old.removeChild(c);
      if (old === el) {
        var i = el.children.indexOf(c);
        if (i !== -1) el.children.splice(i, 1);
      }
      el.children.push(c);
      c.parentNode = el;
      el.firstChild = el.children[0];
      return c;
    },
    removeChild: function (c) {
      var i = el.children.indexOf(c);
      if (i !== -1) el.children.splice(i, 1);
      c.parentNode = null;
      el.firstChild = el.children[0] || null;
      return c;
    },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 960, height: 540 }; },
    querySelector: function (sel) { return shared[sel] || inertEl631(shared); }
  };
  return el;
}

function findByAttr631(created, name, val) {
  return created.filter(function (e) { return e.attrs[name] === val; });
}

function findByClass631(created, cls) {
  return created.filter(function (e) { return e.className === cls; });
}

// Last match: re-renders (seekScene/goScene) create fresh shape nodes, so
// after navigation the live node is the most recently created one.
function lastByAttr631(created, name, val) {
  var m = findByAttr631(created, name, val);
  return m[m.length - 1];
}

// Installs document/rAF/performance stubs (tracked element creation),
// with optional reduced-motion matchMedia and a fake KaTeX. Returns
// { pump, restore }.
function globals631(shared, created, opts) {
  opts = opts || {};
  var rafQueue = [];
  var rafById = {};
  var rafId = 0;
  var now = 1000;
  var prev = {
    document: global.document,
    raf: global.requestAnimationFrame,
    caf: global.cancelAnimationFrame,
    perf: global.performance,
    matchMedia: global.matchMedia,
    katex: global.katex
  };
  global.document = {
    createElement: function (tag) {
      var e = inertEl631(shared, tag); created.push(e); return e;
    },
    createElementNS: function (ns, tag) {
      var e = inertEl631(shared, tag); created.push(e); return e;
    }
  };
  global.requestAnimationFrame = function (cb) {
    rafId += 1; rafById[rafId] = cb; rafQueue.push(rafId); return rafId;
  };
  global.cancelAnimationFrame = function (id) {
    delete rafById[id];
    rafQueue = rafQueue.filter(function (x) { return x !== id; });
  };
  global.performance = { now: function () { return now; } };
  if (opts.reducedMotion !== undefined) {
    global.matchMedia = function () { return { matches: !!opts.reducedMotion }; };
  }
  if (opts.katex) global.katex = opts.katex;
  return {
    pump: function (advance) {
      now += advance;
      var ids = rafQueue;
      rafQueue = [];
      ids.forEach(function (id) {
        var cb = rafById[id];
        delete rafById[id];
        if (cb) cb(now);
      });
    },
    restore: function () {
      global.document = prev.document;
      global.requestAnimationFrame = prev.raf;
      global.cancelAnimationFrame = prev.caf;
      global.performance = prev.perf;
      if (prev.matchMedia === undefined) delete global.matchMedia;
      else global.matchMedia = prev.matchMedia;
      if (prev.katex === undefined) delete global.katex;
      else global.katex = prev.katex;
    }
  };
}

function baseSpec631(scenes) {
  return {
    animath: '0.1', title: 'coverage sweep', level: 'primary', subject: 'math',
    topic: 'shapes', kind: 'concept', canvas: { width: 960, height: 540 },
    scenes: scenes
  };
}

// The validator allows 1..8 scenes; the second scene here is a filler the
// tests never navigate to (all pumps stay inside scene 0's duration).
function fillerScene631(id) {
  return {
    id: id, caption: 'filler ' + id, narration: 'filler narr', duration_ms: 4000,
    steps: [{ at_ms: 0, do: 'show', shape: { id: 'f-' + id, kind: 'rect', x: 5, y: 5, w: 20, h: 20 } }]
  };
}

// One show step per drawShape kind (text, latex, rect, circle, line, arrow,
// tapered arrow, polygon, sector), all instant (reducedMotion path).
function sweepSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'all kinds', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 't1', kind: 'text', x: 10, y: 20, text: 'hello' } },
      { at_ms: 0, do: 'show', shape: { id: 'lx1', kind: 'latex', x: 40, y: 30, tex: '\\frac{1}{2}' } },
      { at_ms: 0, do: 'show', shape: { id: 'r1', kind: 'rect', x: 10, y: 10, w: 100, h: 50 } },
      { at_ms: 0, do: 'show', shape: { id: 'c1', kind: 'circle', cx: 200, cy: 100, r: 30 } },
      { at_ms: 0, do: 'show', shape: { id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 100, dash: '6 4' } },
      { at_ms: 0, do: 'show', shape: { id: 'a1', kind: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0 } },
      { at_ms: 0, do: 'show', shape: { id: 'a2', kind: 'arrow', x1: 0, y1: 40, x2: 120, y2: 40, widths: [20, 6] } },
      { at_ms: 0, do: 'show', shape: { id: 'p1', kind: 'polygon', points: [[0, 0], [120, 0], [60, 90]] } },
      { at_ms: 0, do: 'show', shape: { id: 's1s', kind: 'sector', cx: 300, cy: 300, r: 50, startAngle: 0, endAngle: 90 } }
    ]
  }, fillerScene631('s2')]);
}

// Rect + arrow moves plus a latex fallback show (no KaTeX in node).
function tweenSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'tweens', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 'mv', kind: 'rect', x: 10, y: 10, w: 40, h: 40 } },
      { at_ms: 0, do: 'show', shape: { id: 'ar', kind: 'arrow', x1: 0, y1: 0, x2: 60, y2: 0 } },
      { at_ms: 0, do: 'show', shape: { id: 'lx', kind: 'latex', x: 10, y: 200, tex: 'x^2' } },
      { at_ms: 200, do: 'move', target: 'mv', to: { x: 110, y: 60 }, dur_ms: 400 },
      { at_ms: 200, do: 'move', target: 'ar', to: { x2: 160 }, dur_ms: 400 }
    ]
  }, fillerScene631('s2')]);
}

// caption/hide/emphasize: hide removes 'gone', emphasize on the hidden
// target hits the missing-target break, emphasize on 'box' is instant.
function cueSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'scene cap', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 'box', kind: 'rect', x: 10, y: 10, w: 50, h: 50 } },
      { at_ms: 0, do: 'show', shape: { id: 'gone', kind: 'circle', cx: 100, cy: 100, r: 20 } },
      { at_ms: 0, do: 'caption', text: 'step caption wins' },
      { at_ms: 100, do: 'hide', target: 'gone' },
      { at_ms: 200, do: 'emphasize', target: 'gone' },
      { at_ms: 300, do: 'emphasize', target: 'box' },
      { at_ms: 350, do: 'move', target: 'box', to: { x: 200 }, dur_ms: 100 }
    ]
  }, fillerScene631('s2')]);
}

// Non-instant hide: fade via opacity then real-timer removal.
function fadeSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'fade', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 'box', kind: 'rect', x: 10, y: 10, w: 50, h: 50 } },
      { at_ms: 200, do: 'hide', target: 'box' }
    ]
  }, fillerScene631('s2')]);
}

// Non-instant emphasize: pulse registered on the tick path.
function pulseSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'pulse', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 'box', kind: 'rect', x: 10, y: 10, w: 50, h: 50 } },
      { at_ms: 100, do: 'emphasize', target: 'box', dur_ms: 300 }
    ]
  }, fillerScene631('s2')]);
}

// Tooltip: one explained shape, one inert shape.
function tipSpec631() {
  return baseSpec631([{
    id: 's1', caption: 'tips', narration: 'narr', duration_ms: 4000,
    steps: [
      { at_ms: 0, do: 'show', shape: { id: 'tipbox', kind: 'rect', x: 10, y: 10, w: 50, h: 50, explain: 'A box, explained.' } },
      { at_ms: 0, do: 'show', shape: { id: 'plain', kind: 'rect', x: 100, y: 10, w: 50, h: 50 } }
    ]
  }, fillerScene631('s2')]);
}

// Two scenes for the control/keyboard/strip sweep.
function chromeSpec631() {
  function scene(id) {
    return {
      id: id, caption: 'cap ' + id, narration: 'narr ' + id, duration_ms: 4000,
      steps: [{ at_ms: 0, do: 'show', shape: { id: 'b-' + id, kind: 'rect', x: 10, y: 10, w: 50, h: 50 } }]
    };
  }
  return baseSpec631([scene('s1'), scene('s2')]);
}

test631('issue #631: shape-kind sweep renders every drawShape kind instantly', () => {
  var spec = sweepSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, {
    reducedMotion: true,
    katex: { renderToString: function () { return '<span>x</span>'; } }
  });
  try {
    var p = player631.mount(inertEl631(shared), spec);
    var svg = created.filter(function (e) { return e.tagName === 'svg'; })[0];
    assert631.equal(svg.children.length, 9, 'all nine kind steps appended a node');
    ['t1', 'lx1', 'r1', 'c1', 'l1', 'a1', 'a2', 'p1', 's1s'].forEach(function (id) {
      assert631.equal(findByAttr631(created, 'data-shape-id', id).length, 1,
        'shape ' + id + ' recorded its data-shape-id');
    });
    // KaTeX present: latex took the foreignObject path and fitLatex ran.
    var lx = findByAttr631(created, 'data-shape-id', 'lx1')[0];
    assert631.equal(lx.tagName, 'foreignObject', 'latex rendered into a foreignObject');
    assert631.equal(lx.attrs.width, 920, 'fitLatex sized the box to the available width');
    assert631.ok(String(lx.children[0].style.transform).indexOf('scale(') === 0,
      'fitLatex scaled the overflowing equation down');
    // Arrows: plain shaft is line+head, tapered shaft is polygon+head.
    assert631.equal(findByAttr631(created, 'data-shape-id', 'a1')[0].children.length, 2,
      'plain arrow: shaft line + head polygon');
    assert631.equal(findByAttr631(created, 'data-shape-id', 'a2')[0].children.length, 2,
      'tapered arrow: shaft polygon + head polygon');
    // Instant path: no rAF fade, opacity set synchronously.
    assert631.equal(findByAttr631(created, 'data-shape-id', 'r1')[0].style.opacity, '1',
      'instant show sets opacity without timers');
    // Shapes without explain text stay inert: no tooltip listeners wired.
    assert631.equal(findByAttr631(created, 'data-shape-id', 'r1')[0].listenerCount631('mouseenter'), 0,
      'no explain text -> wireExplain early return, no listeners');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: move tweens register and complete through the tick loop', () => {
  var spec = tweenSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, {});
  try {
    var p = player631.mount(inertEl631(shared), spec);
    var rectNode = findByAttr631(created, 'data-shape-id', 'mv')[0];
    var arrowNode = findByAttr631(created, 'data-shape-id', 'ar')[0];
    p.play();
    g.pump(100);  // sceneTime 100
    g.pump(150);  // sceneTime 250: both move steps fire, tweens registered
    g.pump(200);  // sceneTime 450: p=0.5 mid-flight
    var midX = rectNode.attrs.x;
    assert631.ok(midX > 10 && midX < 110, 'mid-tween rect x interpolated, got ' + midX);
    g.pump(200);  // sceneTime 650: tweens complete
    assert631.equal(rectNode.attrs.x, 110, 'rect tween lands on the target x');
    assert631.equal(rectNode.attrs.y, 60, 'rect tween lands on the target y');
    assert631.equal(arrowNode.attrs.x2, 160, 'arrow tween lands on the target x2');
    assert631.equal(arrowNode.children.length, 2,
      'arrow applyPos rebuilt shaft+head children mid-tween');
    // Latex without KaTeX: fallback text path, no foreignObject.
    var lx = findByAttr631(created, 'data-shape-id', 'lx')[0];
    assert631.equal(lx.tagName, 'text', 'latex falls back to a text node without KaTeX');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: caption, instant hide, and emphasize breaks', () => {
  var spec = cueSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, { reducedMotion: true });
  try {
    var p = player631.mount(inertEl631(shared), spec);
    p.seekScene(0, 400);  // fire every step, all instant
    var captionBar = findByClass631(created, 'ap-caption')[0];
    assert631.equal(captionBar.textContent, 'step caption wins', 'caption step wins over the scene caption');
    var goneNode = lastByAttr631(created, 'data-shape-id', 'gone');
    var boxNode = lastByAttr631(created, 'data-shape-id', 'box');
    var svg = created.filter(function (e) { return e.tagName === 'svg'; })[0];
    assert631.equal(goneNode.parentNode, null, 'instant hide removed the node from the stage');
    assert631.equal(svg.children.length, 1, 'only the surviving shape remains');
    assert631.equal(svg.children[0], boxNode, 'the survivor is the unhidden shape');
    assert631.equal(boxNode.parentNode, svg, 'survivor still parented to the stage');
    assert631.equal(boxNode.attrs.x, 200, 'instant move applies the target position');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: non-instant hide fades then removes after a real timer', async () => {
  var spec = fadeSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, {});
  try {
    var p = player631.mount(inertEl631(shared), spec);
    var boxNode = findByAttr631(created, 'data-shape-id', 'box')[0];
    p.play();
    g.pump(250);  // sceneTime 250: hide fires non-instant
    assert631.equal(boxNode.style.opacity, '0', 'non-instant hide starts the fade');
    assert631.ok(boxNode.parentNode !== null, 'node still parented during the fade');
    await new Promise(function (r) { setTimeout(r, 450); });  // FADE_MS + 50 = 350
    assert631.equal(boxNode.parentNode, null, 'fade timer removed the node');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: non-instant emphasize pulses through the tick loop', () => {
  var spec = pulseSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, {});
  try {
    var p = player631.mount(inertEl631(shared), spec);
    var boxNode = findByAttr631(created, 'data-shape-id', 'box')[0];
    p.play();
    g.pump(150);  // sceneTime 150: emphasize fires, pulse registered
    assert631.ok(String(boxNode.style.transform).indexOf('scale(') === 0,
      'pulse loop sets a scale transform mid-pulse, got ' + boxNode.style.transform);
    g.pump(900);  // past the 300ms pulse duration: pulse completes
    assert631.equal(boxNode.style.transform, '', 'pulse completion clears the transform');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: tooltip shows and hides on hover, tap, and keyboard focus', () => {
  var spec = tipSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var g = globals631(shared, created, { reducedMotion: true });
  try {
    var p = player631.mount(inertEl631(shared), spec);
    var tipbox = findByAttr631(created, 'data-shape-id', 'tipbox')[0];
    var plain = findByAttr631(created, 'data-shape-id', 'plain')[0];
    var tip = findByClass631(created, 'ap-tooltip')[0];
    assert631.equal(tipbox.listenerCount631('mouseenter'), 1, 'explained shape wires mouseenter');
    assert631.equal(tipbox.attrs.tabindex, '0', 'explained shape is focusable');
    assert631.equal(plain.listenerCount631('mouseenter'), 0, 'inert shape wires nothing');
    tipbox.dispatch631('mouseenter', { clientX: 100, clientY: 100 });
    assert631.equal(tip.style.display, 'block', 'hover shows the tooltip');
    assert631.equal(tip.textContent, 'A box, explained.', 'tooltip carries the authored text');
    assert631.equal(tip.style.left, '112px', 'tooltip anchored near the pointer');
    tipbox.dispatch631('mouseleave', {});
    assert631.equal(tip.style.display, 'none', 'mouseleave hides the tooltip');
    tipbox.dispatch631('click', { clientX: 50, clientY: 50 });
    assert631.equal(tip.style.display, 'block', 'tap shows the tooltip');
    tipbox.dispatch631('blur', {});
    tipbox.dispatch631('focus', {});
    assert631.equal(tip.style.display, 'block', 'keyboard focus shows the tooltip');
    assert631.equal(tip.style.top, '286px', 'focus anchors on the shape bbox');
    tipbox.dispatch631('blur', {});
    assert631.equal(tip.style.display, 'none', 'blur hides the tooltip');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: controls, keyboard, and filmstrip wiring', () => {
  var spec = chromeSpec631();
  assert631.deepEqual(validateSpec631(spec), [], 'fixture spec must validate clean');
  var shared = {};
  var created = [];
  var btnPlay = inertEl631(shared);
  var btnPrev = inertEl631(shared);
  var btnNext = inertEl631(shared);
  var btnRestart = inertEl631(shared);
  var scrub = inertEl631(shared);
  var tlabel = inertEl631(shared);
  var speedSel = inertEl631(shared);
  shared['[data-a="play"]'] = btnPlay;
  shared['[data-a="prev"]'] = btnPrev;
  shared['[data-a="next"]'] = btnNext;
  shared['[data-a="restart"]'] = btnRestart;
  shared['[data-a="scrub"]'] = scrub;
  shared['[data-a="tlabel"]'] = tlabel;
  shared['[data-a="speed"]'] = speedSel;
  var g = globals631(shared, created, { reducedMotion: true });
  try {
    var container = inertEl631(shared);
    var p = player631.mount(container, spec);
    var sceneEvents = [];
    p.on('scene', function (i) { sceneEvents.push(i); });
    function stripBtn(i) {
      return findByAttr631(created, 'data-scene', String(i))[0];
    }

    // Filmstrip starts with scene 0 marked current.
    assert631.equal(stripBtn(0).attrs['aria-current'], 'true', 'strip marks scene 0 current at mount');

    // Prev on scene 0 clamps (goScene(-1, 0) -> 0).
    btnPrev.dispatch631('click', {});
    assert631.deepEqual(sceneEvents, [0], 'prev on the first scene stays on scene 0');

    // Play/pause toggle.
    btnPlay.dispatch631('click', {});
    assert631.ok(btnPlay.innerHTML.indexOf('10074') !== -1, 'click plays: pause glyph');
    btnPlay.dispatch631('click', {});
    assert631.ok(btnPlay.innerHTML.indexOf('9654') !== -1, 'click pauses: play glyph');

    // Next/prev navigation.
    btnNext.dispatch631('click', {});
    assert631.deepEqual(sceneEvents, [0, 1], 'next jumps to scene 1');
    assert631.equal(stripBtn(1).attrs['aria-current'], 'true', 'strip follows to scene 1');
    assert631.equal(stripBtn(0).attrs['aria-current'], undefined, 'strip unmarks scene 0');
    btnPrev.dispatch631('click', {});
    assert631.deepEqual(sceneEvents, [0, 1, 0], 'prev jumps back to scene 0');

    // Restart: back to scene 0 and playing.
    btnRestart.dispatch631('click', {});
    assert631.deepEqual(sceneEvents, [0, 1, 0, 0], 'restart jumps to scene 0');
    assert631.ok(btnPlay.innerHTML.indexOf('10074') !== -1, 'restart resumes playback');

    // Speed change takes effect on the tick clock.
    speedSel.value = '1.5';
    speedSel.dispatch631('change', {});
    g.pump(2000);
    assert631.equal(tlabel.textContent, '0:03 / 0:04', '1.5x speed advances the clock');

    // Scrub input pauses and re-renders at the dragged position. The handler
    // captures scrub.value before pause() (pause()'s updateChrome() syncs
    // the slider back to the clock), so the re-render lands on the dragged
    // position per SPEC.md p85-86. Clock is at 0:03 of 0:04 here; the drag
    // to 500/1000 lands at 2s.
    scrub.value = '500';
    scrub.dispatch631('input', {});
    assert631.ok(btnPlay.innerHTML.indexOf('9654') !== -1, 'scrub leaves the player paused');
    assert631.equal(tlabel.textContent, '0:02 / 0:04', 'scrub re-renders at the dragged position');

    // Keyboard: space toggles, arrows move scenes, unmapped keys ignored,
    // and keys typed in an input are not shortcuts.
    var noop = function () {};
    container.dispatch631('keydown', { key: ' ', preventDefault: noop });
    assert631.ok(btnPlay.innerHTML.indexOf('10074') !== -1, 'space plays');
    container.dispatch631('keydown', { key: 'ArrowRight', preventDefault: noop });
    assert631.deepEqual(sceneEvents, [0, 1, 0, 0, 1], 'arrow-right jumps to scene 1');
    container.dispatch631('keydown', { key: 'ArrowLeft', preventDefault: noop });
    assert631.deepEqual(sceneEvents, [0, 1, 0, 0, 1, 0], 'arrow-left jumps to scene 0');
    container.dispatch631('keydown', { key: 'x', preventDefault: noop });
    assert631.deepEqual(sceneEvents, [0, 1, 0, 0, 1, 0], 'unmapped key is ignored');
    container.dispatch631('keydown', { key: ' ', target: { tagName: 'input' }, preventDefault: noop });
    assert631.ok(btnPlay.innerHTML.indexOf('9654') !== -1,
      'space typed in an input is not a shortcut');

    // Filmstrip buttons jump through the same goScene closure.
    stripBtn(1).dispatch631('click', {});
    assert631.deepEqual(sceneEvents, [0, 1, 0, 0, 1, 0, 1], 'strip button jumps to its scene');
    assert631.equal(stripBtn(1).attrs['aria-current'], 'true', 'strip marks scene 1 current');
    p.destroy();
  } finally {
    g.restore();
  }
});

test631('issue #631: fitLatex sizes to content and no-ops without a measurable div', () => {
  function latexNode631(w, h) {
    var div = inertEl631({});
    div.getBoundingClientRect = function () { return { width: w, height: h }; };
    var node = inertEl631({});
    node.appendChild(div);
    return { node: node, div: div };
  }
  var fit = latexNode631(400, 60);
  player631.internals.fitLatex(fit.node, 920);
  assert631.equal(fit.node.attrs.width, 400, 'box sized to content when it fits');
  assert631.equal(fit.node.attrs.height, 60, 'height sized to content when it fits');
  assert631.equal(fit.div.style.transform, undefined, 'no scale transform when it fits');
  var bare = inertEl631({});
  player631.internals.fitLatex(bare, 920);  // no firstChild: no-op, never throws
  assert631.deepEqual(bare.attrs, {}, 'no attributes written without a measurable div');
});
