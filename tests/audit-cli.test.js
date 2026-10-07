/* Tests for generator/audit.js — geometry audit CLI (issue #365).
 * Run: node --test "tests/*.test.js"
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const child = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cli = require('../generator/audit.js');

const repoRoot = path.join(__dirname, '..');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'animath-audit-'));
}
// run-274 falling-shape spec: static audit clean, sampled finds [400-500ms]
function fallingSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 'lbl', kind: 'text', x: 100, y: 300, text: 'hello', size: 24 } },
        { at_ms: 0, do: 'show', shape: { id: 'ball', kind: 'circle', cx: 160, cy: 100, r: 20 } },
        { at_ms: 0, do: 'move', target: 'ball', to: { cy: 500 }, dur_ms: 1000 }
      ]
    }]
  };
}
function cleanSpec() {
  return {
    canvas: { width: 960, height: 540 },
    scenes: [{
      id: 's1', duration_ms: 1000, steps: [
        { at_ms: 0, do: 'show', shape: { id: 't', kind: 'text', x: 100, y: 100, text: 'hi', size: 24 } },
        { at_ms: 0, do: 'show', shape: { id: 'c', kind: 'circle', cx: 700, cy: 400, r: 30 } }
      ]
    }]
  };
}
function writeSpec(dir, name, spec) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(spec));
  return p;
}

test('parseArgs: files, --all, --dir, and usage errors', () => {
  const a = cli.parseArgs(['a.json', 'b.json']);
  assert.deepEqual(a.files, ['a.json', 'b.json']);
  assert.equal(a.all, false);
  assert.equal(a.error, null);
  const b = cli.parseArgs(['--all', '--dir', 'samples']);
  assert.equal(b.all, true);
  assert.equal(b.dir, 'samples');
  assert.equal(b.error, null);
  assert.ok(cli.parseArgs([]).error);
  assert.ok(cli.parseArgs(['--bogus']).error);
  assert.ok(cli.parseArgs(['--dir']).error);
  assert.ok(cli.parseArgs(['--dir', '--all']).error);
  assert.equal(cli.parseArgs(['--help']).error, 'help');
  assert.equal(cli.parseArgs(['-h']).error, 'help');
});

test('usage: documents commands and exit codes', () => {
  assert.match(cli.usage(), /--all/);
  assert.match(cli.usage(), /0 clean/);
});

test('main: clean file exits 0', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'clean.json', cleanSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 0);
  assert.equal(r.findingCount, 0);
  assert.match(r.output, /clean/);
});

test('main: falling-shape file exits 1 with the time band', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'fall.json', fallingSpec());
  const r = cli.main([f]);
  assert.equal(r.code, 1);
  assert.equal(r.findingCount, 1);
  assert.match(r.output, /lbl collides with ball \[400-500ms\]/);
});

test('main: unreadable and invalid files exit 2', () => {
  const dir = tmpDir();
  const missing = cli.main([path.join(dir, 'nope.json')]);
  assert.equal(missing.code, 2);
  assert.match(missing.output, /cannot read/);
  const badPath = path.join(dir, 'bad.json');
  fs.writeFileSync(badPath, '{not json');
  const bad = cli.main([badPath]);
  assert.equal(bad.code, 2);
});

test('main: no args and bad flags exit 2, --help exits 0', () => {
  assert.equal(cli.main([]).code, 2);
  assert.equal(cli.main(['--bogus']).code, 2);
  const help = cli.main(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.output, /Usage/);
});

test('main: --all audits the manifest without throwing', () => {
  const r = cli.main(['--all', '--dir', path.join(repoRoot, 'samples')]);
  // shipped samples have known mid-flight crossings; the contract is the
  // exit code follows the findings, and the run completes
  assert.ok(r.code === 0 || r.code === 1);
  assert.equal(typeof r.findingCount, 'number');
});

test('main: --all with a bad dir exits 2', () => {
  const r = cli.main(['--all', '--dir', path.join(repoRoot, 'no-such-dir')]);
  assert.equal(r.code, 2);
});

test('main: --all with a non-array manifest exits 2', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'index.json'), '{"a":1}');
  const r = cli.main(['--all', '--dir', dir]);
  assert.equal(r.code, 2);
  assert.match(r.output, /bad manifest/);
});

test('main: explicit files resolve against --dir', () => {
  const dir = tmpDir();
  writeSpec(dir, 'clean.json', cleanSpec());
  const r = cli.main(['clean.json', '--dir', dir]);
  assert.equal(r.code, 0);
});

test('require.main guard: real CLI invocation exits and prints', () => {
  const out = child.spawnSync(process.execPath, [path.join(repoRoot, 'generator', 'audit.js'), '--help'], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /Usage/);
});

test('auditFile: record shape and formatFinding', () => {
  const dir = tmpDir();
  const f = writeSpec(dir, 'fall.json', fallingSpec());
  const r = cli.auditFile(f);
  assert.equal(r.error, null);
  assert.equal(r.findings.length, 1);
  const line = cli.formatFinding(r.findings[0]);
  assert.match(line, /^fall\.json s1 text-shape-overlap /);
  const missing = cli.auditFile(path.join(dir, 'nope.json'));
  assert.ok(missing.error);
  assert.deepEqual(missing.findings, []);
});
