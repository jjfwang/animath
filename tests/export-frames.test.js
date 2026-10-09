/* Tests for player/export-frames.js — DOM-free deterministic per-frame SVG
 * contract (slice 1 of issue #506). Node-only, zero dependencies.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const xf = require('../player/export-frames.js');
const player = require('../player/player.js');

const CANVAS = { width: 960, height: 540 };

function specWith(scene) {
  return { title: 't', canvas: CANVAS, scenes: [scene] };
}

// --- shapeMarkup: exact markup mirrors drawShape's attribute decisions ---

test('rect markup mirrors drawShape defaults exactly', () => {
  assert.equal(
    xf.shapeMarkup({ id: 'r1', kind: 'rect', x: 10, y: 20, w: 100, h: 50 }),
    '<rect x="10" y="20" width="100" height="50" rx="0" fill="none" ' +
    'stroke="#1a1a1a" stroke-width="2" data-shape-id="r1"/>'
  );
});

test('rect markup honors rx/fill/stroke overrides', () => {
  assert.equal(
    xf.shapeMarkup({ id: 'r2', kind: 'rect', x: 0, y: 0, w: 10, h: 10,
      rx: 4, fill: '#eee', stroke: '#f00', strokeWidth: 5 }),
    '<rect x="0" y="0" width="10" height="10" rx="4" fill="#eee" ' +
    'stroke="#f00" stroke-width="5" data-shape-id="r2"/>'
  );
});

test('circle markup mirrors drawShape defaults exactly', () => {
  assert.equal(
    xf.shapeMarkup({ id: 'c1', kind: 'circle', cx: 5, cy: 6, r: 10 }),
    '<circle cx="5" cy="6" r="10" fill="none" stroke="#1a1a1a" ' +
    'stroke-width="2" data-shape-id="c1"/>'
  );
});

test('line markup carries dash through, omits it when absent', () => {
  assert.equal(
    xf.shapeMarkup({ id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 100, y2: 50,
      stroke: '#f00', width: 5, dash: '4 2' }),
    '<line x1="0" y1="0" x2="100" y2="50" stroke="#f00" stroke-width="5" ' +
    'stroke-linecap="round" stroke-dasharray="4 2" data-shape-id="l1"/>'
  );
  var solid = xf.shapeMarkup({ id: 'l2', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10 });
  assert.ok(!solid.includes('stroke-dasharray'), 'no dash attr when dash absent');
  assert.ok(solid.includes('stroke-width="3"'), 'default width 3 like drawShape');
});

test('text markup escapes XML and mirrors textNode defaults', () => {
  assert.equal(
    xf.shapeMarkup({ id: 't1', kind: 'text', x: 10, y: 20, text: 'a & b <c> "q"',
      size: 36, color: '#333' }),
    '<text x="10" y="20" font-size="36" fill="#333" text-anchor="start" ' +
    'font-family="system-ui, -apple-system, sans-serif" data-shape-id="t1">' +
    'a &amp; b &lt;c&gt; &quot;q&quot;</text>'
  );
});

test('latex markup uses the player fallback path (no KaTeX, no LaTeX output)', () => {
  var out = xf.shapeMarkup({ id: 'x1', kind: 'latex', x: 10, y: 20,
    tex: 'F = m\\frac{v^2}{r}', size: 28 });
  assert.ok(out.includes('>F = mv²/r</text>'), 'fallback text rendered, got: ' + out);
  assert.ok(!out.includes('frac'), 'no leaked command names');
});

test('sector markup uses the player sectorPath', () => {
  assert.equal(
    xf.shapeMarkup({ id: 's1', kind: 'sector', cx: 100, cy: 100, r: 50,
      startAngle: 0, endAngle: 90 }),
    '<path d="M100,100 L150,100 A50,50 0 0 1 100,150 Z" fill="none" ' +
    'stroke="#1a1a1a" stroke-width="2" data-shape-id="s1"/>'
  );
});

test('polygon markup joins points like drawShape', () => {
  assert.equal(
    xf.shapeMarkup({ id: 'p1', kind: 'polygon', points: [[0, 0], [10, 0], [10, 10]],
      fill: '#eee' }),
    '<polygon points="0,0 10,0 10,10" fill="#eee" stroke="#1a1a1a" ' +
    'stroke-width="2" stroke-linejoin="round" data-shape-id="p1"/>'
  );
});

test('arrow markup mirrors drawShape: line shaft + head polygon in a g', () => {
  var out = xf.shapeMarkup({ id: 'a1', kind: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0,
    stroke: '#00f', width: 4 });
  assert.ok(out.startsWith('<g data-shape-id="a1">'), 'g wrapper with data-shape-id');
  assert.ok(out.includes('<line x1="0" y1="0" x2="100" y2="0" stroke="#00f" ' +
    'stroke-width="4" stroke-linecap="round"/>'), 'line shaft, got: ' + out);
  assert.ok(out.includes('100,0 '), 'head polygon starts at the tip');
  assert.ok(out.endsWith('</g>'), 'g closed');
});

test('tapered arrow reuses the player taperShaft path', () => {
  var shape = { id: 'a2', kind: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0,
    stroke: '#00f', widths: [6, 2] };
  var out = xf.shapeMarkup(shape);
  var expected = player.taperShaft(shape, 6, 2, 14); // hs = 10 + 2*headWidth
  assert.ok(out.includes('<polygon points="' + expected + '" fill="#00f"/>'),
    'tapered shaft via taperShaft, got: ' + out);
  assert.ok(!out.includes('<line x1'), 'no line shaft on a tapered arrow');
});

test('unknown shape kind throws like drawShape', () => {
  assert.throws(() => xf.shapeMarkup({ id: 'z', kind: 'nope' }), /unknown shape kind/);
});

// --- sceneShapes: deterministic timeline replay ---

function timelineScene() {
  return {
    caption: 'timeline', duration_ms: 3000,
    steps: [
      { do: 'show', at_ms: 0, shape: { id: 'c1', kind: 'circle', cx: 10, cy: 10, r: 5 } },
      { do: 'move', at_ms: 1000, dur_ms: 800, target: 'c1', to: { cx: 50 } },
      { do: 'hide', at_ms: 2000, target: 'c1' },
      { do: 'caption', at_ms: 500, text: 'chrome only' },
      { do: 'emphasize', at_ms: 600, target: 'c1', dur_ms: 900 },
      { do: 'move', at_ms: 700, target: 'ghost', to: { cx: 1 } },
      { do: 'hide', at_ms: 800, target: 'ghost' },
      { do: 'show', at_ms: 5000, shape: { id: 'late', kind: 'circle', cx: 1, cy: 1, r: 1 } }
    ]
  };
}

test('show/move/hide replay: positions and visibility at sampled times', () => {
  var spec = specWith(timelineScene());
  var at500 = xf.sceneShapes(spec, 0, 500);
  assert.equal(at500.length, 1, 'one shape visible at 500ms');
  assert.equal(at500[0].cx, 10, 'unmoved at 500ms');
  var at1400 = xf.sceneShapes(spec, 0, 1400);
  assert.equal(at1400[0].cx, 30, 'move interpolated to midpoint at 1400ms');
  var at1800 = xf.sceneShapes(spec, 0, 1800);
  assert.equal(at1800[0].cx, 50, 'move completes at 1800ms');
  assert.equal(xf.sceneShapes(spec, 0, 2500).length, 0, 'hidden at 2500ms');
  assert.equal(xf.sceneShapes(spec, 0, 500).filter(function (s) { return s.id === 'late'; }).length,
    0, 'future steps not applied');
});

test('caption/emphasize ignored geometrically; ghost targets are no-ops', () => {
  var spec = specWith(timelineScene());
  var at1400 = xf.sceneShapes(spec, 0, 1400);
  assert.equal(at1400.length, 1, 'emphasize adds no shape');
  assert.equal(at1400[0].cx, 30, 'emphasize does not perturb interpolation');
  // Ghost move/hide steps above did not throw; scene still consistent.
  assert.equal(xf.sceneShapes(spec, 0, 900).length, 1);
});

test('move without dur_ms uses the player tween default of 800ms', () => {
  var spec = specWith({
    duration_ms: 2000,
    steps: [
      { do: 'show', at_ms: 0, shape: { id: 'c1', kind: 'circle', cx: 0, cy: 0, r: 5 } },
      { do: 'move', at_ms: 1000, target: 'c1', to: { cx: 80 } }
    ]
  });
  assert.equal(xf.sceneShapes(spec, 0, 1400)[0].cx, 40, 'p=0.5 at 400ms into an 800ms default tween');
});

test('polygon and tapered-arrow moves interpolate without mutating the spec', () => {
  var spec = specWith({
    duration_ms: 2000,
    steps: [
      { do: 'show', at_ms: 0, shape: { id: 'pg', kind: 'polygon', points: [[0, 0], [10, 0]] } },
      { do: 'move', at_ms: 1000, dur_ms: 1000, target: 'pg', to: { points: [[0, 10], [10, 10]] } },
      { do: 'show', at_ms: 0, shape: { id: 'ta', kind: 'arrow', x1: 0, y1: 0, x2: 50, y2: 0, widths: [6, 2] } },
      { do: 'move', at_ms: 1000, dur_ms: 1000, target: 'ta', to: { widths: [10, 6] } }
    ]
  });
  var shapes = xf.sceneShapes(spec, 0, 1500);
  var pg = shapes.filter(function (s) { return s.id === 'pg'; })[0];
  var ta = shapes.filter(function (s) { return s.id === 'ta'; })[0];
  assert.deepEqual(pg.points, [[0, 5], [10, 5]], 'points interpolated pointwise at p=0.5');
  assert.deepEqual(ta.widths, [8, 4], 'widths interpolated componentwise at p=0.5');
  assert.deepEqual(spec.scenes[0].steps[0].shape.points, [[0, 0], [10, 0]],
    'spec points untouched');
  assert.deepEqual(spec.scenes[0].steps[2].shape.widths, [6, 2], 'spec widths untouched');
});

test('sceneShapes returns [] for an unknown scene index; steps may be absent', () => {
  var spec = specWith(timelineScene());
  assert.deepEqual(xf.sceneShapes(spec, 99, 0), []);
  assert.deepEqual(xf.sceneShapes(specWith({ duration_ms: 1000 }), 0, 500), []);
});

// --- renderFrame / frame timing ---

test('renderFrame is a standalone deterministic SVG string', () => {
  var spec = specWith(timelineScene());
  var a = xf.renderFrame(spec, 0, 1400);
  var b = xf.renderFrame(spec, 0, 1400);
  assert.equal(a, b, 'byte-identical across calls');
  assert.ok(a.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">'),
    'standalone svg with xmlns and canvas viewBox');
  assert.ok(a.endsWith('</svg>'), 'closed');
  assert.ok(a.includes('<circle cx="30" cy="10" r="5"'), 'interpolated circle in the frame');
  assert.equal(xf.renderFrame(spec, 0, 2500),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"></svg>',
    'empty scene renders an empty svg');
});

test('renderFrame is byte-identical across separate node processes', () => {
  var modPath = path.join(__dirname, '..', 'player', 'export-frames.js');
  var expr = 'const xf=require(' + JSON.stringify(modPath) + ');' +
    'const spec={title:"t",canvas:{width:960,height:540},scenes:[' +
    '{duration_ms:2000,steps:[' +
    '{do:"show",at_ms:0,shape:{id:"c1",kind:"circle",cx:10,cy:10,r:5}},' +
    '{do:"move",at_ms:500,dur_ms:1000,target:"c1",to:{cx:60}}]}]};' +
    'process.stdout.write(xf.renderFrame(spec,0,1000));';
  var a = spawnSync(process.execPath, ['-e', expr], { encoding: 'utf8' });
  var b = spawnSync(process.execPath, ['-e', expr], { encoding: 'utf8' });
  assert.equal(a.status, 0, 'first process ok: ' + a.stderr);
  assert.equal(b.status, 0, 'second process ok: ' + b.stderr);
  assert.equal(a.stdout, b.stdout, 'byte-identical across processes');
});

test('frameMs and sceneFrameCount define the frame-index contract', () => {
  assert.equal(xf.frameMs(5, 10), 500, 'frame 5 at 10fps is 500ms');
  assert.equal(xf.frameMs(0, 30), 0, 'frame 0 is 0ms');
  var spec = specWith({ duration_ms: 3000, steps: [] });
  assert.equal(xf.sceneFrameCount(spec, 0, 10), 30, '3000ms at 10fps is 30 frames');
  assert.equal(xf.sceneFrameCount(spec, 0, 3), 9, 'ceil keeps the trailing partial frame');
  assert.equal(xf.sceneFrameCount(spec, 99, 10), 0, 'unknown scene has no frames');
});
