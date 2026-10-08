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
  assert151.equal(typeof player151.shortcutHint, 'function', 'shortcutHint is exported');
  const hint = player151.shortcutHint();
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
  var d = player.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 90 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 0 1 100,150 Z');
});

test('sectorPath draws a half wedge with large-arc 0', () => {
  var d = player.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 180 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 0 1 50,100 Z');
});

test('sectorPath sets the large-arc flag for sweeps over 180 degrees', () => {
  var d = player.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 270 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 1 1 100,50 Z');
});

test('sectorPath normalizes wrap-around and reversed angles', () => {
  // 300 -> 60 is a 120-degree clockwise sweep crossing 0 degrees.
  var d = player.sectorPath({ cx: 0, cy: 0, r: 10, startAngle: 300, endAngle: 60 });
  assert.equal(d, 'M0,0 L5,-8.66 A10,10 0 0 1 5,8.66 Z');
  // 90 -> 0 is a 270-degree sweep (not a -90 backtrack).
  var d2 = player.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 90, endAngle: 0 });
  assert.equal(d2, 'M100,100 L100,150 A50,50 0 1 1 150,100 Z');
});

test('sectorPath emits two 180-degree arcs for a full circle', () => {
  var d = player.sectorPath({ cx: 100, cy: 100, r: 50, startAngle: 0, endAngle: 360 });
  assert.equal(d, 'M100,100 L150,100 A50,50 0 1 1 50,100 A50,50 0 1 1 150,100 Z');
});

test('sectorPath accepts negative angles and trims float noise', () => {
  var d = player.sectorPath({ cx: 200, cy: 200, r: 80, startAngle: -90, endAngle: 45 });
  assert.equal(d, 'M200,200 L200,120 A80,80 0 0 1 256.569,256.569 Z');
});

/* Dash style for line and arrow (issue #156): pure dashAttr helper.
 * Absent/null/empty = solid (undefined, so el() sets no stroke-dasharray
 * attribute and existing solid lines render byte-identical); otherwise the
 * pattern string passes through to stroke-dasharray verbatim.
 */
test('dashAttr returns undefined for absent, null, or empty dash', () => {
  assert.equal(typeof player.dashAttr, 'function', 'dashAttr must be exported on the player API');
  assert.equal(player.dashAttr({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }), undefined);
  assert.equal(player.dashAttr({ kind: 'arrow', x1: 0, y1: 0, x2: 10, y2: 0, dash: null }), undefined);
  assert.equal(player.dashAttr({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, dash: '' }), undefined);
});

test('dashAttr passes the dash pattern through verbatim', () => {
  assert.equal(player.dashAttr({ kind: 'line', dash: '6 4' }), '6 4');
  assert.equal(player.dashAttr({ kind: 'arrow', dash: '6.5 4 2 4' }), '6.5 4 2 4');
});

/* Tapered arrow shafts (issue #164): optional widths [tailWidth, headWidth]
 * on arrow — pure isWidths check, pure taperShaft geometry (tail->head-base
 * quadrilateral), and componentwise widths interpolation in interpFields.
 * Plain arrows keep the old stroke-line shaft path.
 */
test('isWidths accepts exactly two positive numbers', () => {
  assert.equal(typeof player.isWidths, 'function', 'isWidths must be exported on the player API');
  assert.equal(player.isWidths([24, 8]), true);
  assert.equal(player.isWidths([24]), false);
  assert.equal(player.isWidths([24, 8, 2]), false);
  assert.equal(player.isWidths([0, 8]), false);
  assert.equal(player.isWidths([24, -1]), false);
  assert.equal(player.isWidths('24,8'), false);
  assert.equal(player.isWidths([24, NaN]), false);
  assert.equal(player.isWidths(undefined), false);
});

test('taperShaft builds the tail->head-base quadrilateral', () => {
  assert.equal(typeof player.taperShaft, 'function', 'taperShaft must be exported on the player API');
  // horizontal arrow (0,0)->(100,0), wt=20, wh=6, headSize=22: shaft ends at x=78.
  assert.equal(player.taperShaft({ x1: 0, y1: 0, x2: 100, y2: 0 }, 20, 6, 22), '0,10 78,3 78,-3 0,-10');
});

test('taperShaft handles vertical shafts and equal widths', () => {
  // (50,10)->(50,110), wt=wh=8, headSize=26: shaft ends at y=84.
  assert.equal(player.taperShaft({ x1: 50, y1: 10, x2: 50, y2: 110 }, 8, 8, 26), '46,10 46,84 54,84 54,10');
});

test('taperShaft falls back to a square nub on zero-length shafts', () => {
  assert.equal(player.taperShaft({ x1: 5, y1: 5, x2: 5, y2: 5 }, 10, 10, 30), '5,10 5,10 5,0 5,0');
});

test('interpFields interpolates arrow widths componentwise (issue #164)', () => {
  var from = { x1: 0, y1: 0, x2: 100, y2: 0, widths: [4, 4] };
  assert.deepEqual(player.interpFields(from, { widths: [20, 6] }, 0.5).widths, [12, 5]);
  assert.deepEqual(player.interpFields(from, { widths: [20, 6] }, 1).widths, [20, 6]);
  assert.deepEqual(player.interpFields(from, { widths: [20, 6] }, 0).widths, [4, 4]);
});

test('interpFields skips malformed widths instead of throwing (issue #164)', () => {
  var from = { x1: 0, y1: 0, x2: 100, y2: 0, widths: [4, 4] };
  assert.ok(!('widths' in player.interpFields(from, { widths: 'wide' }, 0.5)), 'non-array skipped');
  assert.ok(!('widths' in player.interpFields(from, { widths: [4] }, 0.5)), 'wrong length skipped');
  assert.ok(!('widths' in player.interpFields(from, { widths: [4, -2] }, 0.5)), 'negative skipped');
  // no start value on the shown shape: the taper snaps in at move end,
  // so there is no interpolated mid-flight value.
  var noStart = player.interpFields({ x1: 0, y1: 0, x2: 100, y2: 0 }, { widths: [20, 6] }, 0.5);
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
  assert173.equal(typeof player173.explainText, 'function', 'explainText must be exported');
  assert173.equal(player173.explainText({ kind: 'circle', explain: 'A part, explained.' }), 'A part, explained.');
});

test173('explainText is blank for missing, empty, or non-string explain (issue #173)', () => {
  assert173.equal(player173.explainText({ kind: 'circle' }), '', 'missing field is inert');
  assert173.equal(player173.explainText({ kind: 'circle', explain: '' }), '', 'empty string is inert');
  assert173.equal(player173.explainText({ kind: 'circle', explain: '   ' }), '', 'whitespace-only is inert');
  assert173.equal(player173.explainText({ kind: 'circle', explain: 42 }), '', 'non-string is inert');
  assert173.equal(player173.explainText({ kind: 'circle', explain: null }), '', 'null is inert');
  assert173.equal(player173.explainText(null), '', 'null shape is inert');
});

test173('tipPoint offsets the tooltip from the pointer inside the stage (issue #173)', () => {
  assert173.equal(typeof player173.tipPoint, 'function', 'tipPoint must be exported');
  assert173.deepEqual(player173.tipPoint(480, 270, 960, 540), { x: 492, y: 286 },
    'centered pointer: tooltip lands dx=12, dy=16 away');
});

test173('tipPoint clamps the tooltip inside the stage edges (issue #173)', () => {
  assert173.deepEqual(player173.tipPoint(950, 270, 960, 540), { x: 712, y: 286 },
    'pointer near the right edge: tooltip stays left of the edge');
  assert173.deepEqual(player173.tipPoint(480, 530, 960, 540), { x: 492, y: 422 },
    'pointer near the bottom: tooltip stays above the edge');
  assert173.deepEqual(player173.tipPoint(950, 530, 960, 540), { x: 712, y: 422 },
    'bottom-right corner clamps both axes');
  assert173.deepEqual(player173.tipPoint(-50, -50, 960, 540), { x: 8, y: 8 },
    'pointer outside top-left clamps to the 8px margin');
});

test173('tipPoint degrades gracefully on a tiny stage (issue #173)', () => {
  assert173.deepEqual(player173.tipPoint(10, 10, 100, 80), { x: 8, y: 8 },
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
  assert463.equal(player463.latexFallbackText(tex), 'n = 12 g/12 g/mol = 1 mol');
});

test463('latexFallbackText handles nested braces in \\frac and \\sqrt (issue #463)', () => {
  assert463.equal(player463.latexFallbackText('\\frac{1}{2}'), '1/2');
  assert463.equal(player463.latexFallbackText('\\frac{\\text{a}}{\\text{b}}'), 'a/b');
  assert463.equal(player463.latexFallbackText('\\frac{\\frac{1}{2}}{3}'), '1/2/3');
  assert463.equal(player463.latexFallbackText('\\sqrt{x^2 + y^2}'), '\u221A(x\u00B2 + y\u00B2)');
  assert463.equal(player463.latexFallbackText('\\sqrt{\\frac{a}{b}}'), '\u221A(a/b)');
});

test463('latexFallbackText treats backslash-space as a space and keeps replacements (issue #463)', () => {
  assert463.equal(player463.latexFallbackText('a\\ b'), 'a b');
  assert463.equal(player463.latexFallbackText('a^2 + b^3'), 'a\u00B2 + b\u00B3');
  assert463.equal(player463.latexFallbackText('x^{2} + y^{3}'), 'x\u00B2 + y\u00B3');
  assert463.equal(player463.latexFallbackText('\\pi \\times \\theta \\approx 2'), '\u03C0 \u00D7 \u03B8 \u2248 2');
  assert463.equal(player463.latexFallbackText('10\\% off'), '10% off');
});

test463('latexFallbackText strips unknown commands without leaking names (issue #463)', () => {
  assert463.equal(player463.latexFallbackText('\\alpha + x'), ' + x');
  assert463.equal(player463.latexFallbackText('\\rightarrow'), '');
  assert463.equal(player463.latexFallbackText('\\text{plain}'), 'plain');
});

test463('latexFallbackText drops stray braces and survives unbalanced input (issue #463)', () => {
  assert463.equal(player463.latexFallbackText('{a} b }c{'), 'a b c');
  assert463.equal(player463.latexFallbackText('x^{n} + w^n'), 'x^n + w^n');
  assert463.equal(player463.latexFallbackText('\\frac{1'), '1');
  assert463.equal(player463.latexFallbackText('\\frac{1}'), '');
  assert463.equal(player463.latexFallbackText('\\frac12'), '12');
  assert463.equal(player463.latexFallbackText('\\frac{1}2'), '2');
  assert463.equal(player463.latexFallbackText('plain text'), 'plain text');
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
          const out = player463.latexFallbackText(o[k]);
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
