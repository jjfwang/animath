/* Tests for generator/geometry.js — R-5 headless sample check, slice 1.
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { auditGeometry, auditSampleFile, auditAllSamples } = require('../generator/geometry.js');

const samplesDir = path.join(__dirname, '..', 'samples');

// 'hello' at size 24: width 0.6*24*5 = 72, height 28.8
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
  // a spans 100..172; b starts exactly at 172 -> intersection width 0
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
  // width 0.6*24*10 = 144 > 60 remaining -> right edge 1044 > 960
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

// text 'hello' at size 24 anchored at x=100,y=100: box 100..172 x 76..104.8
function rectShape(over) {
  return Object.assign({ id: 'bar1', kind: 'rect', x: 90, y: 80, w: 120, h: 40 }, over || {});
}
function circleShape(over) {
  return Object.assign({ id: 'dot1', kind: 'circle', cx: 120, cy: 90, r: 25 }, over || {});
}

test('text-shape-overlap: label grazing a rect from outside is flagged', () => {
  // rect starts at x=160: label center (136) is outside, right edge of the
  // label band (100..172) bleeds 12px into the rect
  const f = auditGeometry(specOf([show(textShape()), show(rectShape({ x: 160 }))]));
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
  // label box 100..172 x 76..104.8, center (136, 90.4) inside the big rect
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
  // circle box 165..215 x 65..115: label center (136) outside, 7px bleed
  const f = auditGeometry(specOf([
    show(textShape()),
    show(circleShape({ cx: 190 }))
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
  // tex 'x^2' -> visible 'x^2' (3 chars, no backslash command): width 0.6*24*3 = 43.2
  // box 100..143.2 x 100..128.8 (top-left anchored); a rect grazing its right
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
  // tex '\\frac{1}{2}' -> visible '12': width 0.6*24*2 = 28.8, box 100..128.8
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
  const f = auditGeometry(specOf([show(textShape()), show(rectShape({ x: 160 }))]), 'demo.json');
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
