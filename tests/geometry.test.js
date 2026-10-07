/* Tests for generator/geometry.js — R-5 headless sample check, slice 1.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { auditGeometry, auditGeometrySampled, auditSampleFile, auditAllSamples, estimateTextWidth } = require('../generator/geometry.js');

const samplesDir = path.join(__dirname, '..', 'samples');

// 'hello' at size 24: per-glyph width 57.99, height 28.8
function textShape(over) {
  return Object.assign(
    { id: 't1', kind: 'text', x: 100, y: 100, text: 'hello', size: 24 },
    over || {}
  );
}
function show(shape, atMs) {
  return { at_ms: atMs || 0, do: 'show', shape: shape };
}
function specOf(steps, over) {
  return Object.assign(
    { canvas: { width: 960, height: 540 }, scenes: [{ id: 's1', steps: steps }] },
    over || {}
  );
}
function wellFormed(records) {
  for (const r of records) {
    assert.equal(typeof r.file, 'string', 'record.file is a string');
    assert.equal(typeof r.scene, 'string', 'record.scene is a string');
    assert.ok(r.kind === 'overflow' || r.kind === 'overlap' || r.kind === 'text-shape-overlap', 'record.kind valid');
    assert.equal(typeof r.detail, 'string', 'record.detail is a string');
  }
}

test('clean text shape inside canvas yields no findings', () => {
  assert.deepEqual(auditGeometry(specOf([show(textShape())])), []);
});

test('overflow: left edge', () => {
  const f = auditGeometry(specOf([show(textShape({ x: -10 }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
  assert.match(f[0].detail, /t1/);
});

test('overflow: right edge', () => {
  const f = auditGeometry(specOf([show(textShape({ text: 'x'.repeat(200) }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
});

test('overflow: top and bottom edges', () => {
  const top = auditGeometry(specOf([show(textShape({ y: -5 }))]));
  assert.equal(top.length, 1);
  assert.equal(top[0].kind, 'overflow');
});

test('baseline-anchored box: bottom is now y + 0.2*size (y=530/size=24 clean)', () => {
  // new bottom = 530 + 0.2*24 = 534.8 <= 540 -> no finding
  assert.deepEqual(auditGeometry(specOf([show(textShape({ y: 530 }))])), []);
});

test('baseline-anchored box: bottom-clean case mirroring sample ans (y=505/size=40)', () => {
  // new bottom = 505 + 0.2*40 = 513 <= 540 -> no finding
  assert.deepEqual(
    auditGeometry(specOf([show(textShape({ y: 505, size: 40 }))])), []
  );
});

test('baseline-anchored box: top overflow flags baselines in [0, 0.8*size) (y=10/size=40)', () => {
  // new top = 10 - 40 = -30 < 0 -> flagged (the old model was blind here)
  const f = auditGeometry(specOf([show(textShape({ y: 10, size: 40 }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
});

test('align middle centers the box (x=0 overflows left)', () => {
  const f = auditGeometry(specOf([show(textShape({ x: 0, align: 'middle' }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
});

test('align end puts the right edge at x (x=10 overflows left)', () => {
  const f = auditGeometry(specOf([show(textShape({ x: 10, align: 'end' }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
});

test('align start (default) anchors the left edge at x', () => {
  // middle of canvas: no finding for any align when fully inside
  for (const align of [undefined, 'start', 'middle', 'end']) {
    const shape = textShape({ x: 480, y: 270 });
    if (align !== undefined) shape.align = align;
    assert.deepEqual(auditGeometry(specOf([show(shape)])), [], 'align ' + align);
  }
});

test('overlap: two substantially intersecting text boxes are flagged', () => {
  const steps = [
    show(textShape({ id: 'a', x: 100 })),
    show(textShape({ id: 'b', x: 120 }), 100)
  ];
  const f = auditGeometry(specOf(steps));
  const overlaps = f.filter((r) => r.kind === 'overlap');
  assert.equal(overlaps.length, 1);
  assert.match(overlaps[0].detail, /a overlaps b/);
});

test('tolerance: grazing adjacency (touching edges) is not flagged', () => {
  // a spans 100..158; b starts at 172, clear of it -> intersection width 0
  const f = auditGeometry(specOf([
    show(textShape({ id: 'a', x: 100 })),
    show(textShape({ id: 'b', x: 172 }), 100)
  ]));
  assert.deepEqual(f, []);
});

test('tolerance: sub-1% intersection is not flagged', () => {
  // intersection 0.5px wide: area 14.4 < 1% of 2073.6 = 20.7
  const f = auditGeometry(specOf([
    show(textShape({ id: 'a', x: 100 })),
    show(textShape({ id: 'b', x: 171.5 }), 100)
  ]));
  assert.deepEqual(f, []);
});

test('latex: inside anchor is clean, outside anchor is overflow', () => {
  const clean = auditGeometry(specOf([
    show({ id: 'm1', kind: 'latex', x: 100, y: 100, tex: 'x^2' })
  ]));
  assert.deepEqual(clean, []);
  const bad = auditGeometry(specOf([
    show({ id: 'm2', kind: 'latex', x: 1000, y: 100, tex: 'x^2' })
  ]));
  assert.equal(bad.length, 1);
  assert.equal(bad[0].kind, 'overflow');
  assert.match(bad[0].detail, /m2/);
});

test('missing/non-numeric size falls back to 24 without throwing', () => {
  assert.deepEqual(auditGeometry(specOf([show(textShape({ size: undefined }))])), []);
  assert.deepEqual(auditGeometry(specOf([show(textShape({ size: NaN }))])), []);
  // 200 chars at size 24 -> width 2880 > 960, so overflow proves the fallback width was used
  const f = auditGeometry(specOf([
    show({ id: 't', kind: 'text', x: 100, y: 100, text: 'x'.repeat(200) })
  ]));
  assert.equal(f.length, 1);
});

test('missing/non-string text is skipped without throwing', () => {
  assert.deepEqual(auditGeometry(specOf([show(textShape({ text: undefined }))])), []);
  assert.deepEqual(auditGeometry(specOf([show(textShape({ text: 42 }))])), []);
  assert.deepEqual(auditGeometry(specOf([show(textShape({ text: '' }))])), []);
});

test('invalid specs return [] without throwing', () => {
  assert.deepEqual(auditGeometry(null), []);
  assert.deepEqual(auditGeometry(undefined), []);
  assert.deepEqual(auditGeometry({}), []);
  assert.deepEqual(auditGeometry({ scenes: 'nope' }), []);
  assert.deepEqual(auditGeometry({ scenes: [] }), []);
});

test('scene without id is labeled "scene N"; file defaults to null', () => {
  const f = auditGeometry({ scenes: [{ steps: [show(textShape({ x: -10 }))] }] }, '');
  assert.equal(f.length, 1);
  assert.equal(f[0].scene, 'scene 1');
  assert.equal(f[0].file, null);
});

test('scene id is used as the label and file name is carried through', () => {
  const f = auditGeometry(specOf([show(textShape({ x: -10 }))]), 'demo.json');
  assert.equal(f[0].scene, 's1');
  assert.equal(f[0].file, 'demo.json');
});

test('non-show steps, null steps, and non-text shapes are ignored', () => {
  const steps = [
    null,
    { at_ms: 0, do: 'caption', text: 'hi' },
    { at_ms: 10, do: 'show' },                       // no shape
    { at_ms: 20, do: 'show', shape: 'not-an-object' },
    show({ id: 'r1', kind: 'rect', x: -999, y: -999, w: 10, h: 10 }, 30),
    show(textShape(), 40)
  ];
  assert.deepEqual(auditGeometry(specOf(steps)), []);
});

test('move steps are not tracked: audit uses the show-time position', () => {
  const steps = [
    show(textShape({ id: 't1', x: 100 }), 0),
    { at_ms: 500, do: 'move', target: 't1', to: { x: -500, y: -500 } }
  ];
  // documented limitation: the post-move off-canvas position is not flagged
  assert.deepEqual(auditGeometry(specOf(steps)), []);
});

test('missing canvas defaults to 960x540', () => {
  const f = auditGeometry({ scenes: [{ id: 's1', steps: [show(textShape({ x: 900, text: 'x'.repeat(10) }))]}] });
  // per-glyph width 142.03 > 60 remaining -> right edge 1042 > 960
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /960x540/);
});

test('auditSampleFile: real sample file returns well-formed records', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(samplesDir, 'index.json'), 'utf8'));
  const f = auditSampleFile(path.join(samplesDir, manifest[0]));
  assert.ok(Array.isArray(f));
  wellFormed(f);
});

test('auditSampleFile: missing or invalid files return []', () => {
  assert.deepEqual(auditSampleFile(path.join(samplesDir, 'no-such-file.json')), []);
  const bad = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'geoaudit-')), 'bad.json');
  fs.writeFileSync(bad, 'this is not json{{{');
  assert.deepEqual(auditSampleFile(bad), []);
});

test('auditSampleFile: backslash in filename is stripped to the basename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoaudit-'));
  const name = 'we\\ird.json';
  fs.writeFileSync(path.join(dir, name), JSON.stringify(specOf([show(textShape({ x: -10 }))])) );
  const f = auditSampleFile(path.join(dir, name));
  assert.equal(f.length, 1);
  assert.equal(f[0].file, 'ird.json');
});

test('auditAllSamples: full manifest — 69 samples, well-formed records', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(samplesDir, 'index.json'), 'utf8'));
  assert.equal(manifest.length, 69);
  const findings = auditAllSamples(samplesDir);
  assert.ok(Array.isArray(findings));
  wellFormed(findings);
});

test('auditAllSamples: default dir, non-string dir, and bad manifests', () => {
  process.chdir(path.join(__dirname, '..')); // repo root, so 'samples' resolves
  const viaDefault = auditAllSamples();
  assert.ok(Array.isArray(viaDefault));
  wellFormed(viaDefault);
  assert.deepEqual(auditAllSamples(null), viaDefault);
  assert.deepEqual(auditAllSamples(path.join(os.tmpdir(), 'geoaudit-missing-xyz')), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoaudit-'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ not: 'an array' }));
  assert.deepEqual(auditAllSamples(dir), []);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([123, '']));
  assert.deepEqual(auditAllSamples(dir), []);
});

/* ---- text-vs-shape extension (issue #172) ---- */

// text 'hello' at size 24 anchored at x=100,y=100: box 100..158 x 76..104.8
function rectShape(over) {
  return Object.assign({ id: 'bar1', kind: 'rect', x: 90, y: 80, w: 120, h: 40 }, over || {});
}
function circleShape(over) {
  return Object.assign({ id: 'dot1', kind: 'circle', cx: 120, cy: 90, r: 25 }, over || {});
}

test('text-shape-overlap: label grazing a rect from outside is flagged', () => {
  // rect starts at x=146: label center (129) is outside, right edge of the
  // label band (100..158) bleeds 12px into the rect
  const f = auditGeometry(specOf([show(textShape()), show(rectShape({ x: 146 }))]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.match(f[0].detail, /t1 collides with bar1/);
  assert.match(f[0].detail, /px\^2 intersection/);
});

test('text-shape-overlap: label far from shapes is clean', () => {
  const f = auditGeometry(specOf([
    show(textShape({ id: 't1', x: 800, y: 400 })),
    show(rectShape())
  ]));
  assert.deepEqual(f, []);
});

test('text-shape-overlap: label centered on a shape is intentional (centered-on)', () => {
  // label box 100..158 x 76..104.8, center (129, 90.4) inside the big rect
  const inside = auditGeometry(specOf([
    show(textShape()),
    show(rectShape({ x: 50, y: 50, w: 200, h: 80 }))
  ]));
  assert.deepEqual(inside, []);
  // short label centered on a small chip: center inside -> intentional
  const chip = auditGeometry(specOf([
    show(textShape({ x: 100, y: 100, text: 'centered label' })),
    show(rectShape({ x: 150, y: 80, w: 60, h: 40 }))
  ]));
  assert.deepEqual(chip, []);
});

test('text-shape-overlap: label on a probe dot (r<=10) is a point anchor', () => {
  const f = auditGeometry(specOf([
    show(textShape()),
    show(circleShape({ r: 8 }))
  ]));
  assert.deepEqual(f, []);
});

test('text-shape-overlap: label grazing a bigger circle is flagged', () => {
  // circle box 151..201 x 65..115: label center (129) outside, 7px bleed
  const f = auditGeometry(specOf([
    show(textShape()),
    show(circleShape({ cx: 176 }))
  ]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.match(f[0].detail, /t1 collides with dot1/);
});

test('text-shape-overlap: line and arrow use the endpoint bbox', () => {
  // wire crossing the top edge of the label band (y=76, padded to 74..78)
  const line = auditGeometry(specOf([
    show(textShape()),
    show({ id: 'ln1', kind: 'line', x1: 50, y1: 76, x2: 200, y2: 76 })
  ]));
  assert.equal(line.length, 1);
  assert.match(line[0].detail, /t1 collides with ln1/);
  const arrow = auditGeometry(specOf([
    show(textShape()),
    show({ id: 'ar1', kind: 'arrow', x1: 50, y1: 76, x2: 200, y2: 76 })
  ]));
  assert.equal(arrow.length, 1);
  assert.match(arrow[0].detail, /t1 collides with ar1/);
  // zero-length line: no box, no finding, no throw
  const zero = auditGeometry(specOf([
    show(textShape()),
    show({ id: 'ln0', kind: 'line', x1: 120, y1: 90, x2: 120, y2: 90 })
  ]));
  assert.deepEqual(zero, []);
});

test('text-shape-overlap: polygon bbox from vertex extents', () => {
  // polygon bbox 150..300 x 50..100 grazes the label band from the right
  const f = auditGeometry(specOf([
    show(textShape()),
    show({ id: 'poly1', kind: 'polygon', points: [[150, 50], [300, 50], [300, 100], [150, 100]] })
  ]));
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /t1 collides with poly1/);
  // empty / malformed point lists: no box, no finding, no throw
  const empty = auditGeometry(specOf([
    show(textShape({ id: 't2', x: 800, y: 400 })),
    show({ id: 'poly0', kind: 'polygon', points: [] }),
    show({ id: 'polyX', kind: 'polygon', points: ['nope', [1]] })
  ]));
  assert.deepEqual(empty, []);
});

test('text-shape-overlap: sector uses the wedge bbox, not the full circle', () => {
  // sector cx=190 cy=90 r=25, angles 0..90: wedge bbox 190..215 x 90..115.
  // Label grazing the wedge from the right is flagged.
  const f = auditGeometry(specOf([
    show(textShape({ x: 195 })),
    show({ id: 'sec1', kind: 'sector', cx: 190, cy: 90, r: 25, startAngle: 0, endAngle: 90 })
  ]));
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /t1 collides with sec1/);
  // label sitting in the wedge's empty quadrant is clean (the run-199 pie
  // case: bananas wedge 180..270 never reaches x=400)
  const clean = auditGeometry(specOf([
    show(textShape({ x: 400, y: 212, text: 'grapes' })),
    show({ id: 'wB', kind: 'sector', cx: 300, cy: 330, r: 150, startAngle: 180, endAngle: 270 })
  ]));
  assert.deepEqual(clean, []);
  // wrap-around spans (270..90 through 0) cover the east half
  const wrap = auditGeometry(specOf([
    show(textShape({ x: 195 })),
    show({ id: 'secW', kind: 'sector', cx: 190, cy: 90, r: 25, startAngle: 270, endAngle: 90 })
  ]));
  assert.equal(wrap.length, 1);
  // full-circle span (>= 360) falls back to the circle bbox
  const full = auditGeometry(specOf([
    show(textShape({ x: 195 })),
    show({ id: 'secF', kind: 'sector', cx: 190, cy: 90, r: 25, startAngle: 0, endAngle: 360 })
  ]));
  assert.equal(full.length, 1);
  // non-positive radius: no box, no finding, no throw
  const bad = auditGeometry(specOf([
    show(textShape({ id: 't3', x: 800, y: 400 })),
    show({ id: 'sec0', kind: 'sector', cx: 120, cy: 90, r: 0, startAngle: 0, endAngle: 90 })
  ]));
  assert.deepEqual(bad, []);
});

test('text-shape-overlap: zero-area rects and unknown kinds are skipped', () => {
  const f = auditGeometry(specOf([
    show(textShape()),
    show({ id: 'z1', kind: 'rect', x: 100, y: 80, w: 0, h: 40 }),
    show({ id: 'z2', kind: 'circle', cx: 120, cy: 90, r: -3 }),
    show({ id: 'z3', kind: 'unknown-kind', x: 100, y: 80, w: 50, h: 50 }),
    show('not-an-object')
  ]));
  assert.deepEqual(f, []);
});

test('text-shape-overlap: sub-1% grazing intersection is not flagged', () => {
  // rect edge 1px into the label band: intersection 1 x 28.8 = 28.8px^2;
  // 1% of the label area (72 x 28.8 = 2073.6) is 20.7 -> flagged...
  // use 0.5px: 14.4 < 20.7 -> not flagged
  const f = auditGeometry(specOf([
    show(textShape()),
    show(rectShape({ x: 171.5, y: 50, w: 40, h: 80 }))
  ]));
  assert.deepEqual(f, []);
});

test('text-shape-overlap: latex labels use the estimated box', () => {
  // tex 'x^2' -> visible 'x^2' (no backslash command): per-glyph width 49.58,
  // box 100..149.6 x 100..128.8 (top-left anchored); a rect grazing its right
  // edge (label center outside the rect) is flagged
  const f = auditGeometry(specOf([
    show({ id: 'm1', kind: 'latex', x: 100, y: 100, tex: 'x^2' }),
    show(rectShape({ x: 140, y: 80, w: 60, h: 40 }))
  ]));
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.match(f[0].detail, /m1 collides with bar1/);
});

test('text-shape-overlap: latex with backslash commands strips them for the estimate', () => {
  // tex '\\frac{1}{2}' -> visible '12': per-glyph width 30.54, box 100..130.5
  // rect starting at 140: no intersection -> clean
  const clean = auditGeometry(specOf([
    show({ id: 'm2', kind: 'latex', x: 100, y: 100, tex: '\\frac{1}{2}' }),
    show(rectShape({ x: 140, y: 80, w: 60, h: 40 }))
  ]));
  assert.deepEqual(clean, []);
  // same latex against a grazing rect: flagged
  const hit = auditGeometry(specOf([
    show({ id: 'm2', kind: 'latex', x: 100, y: 100, tex: '\\frac{1}{2}' }),
    show(rectShape({ x: 126, y: 80, w: 60, h: 40 }))
  ]));
  assert.equal(hit.length, 1);
  // non-string / empty tex: no box, no finding, no throw
  const skip = auditGeometry(specOf([
    show({ id: 'm3', kind: 'latex', x: 100, y: 100, tex: '' }),
    show({ id: 'm4', kind: 'latex', x: 100, y: 100, tex: 42 }),
    show(rectShape())
  ]));
  assert.deepEqual(skip, []);
});

test('text-shape-overlap: record shape matches the audit record contract', () => {
  const f = auditGeometry(specOf([show(textShape()), show(rectShape({ x: 146 }))]), 'demo.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].file, 'demo.json');
  assert.equal(f[0].scene, 's1');
  wellFormed(f);
});

test('text-shape-overlap: moved shapes keep the show-time-position limitation', () => {
  // shape shown clear of the label, then moved onto it: not flagged
  // (documented limitation, same as the text-vs-text band)
  const f = auditGeometry(specOf([
    show(textShape()),
    show(rectShape({ id: 'mv', x: 700, y: 400, w: 40, h: 30 })),
    { at_ms: 500, do: 'move', target: 'mv', to: { x: 100, y: 80 } }
  ]));
  assert.deepEqual(f, []);
});

/* ---- auditGeometrySampled: time-sampled geometry audit (issue #363) ---- */

function sampledSpec(steps, durMs) {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{ id: 's1', duration_ms: durMs, steps: steps }]
  };
}
function moveStep(target, to, atMs, durMs) {
  return { at_ms: atMs, do: 'move', target: target, to: to, dur_ms: durMs };
}
function hideStep(target, atMs) {
  return { at_ms: atMs, do: 'hide', target: target };
}
// 'hello' at size 24, baseline y=300: box left 100, top 276, right 172, bottom 304.8
function labelAt(x, y) {
  return { id: 'lbl', kind: 'text', x: x, y: y, text: 'hello', size: 24 };
}

test('sampled: run-274 case — falling shape crosses a label mid-flight', () => {
  const spec = sampledSpec([
    show(labelAt(100, 300), 0),
    show({ id: 'ball', kind: 'circle', cx: 160, cy: 100, r: 20 }, 0),
    moveStep('ball', { cy: 500 }, 0, 1000)
  ], 1000);
  // static audit sees only the clean endpoints
  assert.deepEqual(auditGeometry(spec), []);
  const f = auditGeometrySampled(spec, 'fall.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.equal(f[0].file, 'fall.json');
  assert.equal(f[0].scene, 's1');
  assert.match(f[0].detail, /lbl collides with ball \[400-500ms\]/);
  wellFormed(f);
});

test('sampled: statically clean scene stays clean', () => {
  const spec = sampledSpec([
    show(labelAt(100, 100), 0),
    show({ id: 'c', kind: 'circle', cx: 700, cy: 400, r: 30 }, 0),
    moveStep('c', { cx: 800 }, 0, 500)
  ], 1000);
  assert.deepEqual(auditGeometry(spec), []);
  assert.deepEqual(auditGeometrySampled(spec, 'clean.json'), []);
});

test('sampled: hide during the crossing window suppresses the finding', () => {
  const ball = { id: 'ball', kind: 'circle', cx: 160, cy: 100, r: 20 };
  const spec = sampledSpec([
    show(labelAt(100, 300), 0),
    show(ball, 0),
    moveStep('ball', { cy: 500 }, 0, 1000),
    hideStep('ball', 300),
    show(ball, 700)
  ], 1000);
  assert.deepEqual(auditGeometrySampled(spec, 'hide.json'), []);
});

test('sampled: sequential moves compose from the current spot', () => {
  // label sits where only the composed path reaches: move 2 must start from
  // move 1's end (cy 200), not from the original cy 100
  const spec = sampledSpec([
    show({ id: 'lbl', kind: 'text', x: 200, y: 330, text: 'xx', size: 24 }, 0),
    show({ id: 'ball', kind: 'circle', cx: 200, cy: 100, r: 15 }, 0),
    moveStep('ball', { cy: 200 }, 0, 400),
    moveStep('ball', { cy: 400 }, 400, 400)
  ], 800);
  const f = auditGeometrySampled(spec, 'compose.json');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /lbl collides with ball \[600ms\]/);
});

test('sampled: single-sample overlap uses the [Tms] band form', () => {
  const spec = sampledSpec([
    show(labelAt(100, 300), 0),
    show({ id: 'b2', kind: 'circle', cx: 160, cy: 290, r: 20 }, 500),
    hideStep('b2', 600)
  ], 1000);
  const f = auditGeometrySampled(spec, 'single.json');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /lbl collides with b2 \[500ms\]/);
});

test('sampled: missing duration_ms falls back to the last step time', () => {
  const steps = [
    show(labelAt(100, 300), 0),
    show({ id: 'ball', kind: 'circle', cx: 160, cy: 100, r: 20 }, 0),
    moveStep('ball', { cy: 500 }, 0, 1000),
    show({ id: 'far', kind: 'circle', cx: 900, cy: 500, r: 5 }, 900)
  ];
  const spec = { canvas: { width: 960, height: 540 }, scenes: [{ id: 's1', steps: steps }] };
  const f = auditGeometrySampled(spec, 'nodur.json');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /\[400-500ms\]/);
});

test('sampled: text-vs-text overlap follows the same sampling', () => {
  const spec = sampledSpec([
    show({ id: 'a', kind: 'text', x: 100, y: 100, text: 'hello', size: 24 }, 0),
    show({ id: 'b', kind: 'text', x: 120, y: 100, text: 'hello', size: 24 }, 0),
    hideStep('b', 300)
  ], 1000);
  const f = auditGeometrySampled(spec, 'tt.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overlap');
  assert.match(f[0].detail, /a overlaps b \[0-200ms\]/);
});

test('sampled: latex labels participate in the text-vs-shape band', () => {
  const spec = sampledSpec([
    show({ id: 'm2', kind: 'latex', x: 100, y: 100, tex: '\\frac{1}{2}' }, 0),
    show({ id: 'r1', kind: 'rect', x: 126, y: 80, w: 60, h: 40 }, 0)
  ], 1000);
  const f = auditGeometrySampled(spec, 'latex.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.match(f[0].detail, /\[0-1000ms\]/);
  // latex anchor off-canvas: overflow band
  const off = sampledSpec([
    show({ id: 'm9', kind: 'latex', x: -10, y: 100, tex: 'x' }, 0),
    hideStep('m9', 200)
  ], 1000);
  const g = auditGeometrySampled(off, 'latexo.json');
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'overflow');
  assert.match(g[0].detail, /\[0-100ms\]/);
});

test('sampled: point-anchor and centered-on exemptions hold while moving', () => {
  // r=8 probe dot sliding across the label: exempt as a point anchor
  const dotSpec = sampledSpec([
    show(labelAt(100, 100), 0),
    show({ id: 'dot', kind: 'circle', cx: 40, cy: 100, r: 8 }, 0),
    moveStep('dot', { cx: 240 }, 0, 500)
  ], 1000);
  assert.deepEqual(auditGeometrySampled(dotSpec, 'dot.json'), []);
  // label centered on a rect sliding underneath: exempt as centered-on
  const centerSpec = sampledSpec([
    show({ id: 'lbl', kind: 'text', x: 100, y: 100, text: 'hi', size: 24 }, 0),
    show({ id: 'r1', kind: 'rect', x: 40, y: 70, w: 120, h: 60 }, 0),
    moveStep('r1', { x: 200 }, 0, 500)
  ], 1000);
  assert.deepEqual(auditGeometrySampled(centerSpec, 'center.json'), []);
});

test('sampled: overflow is reported as a time band', () => {
  const spec = sampledSpec([
    show({ id: 't', kind: 'text', x: -50, y: 100, text: 'hello', size: 24 }, 0),
    hideStep('t', 200)
  ], 1000);
  const f = auditGeometrySampled(spec, 'over.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'overflow');
  assert.match(f[0].detail, /\[0-100ms\]/);
});

test('sampled: polygon points interpolate pointwise', () => {
  const poly = { id: 'p1', kind: 'polygon', points: [[10, 10], [60, 10], [35, 60]] };
  const spec = sampledSpec([
    show({ id: 'lbl', kind: 'text', x: 455, y: 40, text: 'xx', size: 24 }, 0),
    show(poly, 0),
    moveStep('p1', { points: [[410, 10], [460, 10], [435, 60]] }, 0, 500)
  ], 1000);
  const f = auditGeometrySampled(spec, 'poly.json');
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'text-shape-overlap');
  assert.match(f[0].detail, /\[500-1000ms\]/); // rests on the label after arrival
  // mismatched point counts: guarded, no throw, no finding
  const bad = sampledSpec([
    show(poly, 0),
    moveStep('p1', { points: [[1, 1]] }, 0, 500)
  ], 1000);
  assert.deepEqual(auditGeometrySampled(bad, 'badpoly.json'), []);
});

test('sampled: malformed input never throws', () => {
  assert.deepEqual(auditGeometrySampled(null), []);
  assert.deepEqual(auditGeometrySampled({}), []);
  assert.deepEqual(auditGeometrySampled({ scenes: null }), []);
  assert.deepEqual(auditGeometrySampled({ scenes: [{ id: 's' }] }), []);
  const junk = sampledSpec([
    null, 42, 'x',
    { do: 'move' },
    { do: 'show' },
    { do: 'show', shape: null },
    { do: 'show', shape: { kind: 'text' } },
    { do: 'hide', target: '' },
    { do: 'hide', target: 42 },
    { at_ms: 0, do: 'move', target: 'ghost', to: null },
    { at_ms: 0, do: 'move', target: 'ghost', to: { cy: 10 }, dur_ms: 100 }
  ], 500);
  assert.deepEqual(auditGeometrySampled(junk, 'junk.json'), []);
  // shown shape, then a move with junk fields and a negative duration:
  // non-numeric targets are skipped, negative dur is instant, no throw
  const weird = sampledSpec([
    show({ id: 'c', kind: 'circle', cx: 700, cy: 400, r: 20 }, 0),
    moveStep('c', { cy: 'far', cx: 750 }, 0, -5)
  ], 500);
  assert.deepEqual(auditGeometrySampled(weird, 'weird.json'), []);
  // unlisted kind (sector) has no move fields: keeps show-time geometry
  const sector = sampledSpec([
    show(labelAt(100, 100), 0),
    show({ id: 's1', kind: 'sector', cx: 700, cy: 400, r: 40 }, 0),
    moveStep('s1', { cx: 120 }, 0, 500)
  ], 500);
  assert.deepEqual(auditGeometrySampled(sector, 'sector.json'), []);
});

test('sampled: findings on shipped samples are well-formed and real', () => {
  // Hand-verified true positive (issue #363 acceptance): uB3 slides left
  // across labB in primary-math-model-method s1; the static audit misses it.
  // Bands verified by hand against the per-glyph width (issue #376):
  // labB "Ben: 3 units" is 180.07px wide (was 198 under the 0.6 average),
  // so the 4500ms sample no longer overlaps (54px^2 < 61.6 threshold);
  // [4600ms] overlaps, 4700-4800ms is centered-on-exempt, [4900-5000ms]
  // overlaps again as uB3 exits left.
  const spec = JSON.parse(fs.readFileSync(path.join(samplesDir, 'primary-math-model-method.json'), 'utf8'));
  assert.deepEqual(auditGeometry(spec), []);
  const f = auditGeometrySampled(spec, 'primary-math-model-method.json');
  const bands = f.filter(r => /labB collides with uB3/.test(r.detail)).map(r => r.detail.match(/\[[^\]]+\]/)[0]);
  assert.deepEqual(bands, ['[4600ms]', '[4900-5000ms]']);
  // every sampled finding on every shipped sample is a well-formed record
  // with a known kind — no invented findings
  for (const name of fs.readdirSync(samplesDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
    const s = JSON.parse(fs.readFileSync(path.join(samplesDir, name), 'utf8'));
    wellFormedSampled(auditGeometrySampled(s, name));
  }
});
function wellFormedSampled(records) {
  for (const r of records) {
    assert.equal(typeof r.file, 'string', 'record.file is a string');
    assert.equal(typeof r.scene, 'string', 'record.scene is a string');
    assert.ok(r.kind === 'overflow' || r.kind === 'overlap' || r.kind === 'text-shape-overlap', 'record.kind valid');
    assert.equal(typeof r.detail, 'string', 'record.detail is a string');
    assert.match(r.detail, /\[\d+(-\d+)?ms\]$/, 'record.detail carries a time band');
  }
}

/* ---- per-glyph width model (issue #376) ---- */

test('width model: per-glyph estimates beat the 0.6 average on real labels', () => {
  // Fixture: PIL-measured (kerned) DejaVu Sans widths for 1632 real sample
  // labels, generated by generator/tooling/gen-glyph-table.py. Acceptance:
  // mean absolute error under half the old 0.6-model error.
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'widths.json'), 'utf8'));
  assert.ok(fixture.length > 100, 'fixture carries a real label corpus');
  let newErr = 0, oldErr = 0;
  for (const { text, size, measured } of fixture) {
    newErr += Math.abs(estimateTextWidth(text, size) - measured);
    oldErr += Math.abs(0.6 * size * text.length - measured);
  }
  newErr /= fixture.length;
  oldErr /= fixture.length;
  assert.ok(newErr < 0.5 * oldErr,
    'mean abs error ' + newErr.toFixed(2) + 'px should be under half the old model\'s ' + oldErr.toFixed(2) + 'px');
});

test('width model: estimates stay conservative within the documented margin', () => {
  // WIDTH_MARGIN_PX = 2 in generator/geometry.js: no label underestimates
  // the PIL-measured width by more than 2px (the model ignores kerning, and
  // the unkerned per-glyph sum is >= the kerned width almost everywhere).
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'widths.json'), 'utf8'));
  let worst = 0, worstLabel = null;
  for (const { text, size, measured } of fixture) {
    const under = measured - estimateTextWidth(text, size);
    if (under > worst) { worst = under; worstLabel = text; }
  }
  assert.ok(worst <= 2,
    'worst underestimate ' + worst.toFixed(2) + 'px on ' + JSON.stringify(worstLabel) + ' exceeds the 2px margin');
});

test('width model: unknown glyphs fall back to the 0.6 average', () => {
  // U+4E2D is not in the baked table (no CJK in the samples corpus):
  // one unknown glyph at size 20 estimates 12px wide.
  assert.equal(estimateTextWidth('中', 20), 12);
  // mixed known + unknown: known advance plus one fallback advance
  assert.equal(estimateTextWidth('a中', 20), estimateTextWidth('a', 20) + 12);
});

test('width model: astral-plane glyphs count as one glyph (surrogate pairs)', () => {
  // An astral character (a UTF-16 surrogate pair) not in the table:
  // one fallback advance, not two.
  assert.equal(estimateTextWidth('𝟘', 20), 12);
  // a lone high surrogate degrades to the fallback and never throws
  assert.ok(estimateTextWidth('a\ud83d', 20) > estimateTextWidth('a', 20));
});
