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
    assert.ok(r.kind === 'overflow' || r.kind === 'overlap', 'record.kind valid');
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
  const bottom = auditGeometry(specOf([show(textShape({ y: 530 }))]));
  assert.equal(bottom.length, 1);
  assert.equal(bottom[0].kind, 'overflow');
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
